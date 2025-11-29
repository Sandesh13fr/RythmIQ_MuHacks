import { db } from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { sanitizeAIResponse } from "@/lib/security/sanitize-ai";

const LOCALE_PRESETS = {
    en: {
        label: "English",
        directive: "Respond in concise, encouraging English.",
        voice: "en-IN",
    },
    hi: {
        label: "हिंदी",
        directive: "व्याख्या सरल और स्पष्ट हिंदी में दें।",
        voice: "hi-IN",
    },
    hinglish: {
        label: "Hinglish",
        directive: "Respond in casual Hinglish mixing Hindi + English like a friendly coach.",
        voice: "en-IN",
    },
};

export async function generateCoachResponse({ clerkUserId, question, locale = "en" }) {
    if (!question || !question.trim()) {
        throw new Error("Question is required");
    }

    const preset = LOCALE_PRESETS[locale] || LOCALE_PRESETS.en;

    const user = await db.user.findUnique({
        where: { clerkUserId },
        include: {
            accounts: true,
            financialProfile: true,
        },
    });

    if (!user) {
        throw new Error("User not found");
    }

    const context = await buildCoachContext(user);
    const prompt = buildPrompt(question, preset.directive, context);

    let answer;
    if (process.env.GEMINI_API_KEY) {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent(prompt);
        answer = sanitizeAIResponse(result.response.text());
    } else {
        answer = buildFallbackAnswer(question, preset, context);
    }

    return {
        message: answer,
        locale,
        language: preset.label,
        speechLocale: preset.voice,
        context,
    };
}

async function buildCoachContext(user) {
    const accounts = user.accounts || [];
    const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance || 0), 0);

    const upcomingBills = db.bill
        ? await db.bill.findMany({
              where: {
                  userId: user.id,
                  isActive: true,
                  nextDueDate: {
                      gte: new Date(),
                      lte: addDays(new Date(), 14),
                  },
              },
              orderBy: { nextDueDate: "asc" },
          })
        : [];

    const nextBills = upcomingBills.slice(0, 3).map((bill) => ({
        name: bill.name,
        amount: Number(bill.amount),
        dueDate: bill.nextDueDate,
    }));

    const billsTotal = upcomingBills.reduce((sum, bill) => sum + Number(bill.amount || 0), 0);
    const dailyAllowance = calculateDailyAllowance(totalBalance, billsTotal, 30);

    const latestRisk = db.riskSnapshot
        ? await db.riskSnapshot.findFirst({
              where: { userId: user.id },
              orderBy: { createdAt: "desc" },
          })
        : null;

    const lastIncome = db.transaction
        ? await db.transaction.findFirst({
              where: { userId: user.id, type: "INCOME" },
              orderBy: { date: "desc" },
          })
        : null;

    return {
        totalBalance: Math.round(totalBalance),
        upcomingBills: Math.round(billsTotal),
        dailyAllowance,
        riskLevel: latestRisk?.riskLevel || deriveRiskLevel(totalBalance, billsTotal),
        nextBills,
        lastIncomeAmount: lastIncome ? Number(lastIncome.amount) : null,
        lastIncomeDate: lastIncome?.date || null,
        languagePreference: user.financialProfile?.preferredLocale || null,
    };
}

function buildPrompt(question, directive, context) {
    return `You are RythmIQ's Mini Coach, a bilingual financial guide for gig workers.
Context (JSON): ${JSON.stringify(context)}

Rules:
- ${directive}
- Keep answers under 3 sentences.
- Reference concrete numbers from the context when helpful (balances, allowance, bills).
- If the user asks about spending, remind them of the daily allowance.
- If they ask about savings or bills, cite upcoming obligations and risk level.
- Offer one actionable suggestion.

User question: "${question}"`;
}

function calculateDailyAllowance(balance, upcomingBills, days = 30) {
    if (!days || days <= 0) days = 30;
    const safetyBuffer = Math.max(1000, Math.round(balance * 0.1));
    const available = balance - safetyBuffer - upcomingBills;
    return Math.max(0, Math.round(available / days));
}

function deriveRiskLevel(balance, upcomingBills) {
    if (balance <= 0) return "critical";
    if (balance < upcomingBills) return "danger";
    if (balance < upcomingBills * 1.5) return "caution";
    return "safe";
}

function buildFallbackAnswer(question, preset, context) {
    const lower = question.toLowerCase();
    const parts = [];

    if (lower.includes("spend") || lower.includes("allow")) {
        parts.push(`You can safely spend about ₹${context.dailyAllowance} today before touching your buffer.`);
    }

    if (lower.includes("save")) {
        parts.push(`Setting aside even ₹200 keeps you ahead because ${context.riskLevel} risk stays unless the buffer grows.`);
    }

    if (lower.includes("bill") || lower.includes("rent")) {
        if (context.nextBills.length > 0) {
            const next = context.nextBills[0];
            parts.push(`Reminder: ${next.name} for ₹${next.amount} is due on ${formatDate(next.dueDate)}.`);
        }
    }

    if (parts.length === 0) {
        parts.push(`Balance is ₹${context.totalBalance} with ₹${context.upcomingBills} in upcoming bills, so risk is ${context.riskLevel}.`);
    }

    parts.push("Stay consistent—I'm here whenever you need a quick check-in.");

    const base = parts.join(" ");
    if (preset === LOCALE_PRESETS.hi) {
        return buildHindiMessage(context, parts);
    }
    if (preset === LOCALE_PRESETS.hinglish) {
        return buildHinglishMessage(context, parts);
    }
    return base;
}

function buildHindiMessage(context, parts) {
    const sentences = [];
    if (context.dailyAllowance) {
        sentences.push(`Aaj aap lagbhag ₹${context.dailyAllowance} tak kharch kar sakte hain bina buffer ko chhede.`);
    }
    if (context.nextBills.length) {
        const next = context.nextBills[0];
        sentences.push(`Yaad rahe ${next.name} ka ₹${next.amount} bill ${formatDate(next.dueDate)} ko due hai.`);
    }
    sentences.push(`Filhal risk level ${context.riskLevel} hai, isliye thoda satark rahiye.`);
    sentences.push("Apni progress mujhe batate rahiye, hum saath milkar plan banayenge.");
    return sentences.join(" ");
}

function buildHinglishMessage(context, parts) {
    const sentences = [];
    if (context.dailyAllowance) {
        sentences.push(`Aaj ka safe spend limit around ₹${context.dailyAllowance} hai.`);
    }
    if (context.nextBills.length) {
        const next = context.nextBills[0];
        sentences.push(`Heads-up: ${next.name} ka ₹${next.amount} bill ${formatDate(next.dueDate)} ko due hai.`);
    }
    sentences.push(`Overall vibe ${context.riskLevel} risk ka hai, toh thoda buffer banaye rakho.`);
    sentences.push("Need more tips? Bas pucho!");
    return sentences.join(" ");
}

function formatDate(date) {
    if (!date) return "soon";
    return new Date(date).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}
