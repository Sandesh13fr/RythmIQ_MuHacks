import { db } from "@/lib/prisma";
import { predictCashFlow, calculateRiskScore, calculateSafeToSave, get7DayForecast, mapRiskToMeter, checkEmiAtRisk } from "@/lib/predictions";
import { getPersonalizedNudgeSettings } from "@/lib/behavior-engine";

/**
 * Intelligent Nudge Engine
 * Analyzes user's financial state and generates personalized, actionable nudges
 */

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function daysUntilWeekday(targetWeekday) {
    if (!targetWeekday) return null;
    const targetIndex = WEEKDAYS.indexOf(targetWeekday);
    if (targetIndex === -1) return null;
    const todayIndex = new Date().getDay();
    const diff = (targetIndex - todayIndex + 7) % 7;
    return diff === 0 ? 7 : diff; // treat same-day as next week to encourage planning
}

export const NUDGE_TYPES = {
    AUTO_SAVE: "auto-save",
    BILL_PAY: "bill-pay",
    BILL_GUARD: "bill-guard",
    SPENDING_ALERT: "spending-alert",
    INCOME_OPPORTUNITY: "income-opportunity",
    EMERGENCY_BUFFER: "emergency-buffer",
    MICRO_SAVE: "micro-save",
    GUARDIAN_ALERT: "guardian-alert",
    SPENDING_GUARDRAIL: "spending-guardrail",
    GOAL_BACKSTOP: "goal-backstop",
};

/**
 * Generate intelligent nudges for a user
 * @param {string} userId - Clerk user ID
 * @returns {Promise<Array>} Array of nudge objects
 */
