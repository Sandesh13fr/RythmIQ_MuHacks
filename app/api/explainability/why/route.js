import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
    explainNudge,
    explainSpendingAllowance,
    explainRiskScore
} from "@/lib/services/explainability-service";

/**
 * POST /api/explainability/why - Explain AI decisions
 */

export async function POST(request) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { type, id } = await request.json();

        let result;
        switch (type) {
            case "nudge":
                if (!id) {
                    return NextResponse.json(
                        { success: false, error: "Nudge ID required" },
                        { status: 400 }
                    );
                }
                result = await explainNudge(id, userId);
                break;

            case "allowance":
                result = await explainSpendingAllowance(userId);
                break;

            case "risk":
                result = await explainRiskScore(userId);
                break;

            default:
                return NextResponse.json(
                    { success: false, error: "Invalid type. Use: nudge, allowance, or risk" },
                    { status: 400 }
                );
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error("Error in POST /api/explainability/why:", error);
        return NextResponse.json(
            { success: false, error: "Failed to generate explanation" },
            { status: 500 }
        );
    }
}
