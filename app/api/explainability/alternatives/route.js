import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getAlternativeActions } from "@/lib/services/explainability-service";

/**
 * GET /api/explainability/alternatives - Get alternative actions
 */

export async function GET(request) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const nudgeId = searchParams.get("nudgeId");

        if (!nudgeId) {
            return NextResponse.json(
                { success: false, error: "nudgeId parameter required" },
                { status: 400 }
            );
        }

        const result = await getAlternativeActions(nudgeId, userId);
        return NextResponse.json(result);
    } catch (error) {
        console.error("Error in GET /api/explainability/alternatives:", error);
        return NextResponse.json(
            { success: false, error: "Failed to get alternatives" },
            { status: 500 }
        );
    }
}
