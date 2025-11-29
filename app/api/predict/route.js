import { checkUser } from "@/lib/checkUser";
import { db } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { predictCashFlow, calculateRiskScore } from "@/lib/predictions";

export async function POST(req) {
    try {
        const user = await checkUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { days = 7 } = await req.json().catch(() => ({}));

        // Fetch transactions
        const transactions = await db.transaction.findMany({
            where: { userId: user.id },
            orderBy: { date: "desc" },
            take: 200,
        });

        // Fetch accounts
        const accounts = await db.account.findMany({
            where: { userId: user.id }
        });

        // Run enhanced prediction
        const result = predictCashFlow(transactions, accounts, days);

        // Calculate risk score
        const currentBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);
        const riskScore = calculateRiskScore(result.predictions, currentBalance);

        // Find minimum predicted balance
        const minPredicted = Math.min(...result.predictions.map(p => p.predicted));

        return NextResponse.json({
            success: true,
            forecast: result.predictions,
            trend: result.trend,
            trendRate: result.trendRate,
            confidence: result.confidence,
            risk: riskScore,
            minPredicted,
            metadata: result.metadata,
        });

    } catch (error) {
        console.error("Prediction error:", error);
        return NextResponse.json({ error: "Failed to predict" }, { status: 500 });
    }
}
