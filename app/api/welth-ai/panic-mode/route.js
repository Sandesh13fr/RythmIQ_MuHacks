import { NextResponse } from "next/server";
import { checkUser } from "@/lib/checkUser";
import { db } from "@/lib/prisma";
import {
    shouldActivatePanicMode,
    generateEmergencyPlan,
    activatePanicMode,
    deactivatePanicMode,
    getPanicModeStatus,
} from "@/lib/agents/panic-mode-agent";
import { createNudge } from "@/actions/nudge-actions";

/**
 * Panic Mode Endpoints
 */

/**
 * GET /api/RythmIQ-ai/panic-mode/status
 * Check if panic mode should be activated
 */
export async function GET(req) {
    try {
        const user = await checkUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get current panic mode status
        const currentStatus = getPanicModeStatus(user.id);

        // Fetch financial data
        const [transactions, accounts] = await Promise.all([
            db.transaction.findMany({
                where: { userId: user.id },
                orderBy: { date: "desc" },
                take: 100,
            }),
            db.account.findMany({
                where: { userId: user.id },
            }),
        ]);

        const balance = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);

        // Calculate daily rates
        const currentMonth = new Date();
        currentMonth.setDate(1);
        currentMonth.setHours(0, 0, 0, 0);

        const monthlyTransactions = transactions.filter(
            (tx) => new Date(tx.date) >= currentMonth
        );

        const monthlyIncome = monthlyTransactions
            .filter((tx) => tx.type === "INCOME")
            .reduce((sum, tx) => sum + Number(tx.amount), 0);

        const monthlyExpenses = monthlyTransactions
            .filter((tx) => tx.type === "EXPENSE")
            .reduce((sum, tx) => sum + Number(tx.amount), 0);

        const dailyExpenseRate = monthlyExpenses / 30;
        const dailyIncomeRate = monthlyIncome / 30;

        // Check if panic mode should activate
        const panicCheck = shouldActivatePanicMode({
            balance,
            dailyExpenseRate,
            dailyIncomeRate,
            monthlyIncome,
            monthlyExpenses,
        });

        return NextResponse.json({
            success: true,
            currentStatus: currentStatus.active,
            shouldActivate: panicCheck.shouldActivate,
            trigger: panicCheck.trigger,
            reason: panicCheck.reason,
            urgency: panicCheck.urgency,
            daysToZero: panicCheck.daysToZero,
            balance,
        });
    } catch (error) {
        console.error("Error checking panic mode status:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

/**
 * POST /api/RythmIQ-ai/panic-mode/activate
 * Activate panic mode and generate emergency plan
 */
export async function POST(req) {
    try {
        const user = await checkUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Fetch financial data
        const [transactions, accounts] = await Promise.all([
            db.transaction.findMany({
                where: { userId: user.id },
                orderBy: { date: "desc" },
                take: 100,
            }),
            db.account.findMany({
                where: { userId: user.id },
            }),
        ]);

        const balance = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);

        const currentMonth = new Date();
        currentMonth.setDate(1);
        currentMonth.setHours(0, 0, 0, 0);

        const monthlyTransactions = transactions.filter(
            (tx) => new Date(tx.date) >= currentMonth
        );

        const monthlyIncome = monthlyTransactions
            .filter((tx) => tx.type === "INCOME")
            .reduce((sum, tx) => sum + Number(tx.amount), 0);

        const monthlyExpenses = monthlyTransactions
            .filter((tx) => tx.type === "EXPENSE")
            .reduce((sum, tx) => sum + Number(tx.amount), 0);

        const dailyExpenseRate = monthlyExpenses / 30;
        const dailyIncomeRate = monthlyIncome / 30;
        const netDailyRate = dailyIncomeRate - dailyExpenseRate;
        const daysToZero = netDailyRate < 0 ? Math.abs(balance / netDailyRate) : null;

        // Generate emergency plan
        const emergencyPlanResult = await generateEmergencyPlan(user.id, {
            balance,
            monthlyIncome,
            monthlyExpenses,
            transactions,
            daysToZero,
        });

        // Activate panic mode
        activatePanicMode(user.id, "MANUAL", emergencyPlanResult.plan);

        // Create nudges for immediate actions so the user can accept or auto-execute
        if (emergencyPlanResult.plan?.immediate_actions) {
            for (const act of emergencyPlanResult.plan.immediate_actions) {
                await createNudge({
                    type: "emergency-buffer",
                    amount: 0,
                    message: act.action,
                    reason: act.impact || "Emergency action",
                    priority: 10,
                    metadata: { emergency: true },
                });
            }
        }

        return NextResponse.json({
            success: true,
            message: "Panic mode activated",
            emergencyPlan: emergencyPlanResult.plan,
            balance,
            daysToZero: daysToZero ? Math.round(daysToZero) : null,
        });
    } catch (error) {
        console.error("Error activating panic mode:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/RythmIQ-ai/panic-mode/deactivate
 * Deactivate panic mode
 */
export async function DELETE(req) {
    try {
        const user = await checkUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        deactivatePanicMode(user.id);

        return NextResponse.json({
            success: true,
            message: "Panic mode deactivated",
        });
    } catch (error) {
        console.error("Error deactivating panic mode:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
