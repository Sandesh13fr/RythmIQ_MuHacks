import { inngest } from "../client";
import { db } from "@/lib/prisma";
import { generateDailyBriefing } from "@/lib/daily-briefing";
import { generateCashFlowForecast } from "@/lib/agents/predictive-agent";
import { sanitizeAIResponse } from "@/lib/security/sanitize-ai";

/**
 * Daily Morning Briefing
 * Runs every day at 9 AM
 * Generates personalized financial briefing for each user with predictive forecast
 */
export const dailyMorningBriefing = inngest.createFunction(
    { id: "daily-morning-briefing" },
    { cron: "0 9 * * *" }, // Every day at 9 AM
    async ({ step }) => {
        // Get all users
        const users = await step.run("fetch-users", async () => {
            return await db.user.findMany({
                include: {
                    transactions: {
                        orderBy: { date: "desc" },
                        take: 100,
                    },
                    accounts: true,
                },
            });
        });

        console.log(`Generating briefings for ${users.length} users`);

        // Generate briefing for each user
        for (const user of users) {
            await step.run(`briefing-${user.id}`, async () => {
                try {
                    const briefing = await generateDailyBriefing(user.clerkUserId);

                    // Generate predictive forecast to include in briefing
                    let forecast = null;
                    if (user.transactions && user.transactions.length > 0) {
                        try {
                            const totalBalance = user.accounts.reduce(
                                (sum, acc) => sum + Number(acc.balance),
                                0
                            );

                            const currentMonth = new Date();
                            const daysIntoMonth = currentMonth.getDate();
                            currentMonth.setDate(1);
                            currentMonth.setHours(0, 0, 0, 0);

                            const monthlyTransactions = user.transactions.filter(
                                (tx) => new Date(tx.date) >= currentMonth
                            );

                            const monthlyIncome = monthlyTransactions
                                .filter((tx) => tx.type === "INCOME")
                                .reduce((sum, tx) => sum + Number(tx.amount), 0);

                            const monthlyExpenses = monthlyTransactions
                                .filter((tx) => tx.type === "EXPENSE")
                                .reduce((sum, tx) => sum + Number(tx.amount), 0);

                            const savingsRate =
                                monthlyIncome > 0
                                    ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100
                                    : 0;

                            const userFinancialData = {
                                totalBalance,
                                monthlyIncome,
                                monthlyExpenses,
                                savingsRate: savingsRate.toFixed(1),
                                daysIntoMonth,
                            };

                            const forecastResult = await generateCashFlowForecast(
                                user.id,
                                userFinancialData,
                                user.transactions
                            );

                            if (forecastResult.success) {
                                forecast = forecastResult.forecast;
                            }
                        } catch (forecastError) {
                            console.warn(`Forecast generation failed for user ${user.id}:`, forecastError);
                        }
                    }

                    if (briefing) {
                        // Combine briefing with forecast
                        const briefingWithForecast = {
                            ...briefing,
                            forecast: forecast ? {
                                riskLevel: forecast.risk_level,
                                summary: sanitizeAIResponse(forecast.summary),
                                predictedBalance: forecast.predicted_balance_day_30,
                                confidence: forecast.confidence,
                                criticalDates: forecast.critical_dates?.slice(0, 2) || [],
                                recommendedActions: forecast.recommended_actions?.slice(0, 2).map(sanitizeAIResponse) || [],
                            } : null,
                        };

                        // Store briefing in database for user to see
                        await db.insight.create({
                            data: {
                                userId: user.id,
                                type: "DAILY_BRIEFING",
                                content: JSON.stringify(briefingWithForecast),
                                action: "BRIEFING_SENT",
                            },
                        });

                        console.log(`Briefing created for ${user.email}`);
                    }
                } catch (error) {
                    console.error(`Error generating briefing for user ${user.id}:`, error);
                }
            });
        }

        return { success: true, count: users.length };
    }
);
