import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { collectFeedback } from "@/lib/services/feedback-service";

/**
 * POST /api/nudges/[id]/feedback
 * Collect user feedback for a specific nudge
 */
export async function POST(request, { params }) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const nudgeId = params.id;
        const body = await request.json();

        const { rating, comment, wasHelpful, dismissReason } = body;

        // Validate input
        if (rating && (rating < 1 || rating > 5)) {
            return NextResponse.json(
                { error: "Rating must be between 1 and 5" },
                { status: 400 }
            );
        }

        // Collect feedback
        const result = await collectFeedback(nudgeId, userId, {
            rating,
            comment,
            wasHelpful,
            dismissReason,
        });

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Feedback collected successfully",
            nudge: result.nudge,
        });
    } catch (error) {
        console.error("Error in feedback endpoint:", error);
        return NextResponse.json(
            { error: "Failed to collect feedback" },
            { status: 500 }
        );
    }
}
