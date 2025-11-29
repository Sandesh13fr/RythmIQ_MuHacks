import { db as prisma } from "@/lib/prisma";

/**
 * Counterfactual Engine - What-if scenario simulator
 */

/**
 * Simulate spending scenario
 */
export async function simulateSpending(userId, spendingAmount, category = "Other") {
    try {
        // Get current financial state
        const currentState = await getCurrentFinancialState(userId);

        // Calculate new state after spending
        const newBalance = currentState.totalBalance - spendingAmount;
        const newDailyAllowance = calculateDailyAllowance(
            newBalance,
            currentState.upcomingBills,
            currentState.daysUntilIncome
        );

        // Calculate risk change
        const currentRisk = calculateRiskLevel(currentState.totalBalance, currentState.upcomingBills);
        const newRisk = calculateRiskLevel(newBalance, currentState.upcomingBills);

        // Calculate impact on savings goal (if any)
        const savingsImpact = await calculateSavingsImpact(userId, spendingAmount);

        return {
            success: true,
            scenario: "spending",
            amount: spendingAmount,
            current: {
                balance: currentState.totalBalance,
                dailyAllowance: currentState.dailyAllowance,
                riskLevel: currentRisk,
            },
            projected: {
                balance: newBalance,
                dailyAllowance: newDailyAllowance,
                riskLevel: newRisk,
            },
            impact: {
                balanceChange: -spendingAmount,
                allowanceChange: newDailyAllowance - currentState.dailyAllowance,
                riskChange: newRisk !== currentRisk ? `${currentRisk} → ${newRisk}` : "No change",
                savingsGoalImpact: savingsImpact,
            },
            recommendation: generateSpendingRecommendation(newBalance, newRisk, currentState),
        };
    } catch (error) {
        console.error("Error simulating spending:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Simulate saving scenario
 */
export async function simulateSaving(userId, savingAmount) {
    try {
        const currentState = await getCurrentFinancialState(userId);

        // Calculate new state after saving
        const newBalance = currentState.totalBalance - savingAmount; // Moved to savings
        const newDailyAllowance = calculateDailyAllowance(
            newBalance,
            currentState.upcomingBills,
            currentState.daysUntilIncome
        );

        // Calculate long-term benefit
        const monthlyBenefit = savingAmount;
        const yearlyBenefit = savingAmount * 12;

        // Check if this affects bill payments
        const affectsBills = newBalance < currentState.upcomingBills;

        return {
            success: true,
            scenario: "saving",
            amount: savingAmount,
            current: {
                balance: currentState.totalBalance,
                dailyAllowance: currentState.dailyAllowance,
            },
            projected: {
                balance: newBalance,
                dailyAllowance: newDailyAllowance,
                savingsAccumulated: savingAmount,
            },
            impact: {
                immediateImpact: `₹${savingAmount} moved to savings`,
                monthlyProjection: `₹${monthlyBenefit} saved per month`,
                yearlyProjection: `₹${yearlyBenefit} saved per year`,
                affectsBills,
                warning: affectsBills ? "This may affect your ability to pay upcoming bills" : null,
            },
            recommendation: generateSavingRecommendation(savingAmount, newBalance, currentState),
        };
    } catch (error) {
        console.error("Error simulating saving:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Simulate income scenario
 */
export async function simulateIncome(userId, incomeAmount) {
    try {
        const currentState = await getCurrentFinancialState(userId);

        // Calculate new state with additional income
        const newBalance = currentState.totalBalance + incomeAmount;
        const newDailyAllowance = calculateDailyAllowance(
            newBalance,
            currentState.upcomingBills,
            currentState.daysUntilIncome
        );

        // Calculate how much can be safely saved
        const safeToSave = Math.max(0, newBalance - currentState.upcomingBills - 5000);

        const currentRisk = calculateRiskLevel(currentState.totalBalance, currentState.upcomingBills);
        const newRisk = calculateRiskLevel(newBalance, currentState.upcomingBills);

        return {
            success: true,
            scenario: "income",
            amount: incomeAmount,
            current: {
                balance: currentState.totalBalance,
                dailyAllowance: currentState.dailyAllowance,
                riskLevel: currentRisk,
            },
            projected: {
                balance: newBalance,
                dailyAllowance: newDailyAllowance,
                riskLevel: newRisk,
                safeToSave,
            },
            impact: {
                balanceIncrease: incomeAmount,
                allowanceIncrease: newDailyAllowance - currentState.dailyAllowance,
                riskImprovement: newRisk !== currentRisk ? `${currentRisk} → ${newRisk}` : "No change",
            },
            recommendation: generateIncomeRecommendation(incomeAmount, safeToSave, newBalance),
        };
    } catch (error) {
        console.error("Error simulating income:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Compare multiple scenarios side-by-side
 */
export async function compareScenarios(userId, scenarios) {
    try {
        const results = [];

        for (const scenario of scenarios) {
            let result;

            switch (scenario.type) {
                case "spending":
                    result = await simulateSpending(userId, scenario.amount, scenario.category);
                    break;
                case "saving":
                    result = await simulateSaving(userId, scenario.amount);
                    break;
                case "income":
                    result = await simulateIncome(userId, scenario.amount);
                    break;
                default:
                    continue;
            }

            if (result.success) {
                results.push({
                    name: scenario.name || `${scenario.type} ₹${scenario.amount}`,
                    ...result,
                });
            }
        }

        // Find best scenario
        const bestScenario = results.reduce((best, current) => {
            const currentScore = calculateScenarioScore(current);
            const bestScore = calculateScenarioScore(best);
            return currentScore > bestScore ? current : best;
        }, results[0]);

        return {
            success: true,
            scenarios: results,
            bestScenario: bestScenario?.name,
            comparison: generateComparison(results),
        };
    } catch (error) {
        console.error("Error comparing scenarios:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Calculate financial impact of a decision
 */
export async function calculateImpact(userId, decision) {
    try {
        const { type, amount, timeframe = "month" } = decision;

        let result;
        switch (type) {
            case "spending":
                result = await simulateSpending(userId, amount);
                break;
            case "saving":
                result = await simulateSaving(userId, amount);
                break;
            case "income":
                result = await simulateIncome(userId, amount);
                break;
            default:
                return { success: false, error: "Invalid decision type" };
        }

        if (!result.success) return result;

        // Calculate timeframe impact
        const multiplier = timeframe === "year" ? 12 : timeframe === "week" ? 0.25 : 1;
        const totalImpact = amount * multiplier;

        return {
            success: true,
            decision,
            immediateImpact: result.impact,
            timeframeImpact: {
                period: timeframe,
                totalAmount: totalImpact,
                balanceChange: type === "income" ? totalImpact : -totalImpact,
            },
            visualization: generateImpactVisualization(result, timeframe),
        };
    } catch (error) {
        console.error("Error calculating impact:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Get current financial state
 */
async function getCurrentFinancialState(userId) {
    const accounts = await prisma.account.findMany({ where: { userId } });
    const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);

    // Get upcoming bills
    const today = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const bills = await prisma.bill.findMany({
        where: {
            userId,
            isActive: true,
            nextDueDate: {
                gte: today,
                lte: sevenDaysFromNow,
            },
        },
    });

    const upcomingBills = bills.reduce((sum, bill) => sum + Number(bill.amount), 0);

    // Estimate days until income
    const daysUntilIncome = 15; // Simplified assumption

    const dailyAllowance = calculateDailyAllowance(totalBalance, upcomingBills, daysUntilIncome);

    return {
        totalBalance,
        upcomingBills,
        daysUntilIncome,
        dailyAllowance,
    };
}

/**
 * Calculate daily allowance
 */
function calculateDailyAllowance(balance, upcomingBills, daysUntilIncome) {
    const safetyBuffer = Math.max(balance * 0.1, 1000);
    const available = balance - safetyBuffer - upcomingBills;
    return Math.max(0, Math.round(available / daysUntilIncome));
}

/**
 * Calculate risk level
 */
function calculateRiskLevel(balance, upcomingBills) {
    if (balance < upcomingBills) return "critical";
    if (balance < upcomingBills * 1.5) return "high";
    if (balance < upcomingBills * 2) return "medium";
    return "low";
}

/**
 * Calculate savings impact
 */
async function calculateSavingsImpact(userId, spendingAmount) {
    try {
        const goals = await prisma.goal.findMany({
            where: { userId, status: "active" },
        });

        if (goals.length === 0) return "No active savings goals";

        const totalGoalAmount = goals.reduce((sum, g) => sum + Number(g.targetAmount - g.savedAmount), 0);
        const percentageOfGoal = (spendingAmount / totalGoalAmount) * 100;

        return `This spending represents ${percentageOfGoal.toFixed(1)}% of your remaining savings goals`;
    } catch (error) {
        return "Unable to calculate savings impact";
    }
}

/**
 * Generate spending recommendation
 */
function generateSpendingRecommendation(newBalance, newRisk, currentState) {
    if (newRisk === "critical") {
        return "⚠️ Not recommended - This would put you at critical risk";
    } else if (newRisk === "high") {
        return "⚠️ Proceed with caution - This increases your financial risk";
    } else if (newBalance > currentState.upcomingBills * 2) {
        return "✅ Safe to proceed - You have sufficient buffer";
    } else {
        return "⚡ Consider carefully - This is within limits but reduces your flexibility";
    }
}

/**
 * Generate saving recommendation
 */
function generateSavingRecommendation(amount, newBalance, currentState) {
    if (newBalance < currentState.upcomingBills) {
        return "⚠️ Not recommended - This may affect bill payments";
    } else if (amount > currentState.dailyAllowance * 7) {
        return "⚡ Ambitious - This is more than a week's allowance";
    } else {
        return "✅ Great choice - Building savings is always smart";
    }
}

/**
 * Generate income recommendation
 */
function generateIncomeRecommendation(amount, safeToSave, newBalance) {
    if (safeToSave > amount * 0.5) {
        return `✅ Consider saving ₹${Math.round(safeToSave)} from this income`;
    } else if (newBalance > 10000) {
        return "✅ Good opportunity to build your emergency fund";
    } else {
        return "⚡ Use this to cover essential expenses first";
    }
}

/**
 * Calculate scenario score
 */
function calculateScenarioScore(scenario) {
    let score = 0;

    // Prefer lower risk
    const riskScores = { low: 40, medium: 20, high: 10, critical: 0 };
    score += riskScores[scenario.projected.riskLevel] || 0;

    // Prefer higher balance
    score += Math.min(40, scenario.projected.balance / 1000);

    // Prefer higher daily allowance
    score += Math.min(20, scenario.projected.dailyAllowance / 10);

    return score;
}

/**
 * Generate comparison summary
 */
function generateComparison(scenarios) {
    return scenarios.map(s => ({
        name: s.name,
        finalBalance: s.projected.balance,
        riskLevel: s.projected.riskLevel,
        dailyAllowance: s.projected.dailyAllowance,
    }));
}

/**
 * Generate impact visualization data
 */
function generateImpactVisualization(result, timeframe) {
    const periods = timeframe === "year" ? 12 : timeframe === "week" ? 7 : 30;

    return {
        chartType: "line",
        data: Array.from({ length: periods }, (_, i) => ({
            period: i + 1,
            balance: result.projected.balance,
            allowance: result.projected.dailyAllowance,
        })),
    };
}
