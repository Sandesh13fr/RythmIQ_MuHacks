import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
    simulateSpending,
    simulateSaving,
    simulateIncome
} from "@/lib/services/counterfactual-engine";

/**
 * POST /api/explainability/what-if - Run counterfactual scenarios
 */

export async function POST(request) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { scenario, amount, category } = await request.json();

        if (!scenario || !amount) {
            return NextResponse.json(
                { success: false, error: "Scenario and amount are required" },
                { status: 400 }
            );
        }

        let result;
        switch (scenario) {
            case "spending":
                result = await simulateSpending(userId, Number(amount), category);
                break;

            case "saving":
                result = await simulateSaving(userId, Number(amount));
                break;

            case "income":
                result = await simulateIncome(userId, Number(amount));
                break;

            default:
                return NextResponse.json(
                    { success: false, error: "Invalid scenario. Use: spending, saving, or income" },
                    { status: 400 }
                );
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error("Error in POST /api/explainability/what-if:", error);
        return NextResponse.json(
            { success: false, error: "Failed to run simulation" },
            { status: 500 }
        );
    }
}