export async function generateNudges(userId) {
    try {
        const user = await db.user.findUnique({
            where: { clerkUserId: userId },
            include: {
                accounts: true,
                transactions: {
                    orderBy: { date: "desc" },
                    take: 100,
                },
                budgets: true,
                financialProfile: true,
            },
        });

        if (!user) return [];

        // Get personalized settings based on behavior
        const settings = await getPersonalizedNudgeSettings(userId);
        const maxNudges = settings.maxNudgesPerDay;
        const preferSummaries = settings.preferSummaries;
        const priorityThreshold = settings.priorityThreshold;

        const nudges = [];
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const incomeRhythm = user.financialProfile?.incomeRhythm;
        const paydayEta = incomeRhythm?.payday ? daysUntilWeekday(incomeRhythm.payday) : null;

        // Calculate key metrics
        const totalBalance = user.accounts.reduce(
            (sum, acc) => sum + parseFloat(acc.balance),
            0
        );

        const monthExpenses = user.transactions
            .filter(
                (t) =>
                    t.type === "EXPENSE" &&
                    new Date(t.date) >= startOfMonth &&
                    new Date(t.date) <= today
            )
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);

        const budget = user.budgets[0];
        const budgetRemaining = budget
            ? parseFloat(budget.amount) - monthExpenses
            : 0;

        // Feature 1 & 3: 7-day forecast and EMI risk check
        const forecast7Day = get7DayForecast(user.transactions, user.accounts);
        const riskLevel = mapRiskToMeter(forecast7Day.riskScore);
        const emiRisk = checkEmiAtRisk(user.transactions, user.accounts, 7);

        // 1. AUTO-SAVE NUDGE: User has extra money
        // Also consider goals - if user has goals and budget available, propose saving to goals
        const goals = await db.goal.findMany({ where: { userId: user.id, status: "active" } });
        if (goals.length > 0) {
            const g = goals[0];
            const remaining = parseFloat(g.targetAmount) - parseFloat(g.savedAmount || 0);
            if (remaining > 0 && budgetRemaining > 500) {
                const saveAmount = Math.min(2000, Math.max(500, Math.round(remaining * 0.05)));
                nudges.push({
                    type: NUDGE_TYPES.AUTO_SAVE,
                    amount: saveAmount,
                    message: `Goal: Save ₹${saveAmount.toFixed(0)} for ${g.name} now?`,
                    reason: `Progress toward ${g.name}. Saving consistently will reach target by ${g.targetDate ? new Date(g.targetDate).toLocaleDateString() : 'target date'}`,
                    priority: 4,
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    metadata: { goalId: g.id, goalName: g.name },
                });
            }
        }
        if (totalBalance > 20000 && budgetRemaining > 5000) {
            const saveAmount = Math.min(2000, budgetRemaining * 0.2);
            nudges.push({
                type: NUDGE_TYPES.AUTO_SAVE,
                amount: saveAmount,
                message: `You have ₹${budgetRemaining.toFixed(0)} left in your budget. Save ₹${saveAmount.toFixed(0)} now?`,
                reason: `You're ahead of your budget and have extra funds. Saving now helps build your emergency fund.`,
                priority: 3,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            });
        }

        // Feature 1: MICRO_SAVE if Caution/Danger
        if (riskLevel === "Caution" || riskLevel === "Danger") {
            const microAmount = Math.min(120, Math.max(50, calculateSafeToSave(user.transactions, user.accounts, budget)));
            if (microAmount > 0) {
                nudges.push({
                    type: NUDGE_TYPES.MICRO_SAVE,
                    amount: microAmount,
                    message: `Risk level: ${riskLevel}. Save ₹${microAmount} to buffer today${paydayEta ? ` (payday in ${paydayEta} days)` : ""}?`,
                    reason: `Your 7-day forecast shows ${riskLevel.toLowerCase()} risk. Small saves build security.${paydayEta ? " Next inflow is expected soon, so this buffer keeps you safe." : ""}`,
                    priority: 6,
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    metadata: { riskLevel, forecast: forecast7Day, incomeRhythm },
                });
            }
        }

        // 2. BILL PAY NUDGE: Upcoming recurring bills
        const upcomingBills = user.transactions.filter(
            (t) =>
                t.isRecurring &&
                t.type === "EXPENSE" &&
                t.nextRecurringDate &&
                new Date(t.nextRecurringDate) <= new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
        );

        if (upcomingBills.length > 0) {
            const nextBill = upcomingBills[0];
            const daysUntil = Math.ceil(
                (new Date(nextBill.nextRecurringDate) - today) / (1000 * 60 * 60 * 24)
            );
            const billAmount = parseFloat(nextBill.amount);

            nudges.push({
                type: NUDGE_TYPES.BILL_PAY,
                amount: billAmount,
                message: `${nextBill.description} (₹${billAmount.toFixed(0)}) is due in ${daysUntil} days. Auto-pay now?`,
                reason: `Paying bills early avoids late fees and keeps your credit score healthy.`,
                priority: 5,
                expiresAt: new Date(nextBill.nextRecurringDate),
                metadata: { billId: nextBill.id, billName: nextBill.description },
            });

            nudges.push({
                type: NUDGE_TYPES.BILL_GUARD,
                amount: billAmount,
                message: `Freeze ₹${billAmount.toFixed(0)} for ${nextBill.description}?`,
                reason: `Bill guard will ring-fence this amount so it cannot be overspent before due date.`,
                priority: 6,
                expiresAt: new Date(nextBill.nextRecurringDate),
                metadata: { billId: nextBill.id, billName: nextBill.description },
            });
        }

        // Feature 3: GUARDIAN_ALERT if EMIs at risk
        if (emiRisk.atRisk) {
            const ways = ["Cut dining out", "Delay non-essentials", "Pick up a quick gig"];
            nudges.push({
                type: NUDGE_TYPES.GUARDIAN_ALERT,
                amount: emiRisk.shortfall,
                message: `Upcoming EMIs (₹${emiRisk.totalEmi.toFixed(0)}) in 7 days. Short by ₹${emiRisk.shortfall.toFixed(0)}. Act now?`,
                reason: `Your forecast shows shortfall for ${emiRisk.upcomingEmis} EMIs. ${ways.join(" or ")}.`,
                priority: 8,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                metadata: { emiRisk, ways },
            });
        }

        // 3. SPENDING ALERT: Over 80% of category budget
        const categorySpending = user.transactions
            .filter(
                (t) =>
                    t.type === "EXPENSE" &&
                    new Date(t.date) >= startOfMonth
            )
            .reduce((acc, t) => {
                acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount);
                return acc;
            }, {});

        // Assume 20% of budget per major category (simplified)
        const categoryBudget = budget ? parseFloat(budget.amount) * 0.2 : 2000;

        Object.entries(categorySpending).forEach(([category, spent]) => {
            if (spent > categoryBudget * 0.8 && spent < categoryBudget * 1.2) {
                nudges.push({
                    type: NUDGE_TYPES.SPENDING_ALERT,
                    amount: spent,
                    message: `You've spent ₹${spent.toFixed(0)} on ${category} (${((spent / categoryBudget) * 100).toFixed(0)}% of typical budget)`,
                    reason: `You're approaching your usual ${category} spending limit. Consider reducing expenses in this category.`,
                    priority: 2,
                    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
                });
            }
        });

        // 4. EMERGENCY BUFFER: Balance below threshold
        const EMERGENCY_THRESHOLD = 1000;
        if (totalBalance < EMERGENCY_THRESHOLD && totalBalance > 0) {
            nudges.push({
                type: NUDGE_TYPES.EMERGENCY_BUFFER,
                amount: EMERGENCY_THRESHOLD - totalBalance,
                message: `Your balance is ₹${totalBalance.toFixed(0)}, below the emergency threshold. Reduce spending?`,
                reason: `Maintaining at least ₹${EMERGENCY_THRESHOLD} helps you handle unexpected expenses.`,
                priority: 10, // Highest priority
                expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours
            });
        }

        // 5. INCOME OPPORTUNITY: Income below average
        const last30Days = user.transactions.filter(
            (t) =>
                t.type === "INCOME" &&
                new Date(t.date) >= new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
        );

        const avgIncome = last30Days.length > 0
            ? last30Days.reduce((sum, t) => sum + parseFloat(t.amount), 0) / last30Days.length
            : 0;

        const thisWeekIncome = user.transactions
            .filter(
                (t) =>
                    t.type === "INCOME" &&
                    new Date(t.date) >= new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
            )
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);

        if (avgIncome > 0 && thisWeekIncome < avgIncome * 0.7) {
            const deficit = avgIncome - thisWeekIncome;
            const cadence = incomeRhythm?.cadence;
            const paydayLabel = incomeRhythm?.payday ? `${incomeRhythm.payday}${incomeRhythm.hourSlot ? ` ${incomeRhythm.hourSlot}` : ""}` : null;
            nudges.push({
                type: NUDGE_TYPES.INCOME_OPPORTUNITY,
                amount: deficit,
                message: `Your income this week (₹${thisWeekIncome.toFixed(0)}) is ${((deficit / avgIncome) * 100).toFixed(0)}% below average${paydayLabel ? `. Payday usually hits ${paydayLabel}` : ""}.`,
                reason: `Consider picking up extra gigs or work to maintain your usual income level.${cadence ? ` Typical cadence: ${cadence}.` : ""}`,
                priority: 4,
                expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
                metadata: { incomeRhythm },
            });
        }

        // Feature 5: Adjust based on behavior
        if (preferSummaries) {
            // Instead of individual nudges, create a summary nudge
            if (nudges.length > 0) {
                const summary = nudges.slice(0, 3).map(n => n.message).join("; ");
                nudges.length = 0; // Clear individual
                nudges.push({
                    type: "SUMMARY",
                    message: `Daily Summary: ${summary}`,
                    reason: "Based on your preferences, here's a consolidated view.",
                    priority: 1,
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    metadata: { originalNudges: nudges.slice(0, 3) },
                });
            }
        }

        // Filter by priority threshold and limit
        const filteredNudges = nudges.filter(n => n.priority >= priorityThreshold).slice(0, maxNudges);

        const riskContext = {
            riskLevel,
            riskScore: forecast7Day.riskScore,
            trend: forecast7Day.trend,
            incomeRhythm,
        };

        // Sort by priority (highest first) and inject risk metadata
        return filteredNudges
            .map((n) => ({
                ...n,
                metadata: {
                    ...(n.metadata || {}),
                    riskContext,
                },
            }))
            .sort((a, b) => b.priority - a.priority);
    } catch (error) {
        console.error("Nudge Engine Error:", error);
        return [];
    }
}

