import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Panic Mode Agent (NO LANGCHAIN)
 * Uses direct Gemini API
 */

const PANIC_TRIGGERS = {
    BALANCE_CRITICAL: 500,
    DAYS_TO_ZERO: 7,
    FORECAST_CRITICAL: true,
};

export function shouldActivatePanicMode(financialData, forecast = null) {
    const { balance, dailyExpenseRate, dailyIncomeRate } = financialData;

    if (balance < PANIC_TRIGGERS.BALANCE_CRITICAL) {
        return {
            shouldActivate: true,
            trigger: "BALANCE_CRITICAL",
            reason: `Balance is critically low (₹${balance})`,
            urgency: "critical",
        };
    }

    const netDailyRate = dailyIncomeRate - dailyExpenseRate;
    if (netDailyRate < 0) {
        const daysToZero = Math.abs(balance / netDailyRate);
        if (daysToZero < PANIC_TRIGGERS.DAYS_TO_ZERO) {
            return {
                shouldActivate: true,
                trigger: "DAYS_TO_ZERO",
                reason: `Will run out of money in ${Math.round(daysToZero)} days`,
                urgency: "critical",
                daysToZero: Math.round(daysToZero),
            };
        }
    }

    if (forecast && (forecast.risk_level === "critical" || forecast.risk_level === "high")) {
        return {
            shouldActivate: true,
            trigger: "FORECAST_CRITICAL",
            reason: `AI predicts ${forecast.risk_level} risk`,
            urgency: forecast.risk_level,
        };
    }

    return {
        shouldActivate: false,
        trigger: null,
        reason: "Financial situation stable",
        urgency: "low",
    };
}

export async function generateEmergencyPlan(userId, financialData) {
    try {
        const { balance, monthlyIncome, monthlyExpenses, daysToZero } = financialData;

        let emergencyPlan = null;

        if (process.env.GEMINI_API_KEY) {
            try {
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

                const prompt = `EMERGENCY: User has ₹${balance}, ${daysToZero || 'unknown'} days to zero, income ₹${monthlyIncome}/month, expenses ₹${monthlyExpenses}/month.

Generate emergency survival plan in JSON:
{
  "immediate_actions": [
    {"action": "specific action NOW", "priority": "critical", "impact": "outcome"}
  ],
  "freeze_categories": ["Entertainment", "Shopping"],
  "essential_only_budget": {"food": 100, "transport": 50, "utilities": 50},
  "earning_opportunities": [
    {"platform": "Swiggy", "potential_earning": "₹800/day", "urgency": "today"}
  ],
  "survival_tips": ["tip1", "tip2"],
  "emergency_message": "urgent guidance"
}

Return ONLY JSON.`;

                const result = await model.generateContent(prompt);
                const text = result.response.text();

                let cleanText = text.trim();
                if (cleanText.startsWith("```json")) {
                    cleanText = cleanText.replace(/```json\n?/g, "").replace(/```\n?/g, "");
                }
                if (cleanText.startsWith("```")) {
                    cleanText = cleanText.replace(/```\n?/g, "");
                }

                emergencyPlan = JSON.parse(cleanText);
            } catch (aiError) {
                console.error("AI emergency plan failed:", aiError);
            }
        }

        // Fallback plan
        if (!emergencyPlan) {
            emergencyPlan = {
                immediate_actions: [
                    {
                        action: "Stop all non-essential spending immediately",
                        priority: "critical",
                        impact: "Preserve remaining balance",
                    },
                    {
                        action: "Contact family/friends for emergency support",
                        priority: "high",
                        impact: "Get immediate help",
                    },
                ],
                freeze_categories: ["Entertainment", "Shopping", "Dining"],
                essential_only_budget: {
                    food: 100,
                    transport: 50,
                    utilities: 50,
                },
                earning_opportunities: [
                    { platform: "Swiggy Delivery", potential_earning: "₹800/day", urgency: "today" },
                    { platform: "Zepto Shopper", potential_earning: "₹600/day", urgency: "today" },
                ],
                transfer_suggestions: [],
                survival_tips: [
                    "Cook at home, avoid eating out",
                    "Use public transport or walk",
                    "Postpone all non-urgent purchases",
                ],
                emergency_message: "You're in survival mode. Focus on essentials only.",
            };
        }

        return {
            success: true,
            plan: emergencyPlan,
            generatedAt: new Date().toISOString(),
        };
    } catch (error) {
        console.error("Error generating emergency plan:", error);
        return {
            success: false,
            error: error.message,
            plan: {
                immediate_actions: [
                    { action: "Stop non-essential spending", priority: "critical", impact: "Save money" },
                ],
                freeze_categories: ["Entertainment", "Shopping"],
                essential_only_budget: { food: 100, transport: 50, utilities: 50 },
                earning_opportunities: [
                    { platform: "Swiggy", potential_earning: "₹800/day", urgency: "today" },
                ],
                survival_tips: ["Cook at home", "Use public transport"],
                emergency_message: "Emergency mode activated.",
            },
        };
    }
}

export function getUrgentGigOpportunities(location = "India") {
    return [
        {
            platform: "Swiggy",
            type: "Food Delivery",
            earning: "₹800-1200/day",
            requirements: "Bike/Scooter",
            urgency: "Start Today",
            link: "https://www.swiggy.com/careers",
            icon: "🚴",
        },
        {
            platform: "Zepto",
            type: "Quick Commerce",
            earning: "₹600-1000/day",
            requirements: "Bike",
            urgency: "Start Today",
            link: "https://www.zeptonow.com/careers",
            icon: "🛒",
        },
        {
            platform: "Urban Company",
            type: "Home Services",
            earning: "₹500-1500/day",
            requirements: "Skills (plumbing, cleaning, etc.)",
            urgency: "This Week",
            link: "https://www.urbancompany.com/careers",
            icon: "🏠",
        },
        {
            platform: "Fiverr",
            type: "Freelance Gigs",
            earning: "₹500-5000/project",
            requirements: "Skills (design, writing, etc.)",
            urgency: "This Week",
            link: "https://www.fiverr.com",
            icon: "💻",
        },
        {
            platform: "Upwork",
            type: "Freelance Work",
            earning: "₹1000-10000/project",
            requirements: "Professional skills",
            urgency: "This Week",
            link: "https://www.upwork.com",
            icon: "💼",
        },
    ];
}

const panicModeState = new Map();

export function activatePanicMode(userId, trigger, emergencyPlan) {
    panicModeState.set(userId, {
        active: true,
        activatedAt: new Date().toISOString(),
        trigger,
        emergencyPlan,
    });
}

export function deactivatePanicMode(userId) {
    const state = panicModeState.get(userId);
    if (state) {
        panicModeState.set(userId, {
            ...state,
            active: false,
            deactivatedAt: new Date().toISOString(),
        });
    }
}

export function getPanicModeStatus(userId) {
    return panicModeState.get(userId) || { active: false };
}

export function isPanicModeActive(userId) {
    const state = panicModeState.get(userId);
    return state?.active || false;
}
