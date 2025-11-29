import { db } from "@/lib/prisma";

/**
 * Generate Daily AI Briefing
 * Analyzes user's financial status and creates actionable insights
 */
export async function generateDailyBriefing(userId) {
    try {
        // 1. Get user data
        const user = await db.user.findUnique({
            where: { clerkUserId: userId },
            include: {
                accounts: true,
                transactions: {
                    orderBy: { date: "desc" },
                    take: 100,
                },
                budgets: true,
            },
        });

        if (!user) return null;

        // 2. Calculate key metrics
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        // Total balance
        const totalBalance = user.accounts.reduce(
            (sum, acc) => sum + parseFloat(acc.balance),
            0
        );

        // This month's expenses
        const monthExpenses = user.transactions
            .filter(
                (t) =>
                    t.type === "EXPENSE" &&
                    new Date(t.date) >= startOfMonth &&
                    new Date(t.date) <= today
            )
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);

        // Budget status
        const budget = user.budgets[0];
        const budgetRemaining = budget
            ? parseFloat(budget.amount) - monthExpenses
            : 0;

        // Debug logging
        console.log("📊 Daily Briefing Calculation:", {
            totalBalance,
            monthExpenses,
            budgetAmount: budget ? parseFloat(budget.amount) : 0,
            budgetRemaining,
            accountCount: user.accounts.length,
            transactionCount: user.transactions.length,
            expenseTransactions: user.transactions.filter(t => t.type === "EXPENSE" && new Date(t.date) >= startOfMonth).length,
        });

        // Upcoming recurring bills
        const upcomingBills = user.transactions.filter(
            (t) =>
                t.isRecurring &&
                t.type === "EXPENSE" &&
                t.nextRecurringDate &&
                new Date(t.nextRecurringDate) <= new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
        );

        // Days left in month
        const daysInMonth = new Date(
            today.getFullYear(),
            today.getMonth() + 1,
            0
        ).getDate();
        const daysLeft = daysInMonth - today.getDate();

        // Daily allowance
        const dailyAllowance = daysLeft > 0 ? budgetRemaining / daysLeft : 0;

        // 3. Create greeting
        const greeting = `Good morning! You have ₹${totalBalance.toFixed(0)} total balance. You can safely spend ₹${dailyAllowance.toFixed(0)} today while staying on budget.`;

        // 4. Create briefing object
        const briefing = {
            greeting,
            metrics: {
                totalBalance,
                dailyAllowance,
                budgetRemaining,
                monthExpenses,
            },
            alerts: [],
            actions: [],
        };

        // 5. Add alerts
        if (budgetRemaining < 0) {
            briefing.alerts.push({
                type: "danger",
                message: `Over budget by ₹${Math.abs(budgetRemaining).toFixed(0)}`,
            });
        }

        if (upcomingBills.length > 0) {
            const nextBill = upcomingBills[0];
            briefing.alerts.push({
                type: "info",
                message: `${nextBill.description} (₹${parseFloat(nextBill.amount).toFixed(0)}) due soon`,
            });
        }

        if (dailyAllowance < 500) {
            briefing.alerts.push({
                type: "warning",
                message: "Low daily allowance. Consider reducing spending.",
            });
        }

        // 6. Add suggested actions
        if (totalBalance > 20000 && budgetRemaining > 5000) {
            briefing.actions.push({
                id: "auto-save",
                label: "Auto-save ₹2000 to savings",
                type: "save",
            });
        }

        if (upcomingBills.length > 0) {
            briefing.actions.push({
                id: "auto-pay",
                label: `Auto-pay ${upcomingBills[0].description}`,
                type: "pay",
                billId: upcomingBills[0].id,
            });
        }

        return briefing;
    } catch (error) {
        console.error("Daily Briefing Error:", error);
        return null;
    }
}
