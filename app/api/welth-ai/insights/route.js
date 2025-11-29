import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { generateSmartInsights } from "@/lib/rag/langchain-rag";
import { sanitizeInsights } from "@/lib/security/sanitize-ai";
import { checkRateLimit } from "@/lib/security/rate-limiter";

/**
 * RAG-powered smart insights endpoint
 * GET /api/RythmIQ-ai/insights
 */
export async function GET(req) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Check rate limit
        const rateLimitCheck = checkRateLimit(userId, "/api/RythmIQ-ai/insights");
        if (rateLimitCheck.exceeded) {
            return NextResponse.json(rateLimitCheck.response, {
                status: 429,
                headers: rateLimitCheck.headers,
            });
        }

        // Get user's financial data
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

        if (!user) {
            return NextResponse.json(
                { success: false, error: "User not found" },
                { status: 404 }
            );
        }

        // Calculate financial metrics
        const totalBalance = user.accounts.reduce(
            (sum, acc) => sum + acc.balance.toNumber(),
            0
        );

        const currentMonth = new Date();
        currentMonth.setDate(1);
        currentMonth.setHours(0, 0, 0, 0);

        const monthlyTransactions = user.transactions.filter(
            (tx) => new Date(tx.date) >= currentMonth
        );

        const monthlyIncome = monthlyTransactions
            .filter((tx) => tx.type === "INCOME")
            .reduce((sum, tx) => sum + tx.amount.toNumber(), 0);

        const monthlyExpenses = monthlyTransactions
            .filter((tx) => tx.type === "EXPENSE")
            .reduce((sum, tx) => sum + tx.amount.toNumber(), 0);

        const savingsRate =
            monthlyIncome > 0
                ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100
                : 0;

        // Generate RAG-powered insights
        const userFinancialData = {
            totalBalance,
            monthlyIncome,
            monthlyExpenses,
            savingsRate: savingsRate.toFixed(1),
        };

        const result = await generateSmartInsights(user.id, userFinancialData);

        // Sanitize insights before returning
        if (result.success && result.insights) {
            result.insights = sanitizeInsights(result.insights);
        }

        return NextResponse.json(result, { headers: rateLimitCheck.headers });
    } catch (error) {
        console.error("Error generating insights:", error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || "Failed to generate insights",
                insights: [],
            },
            { status: 500 }
        );
    }
}
