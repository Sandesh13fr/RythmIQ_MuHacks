import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { db as prisma } from "@/lib/prisma";

const SAFETY_BUFFER_RATIO = 0.1;
const MIN_SAFETY_BUFFER = 1000;

/**
 * Explainability Service - Explain AI decisions and recommendations
 */

/**
 * Explain why a specific nudge was generated
 */
export async function explainNudge(nudgeId, userId) {
    try {
        const nudge = await prisma.nudgeAction.findUnique({
            where: { id: nudgeId, userId },
        });

        if (!nudge) {
            return { success: false, error: "Nudge not found" };
        }

        // Get user's financial context
        const context = await getUserFinancialContext(userId);

        // Generate detailed explanation using AI
        const explanation = await generateAIExplanation(nudge, context);
        const counterfactual = explanation.counterfactual || buildCounterfactual(nudge, context);

        return {
            success: true,
            nudge,
            explanation: {
                summary: nudge.reason, // Basic reason already stored
                detailed: explanation.detailed,
                keyFactors: explanation.keyFactors,
                confidence: explanation.confidence,
                alternatives: explanation.alternatives,
                counterfactual,
            },
        };
    } catch (error) {
        console.error("Error explaining nudge:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Explain spending allowance calculation
 */
export async function explainSpendingAllowance(userId) {
    try {
        const accounts = await prisma.account.findMany({
            where: { userId },
        });

        const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);

        // Get upcoming bills
        const upcomingBills = await getUpcomingBillsTotal(userId, 7);

        // Safety buffer (10% of balance or ₹1000, whichever is higher)
        const safetyBuffer = Math.max(totalBalance * 0.1, 1000);

        // Available balance
        const availableBalance = totalBalance - safetyBuffer - upcomingBills;

        // Days until next income (assume monthly, estimate based on transaction history)
        const daysUntilIncome = await estimateDaysUntilIncome(userId);

        // Daily allowance
        const dailyAllowance = Math.max(0, availableBalance / daysUntilIncome);

        return {
            success: true,
            allowance: Math.round(dailyAllowance),
            breakdown: {
                totalBalance: Math.round(totalBalance),
                safetyBuffer: Math.round(safetyBuffer),
                upcomingBills: Math.round(upcomingBills),
                availableBalance: Math.round(availableBalance),
                daysUntilIncome,
                calculation: `(₹${Math.round(totalBalance)} - ₹${Math.round(safetyBuffer)} - ₹${Math.round(upcomingBills)}) ÷ ${daysUntilIncome} days`,
            },
            explanation: {
                summary: `Your daily spending allowance is ₹${Math.round(dailyAllowance)}`,
                reasoning: [
                    `Starting with your total balance of ₹${Math.round(totalBalance)}`,
                    `We set aside ₹${Math.round(safetyBuffer)} as a safety buffer (10% of balance)`,
                    `We reserved ₹${Math.round(upcomingBills)} for upcoming bills in the next 7 days`,
                    `This leaves ₹${Math.round(availableBalance)} available to spend`,
                    `Divided by ${daysUntilIncome} days until your next income`,
                    `Gives you ₹${Math.round(dailyAllowance)} per day to spend guilt-free`,
                ],
            },
        };
    } catch (error) {
        console.error("Error explaining spending allowance:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Explain risk score calculation
 */
export async function explainRiskScore(userId) {
    try {
        const context = await getUserFinancialContext(userId);

        // Calculate risk factors
        const riskFactors = [];
        let riskScore = 0;

        // Factor 1: Balance vs upcoming obligations
        if (context.upcomingBills > context.totalBalance * 0.5) {
            riskFactors.push({
                factor: "High upcoming bills",
                impact: "high",
                description: `You have ₹${context.upcomingBills} in bills due, which is over 50% of your balance`,
            });
            riskScore += 30;
        }

        // Factor 2: Spending trend
        if (context.avgDailySpending > context.avgDailyIncome) {
            riskFactors.push({
                factor: "Spending exceeds income",
                impact: "high",
                description: "Your daily spending is higher than your daily income",
            });
            riskScore += 25;
        }

        // Factor 3: Low balance
        if (context.totalBalance < 5000) {
            riskFactors.push({
                factor: "Low balance",
                impact: "medium",
                description: "Your total balance is below ₹5,000",
            });
            riskScore += 20;
        }

        // Factor 4: No emergency buffer
        if (context.totalBalance < context.avgMonthlyExpenses * 0.25) {
            riskFactors.push({
                factor: "No emergency buffer",
                impact: "medium",
                description: "You don't have enough savings for emergencies",
            });
            riskScore += 15;
        }

        const riskLevel = riskScore >= 50 ? "high" : riskScore >= 25 ? "medium" : "low";

        return {
            success: true,
            riskScore,
            riskLevel,
            riskFactors,
            explanation: {
                summary: `Your financial risk level is ${riskLevel} (score: ${riskScore}/100)`,
                reasoning: riskFactors.map(f => f.description),
                recommendations: generateRiskRecommendations(riskLevel, riskFactors),
            },
        };
    } catch (error) {
        console.error("Error explaining risk score:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Get alternative actions for a decision
 */
export async function getAlternativeActions(nudgeId, userId) {
    try {
        const nudge = await prisma.nudgeAction.findUnique({
            where: { id: nudgeId, userId },
        });

        if (!nudge) {
            return { success: false, error: "Nudge not found" };
        }

        const alternatives = [];

        // Generate alternatives based on nudge type
        switch (nudge.nudgeType) {
            case "auto-save":
                alternatives.push(
                    {
                        action: "Save a different amount",
                        description: `Instead of ₹${nudge.amount}, you could save ₹${Number(nudge.amount) * 0.5} or ₹${Number(nudge.amount) * 1.5}`,
                        impact: "medium",
                    },
                    {
                        action: "Save later",
                        description: "Wait until after your next income to save",
                        impact: "low",
                    },
                    {
                        action: "Set up automatic savings",
                        description: "Enable auto-save to build the habit",
                        impact: "high",
                    }
                );
                break;

            case "bill-pay":
                alternatives.push(
                    {
                        action: "Pay now",
                        description: "Pay the bill immediately to avoid late fees",
                        impact: "high",
                    },
                    {
                        action: "Set reminder",
                        description: "Get reminded 1 day before the due date",
                        impact: "medium",
                    },
                    {
                        action: "Enable auto-pay",
                        description: "Never miss a payment again",
                        impact: "high",
                    }
                );
                break;

            case "spending-alert":
                alternatives.push(
                    {
                        action: "Reduce spending",
                        description: "Cut back on non-essential purchases",
                        impact: "high",
                    },
                    {
                        action: "Increase budget",
                        description: "Adjust your budget if the current limit is too low",
                        impact: "medium",
                    },
                    {
                        action: "Track expenses better",
                        description: "Review where your money is going",
                        impact: "medium",
                    }
                );
                break;

            default:
                alternatives.push({
                    action: "Dismiss",
                    description: "Ignore this suggestion if it doesn't apply to you",
                    impact: "low",
                });
        }

        return {
            success: true,
            nudge,
            alternatives,
        };
    } catch (error) {
        console.error("Error getting alternatives:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Generate AI explanation for a nudge
 */
async function generateAIExplanation(nudge, context) {
    try {
        if (!process.env.GEMINI_API_KEY) {
            // Fallback to rule-based explanation
            return generateRuleBasedExplanation(nudge, context);
        }

        const model = new ChatGoogleGenerativeAI({
            apiKey: process.env.GEMINI_API_KEY,
            modelName: "gemini-2.0-flash",
            temperature: 0.3,
        });

                const prompt = `
You are a financial advisor explaining why a specific nudge was generated.

Nudge Type: ${nudge.nudgeType}
Message: ${nudge.message}
Reason: ${nudge.reason}
Amount: ₹${nudge.amount || "N/A"}

User's Financial Context:
- Total Balance: ₹${context.totalBalance}
- Upcoming Bills: ₹${context.upcomingBills}
- Avg Daily Spending: ₹${context.avgDailySpending}
- Avg Daily Income: ₹${context.avgDailyIncome}
- Estimated Daily Allowance: ₹${context.dailyAllowance}
- Current Risk Level: ${context.riskLevel}

Provide a detailed explanation in JSON format:
{
  "detailed": "2-3 sentence explanation of why this nudge was generated",
  "keyFactors": ["factor 1", "factor 2", "factor 3"],
  "confidence": 85,
    "alternatives": ["alternative 1", "alternative 2"],
    "counterfactual": "One sentence describing what happens if the user ignores this nudge"
}

Return ONLY valid JSON, no markdown.`;

        const result = await model.invoke(prompt);
        let cleanResult = result.content.trim();

        if (cleanResult.startsWith("```json")) {
            cleanResult = cleanResult.replace(/```json\n?/g, "").replace(/```\n?/g, "");
        }

        return JSON.parse(cleanResult);
    } catch (error) {
        console.error("Error generating AI explanation:", error);
        return generateRuleBasedExplanation(nudge, context);
    }
}

/**
 * Fallback rule-based explanation
 */
function generateRuleBasedExplanation(nudge, context) {
    return {
        detailed: nudge.reason,
        keyFactors: [
            `Your current balance is ₹${context.totalBalance}`,
            `You have ₹${context.upcomingBills} in upcoming bills`,
            `Based on your spending patterns`,
        ],
        confidence: 75,
        alternatives: ["Accept this suggestion", "Modify the amount", "Dismiss for now"],
        counterfactual: buildCounterfactual(nudge, context),
    };
}

/**
 * Get user's financial context
 */
async function getUserFinancialContext(userId) {
    const accounts = await prisma.account.findMany({ where: { userId } });
    const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);

    const upcomingBills = await getUpcomingBillsTotal(userId, 7);

    // Get recent transactions for spending analysis
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const transactions = await prisma.transaction.findMany({
        where: {
            userId,
            date: { gte: thirtyDaysAgo },
        },
    });

    const expenses = transactions.filter(t => t.type === "EXPENSE");
    const income = transactions.filter(t => t.type === "INCOME");

    const totalExpenses = expenses.reduce((sum, t) => sum + Number(t.amount), 0);
    const totalIncome = income.reduce((sum, t) => sum + Number(t.amount), 0);

    const dailyAllowance = calculateDailyAllowance(totalBalance, upcomingBills, 30);
    const avgDailySpend = totalExpenses / 30;
    const riskLevel = deriveRiskLevel(totalBalance, upcomingBills, avgDailySpend);

    return {
        totalBalance,
        upcomingBills,
        avgDailySpending: avgDailySpend,
        avgDailyIncome: totalIncome / 30,
        avgMonthlyExpenses: totalExpenses,
        avgMonthlyIncome: totalIncome,
        dailyAllowance,
        riskLevel,
        projectedShortfall: Math.max(0, upcomingBills - totalBalance),
    };
}

function calculateDailyAllowance(balance, upcomingBills, days = 30) {
    if (!days || days <= 0) days = 30;
    const safetyBuffer = Math.max(Math.round(balance * SAFETY_BUFFER_RATIO), MIN_SAFETY_BUFFER);
    const available = balance - safetyBuffer - upcomingBills;
    return Math.max(0, Math.round(available / days));
}

function deriveRiskLevel(balance, upcomingBills, dailySpend) {
    if (balance <= 0) return "critical";
    if (balance < upcomingBills) return "danger";
    if (balance < upcomingBills * 1.5) return "caution";
    if (dailySpend && dailySpend > (balance / 30)) return "caution";
    return "safe";
}

function buildCounterfactual(nudge, context) {
    const riskLevel = (nudge.metadata?.riskContext?.riskLevel || context.riskLevel || "elevated").toString();
    const shortfall = Math.max(0, Math.round(context.projectedShortfall || 0));
    const allowance = context.dailyAllowance ? `Daily allowance stays near ₹${context.dailyAllowance}.` : "";
    const base = shortfall > 0
        ? `Skipping this keeps a ₹${shortfall} gap before bills land.`
        : `Skipping this keeps risk ${riskLevel.toLowerCase()} with less buffer for surprises.`;

    if (!nudge.nudgeType) {
        return `${base} ${allowance}`.trim();
    }

    const type = nudge.nudgeType.toLowerCase();
    if (type.includes("micro") || type.includes("save")) {
        return `Skip this save and ${riskLevel.toLowerCase()} risk sticks around; buffer stays thin (${allowance || "no extra cushion"}).`;
    }
    if (type.includes("bill") || type.includes("guardian")) {
        return `Ignore this and upcoming bills stay exposed${shortfall ? ` with a ₹${shortfall} shortfall` : ""}.`;
    }
    if (type.includes("spend")) {
        return `If you ignore the warning, discretionary spend keeps burning ₹${Math.round(context.avgDailySpending || 0)} a day and risk remains ${riskLevel}.`;
    }
    return `${base} ${allowance}`.trim();
}

/**
 * Get total upcoming bills
 */
async function getUpcomingBillsTotal(userId, days) {
    try {
        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + days);

        const bills = await prisma.bill.findMany({
            where: {
                userId,
                isActive: true,
                nextDueDate: {
                    gte: today,
                    lte: futureDate,
                },
            },
        });

        return bills.reduce((sum, bill) => sum + Number(bill.amount), 0);
    } catch (error) {
        return 0;
    }
}

/**
 * Estimate days until next income
 */
async function estimateDaysUntilIncome(userId) {
    try {
        const recentIncome = await prisma.transaction.findFirst({
            where: {
                userId,
                type: "INCOME",
            },
            orderBy: { date: "desc" },
        });

        if (!recentIncome) return 30; // Default to 30 days

        const daysSinceIncome = Math.floor(
            (new Date() - new Date(recentIncome.date)) / (1000 * 60 * 60 * 24)
        );

        // Assume monthly income
        return Math.max(1, 30 - daysSinceIncome);
    } catch (error) {
        return 30;
    }
}

/**
 * Generate risk recommendations
 */
function generateRiskRecommendations(riskLevel, riskFactors) {
    const recommendations = [];

    if (riskLevel === "high") {
        recommendations.push(
            "Reduce non-essential spending immediately",
            "Look for additional income opportunities",
            "Consider postponing large purchases"
        );
    } else if (riskLevel === "medium") {
        recommendations.push(
            "Build an emergency fund",
            "Review and optimize your budget",
            "Track your spending more closely"
        );
    } else {
        recommendations.push(
            "Keep up the good work!",
            "Consider increasing your savings",
            "Explore investment opportunities"
        );
    }

    return recommendations;
}
