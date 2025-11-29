import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { indexUserTransactions, initVectorStore } from "@/lib/rag/vector-store";

/**
 * Index user transactions into vector store
 * POST /api/RythmIQ-ai/index
 */
export async function POST(req) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Get user and transactions
        const user = await db.user.findUnique({
            where: { clerkUserId: userId },
            include: {
                transactions: {
                    orderBy: { date: "desc" },
                },
            },
        });

        if (!user) {
            return NextResponse.json(
                { success: false, error: "User not found" },
                { status: 404 }
            );
        }

        // Initialize vector store
        await initVectorStore();

        // Index transactions
        const ids = await indexUserTransactions(user.id, user.transactions);

        return NextResponse.json({
            success: true,
            message: `Indexed ${ids.length} transactions`,
            count: ids.length,
        });
    } catch (error) {
        console.error("Error indexing transactions:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

/**
 * Get vector store status
 * GET /api/RythmIQ-ai/index
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

        // Get user's transaction count
        const user = await db.user.findUnique({
            where: { clerkUserId: userId },
            select: {
                _count: {
                    select: { transactions: true }
                }
            }
        });

        if (!user) {
            return NextResponse.json(
                { success: false, error: "User not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            status: "ready",
            transactionCount: user._count.transactions,
            message: `${user._count.transactions} transactions available for RAG`
        });
    } catch (error) {
        console.error("Error getting vector store status:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