/**
 * Calculate the impact of a nudge after execution
 * @param {string} nudgeType - Type of nudge
 * @param {number} amount - Amount involved
 * @returns {number} Estimated financial impact
 */
export function calculateNudgeImpact(nudgeType, amount) {
    switch (nudgeType) {
        case NUDGE_TYPES.AUTO_SAVE:
            return amount; // Direct savings
        case NUDGE_TYPES.BILL_PAY:
            return 50; // Avoided late fee (estimated)
        case NUDGE_TYPES.BILL_GUARD:
            return amount * 0.05; // Value of prevented late fees/overdrafts
        case NUDGE_TYPES.SPENDING_ALERT:
            return amount * 0.1; // Estimated 10% reduction in category
        case NUDGE_TYPES.EMERGENCY_BUFFER:
            return 0; // Preventive, hard to quantify
        case NUDGE_TYPES.INCOME_OPPORTUNITY:
            return amount * 0.5; // Estimated 50% of deficit recovered
        case NUDGE_TYPES.MICRO_SAVE:
            return amount; // Direct buffer build
        case NUDGE_TYPES.GUARDIAN_ALERT:
            return amount * 0.8; // Estimated 80% of shortfall avoided
        case NUDGE_TYPES.SPENDING_GUARDRAIL:
            return amount * 0.15; // Estimated slowdown on discretionary burn
        case NUDGE_TYPES.GOAL_BACKSTOP:
            return amount; // Direct top-up toward goal
        default:
            return 0;
    }
}
