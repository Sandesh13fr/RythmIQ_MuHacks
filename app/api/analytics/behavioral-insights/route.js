import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getBehavioralInsights } from "@/lib/services/feedback-service";
import { getPersonalizationSummary } from "@/lib/services/personalization-engine";

/**
 * GET /api/analytics/behavioral-insights
 * Get behavioral insights and personalization data for the user
 */
export async function GET(request) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get behavioral insights
        const insights = await getBehavioralInsights(userId);

        if (!insights.success) {
            return NextResponse.json(
                { error: insights.error },
                { status: 500 }
            );
        }

        // Get personalization summary
        const personalization = await getPersonalizationSummary(userId);

        return NextResponse.json({
            success: true,
            insights: insights.insights,
            personalization: personalization.success ? personalization : null,
        });
    } catch (error) {
        console.error("Error in behavioral insights endpoint:", error);
        return NextResponse.json(
            { error: "Failed to get behavioral insights" },
            { status: 500 }
        );
    }
}
