import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { calculateNudgeEffectiveness, getEffectivenessTrends } from "@/lib/services/feedback-service";

/**
 * GET /api/analytics/nudge-effectiveness
 * Get nudge effectiveness metrics and trends
 */
export async function GET(request) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const days = parseInt(searchParams.get("days") || "30");
        const includeTrends = searchParams.get("trends") === "true";

        // Get effectiveness metrics
        const effectiveness = await calculateNudgeEffectiveness(userId, days);

        if (!effectiveness.success) {
            return NextResponse.json(
                { error: effectiveness.error },
                { status: 500 }
            );
        }

        let response = {
            success: true,
            effectiveness: effectiveness,
        };

        // Optionally include trends
        if (includeTrends) {
            const weeks = Math.ceil(days / 7);
            const trends = await getEffectivenessTrends(userId, weeks);
            response.trends = trends;
        }

        return NextResponse.json(response);
    } catch (error) {
        console.error("Error in effectiveness endpoint:", error);
        return NextResponse.json(
            { error: "Failed to get effectiveness metrics" },
            { status: 500 }
        );
    }
}
