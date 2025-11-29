import { checkUser } from "@/lib/checkUser";
import { db } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { analyzeSubscriptions } from "@/lib/agents/subscription-agent";

export async function POST(req) {
    try {
        const user = await checkUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 1. Fetch recent transactions (last 90 days for better pattern detection)
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const transactions = await db.transaction.findMany({
            where: {
                userId: user.id,
                date: { gte: ninetyDaysAgo },
            },
            orderBy: { date: "desc" },
        });

        // 2. Fetch existing recurring transactions from DB (user created recurring entries)
        const existingSubscriptions = await db.transaction.findMany({
            where: { userId: user.id, isRecurring: true },
            orderBy: { nextRecurringDate: "asc" },
        });

        // 2. Fetch user context (income)
        // Calculate average monthly income from transactions
        const incomeTransactions = transactions.filter(t => t.type === "INCOME");
        const totalIncome = incomeTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
        const monthlyIncome = totalIncome / 3; // Approx for 90 days

        const userContext = {
            monthlyIncome: Math.round(monthlyIncome)
        };

        // 3. Run AI Analysis
        const analysis = await analyzeSubscriptions(transactions, userContext);

        // Map AI detected subscription entries to transactions where possible
        const detectedWithDetails = (analysis.detected_subscriptions || []).map((s) => ({
            ...s,
            matchedTransaction: transactions.find((t) => String(t.id) === String(s.transaction_id)) || null,
        }));

        return NextResponse.json({
            success: true,
            data: {
                ...analysis,
                existing_subscriptions: existingSubscriptions,
                detected_with_details: detectedWithDetails,
            }
        });

    } catch (error) {
        console.error("Subscription API Error:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
