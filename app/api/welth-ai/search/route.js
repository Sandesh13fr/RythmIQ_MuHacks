import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { smartTransactionSearch } from "@/lib/rag/langchain-rag";
import { checkRateLimit } from "@/lib/security/rate-limiter";

/**
 * Smart transaction search using natural language
 * POST /api/RythmIQ-ai/search
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

        // Check rate limit
        const rateLimitCheck = checkRateLimit(userId, "/api/RythmIQ-ai/search");
        if (rateLimitCheck.exceeded) {
            return NextResponse.json(rateLimitCheck.response, {
                status: 429,
                headers: rateLimitCheck.headers,
            });
        }

        const { query } = await req.json();

        if (!query || query.trim().length === 0) {
            return NextResponse.json(
                { success: false, error: "Search query is required" },
                { status: 400 }
            );
        }

        // Get user
        const user = await db.user.findUnique({
            where: { clerkUserId: userId },
        });

        if (!user) {
            return NextResponse.json(
                { success: false, error: "User not found" },
                { status: 404 }
            );
        }

        // Perform smart search
        const result = await smartTransactionSearch(user.id, query);

        return NextResponse.json(result, { headers: rateLimitCheck.headers });
    } catch (error) {
        console.error("Error in smart search:", error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || "Search failed",
                transactions: [],
            },
            { status: 500 }
        );
    }
}
