import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateDailyBriefing } from "@/lib/daily-briefing";
import { db } from "@/lib/prisma";

export async function GET() {
    try {
        const { userId } = await auth();

        if (!userId) {
            console.log("Daily Briefing: No userId from auth");
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        console.log("Daily Briefing: Generating for user", userId);

        // Generate new briefing (skip database caching for now)
        const briefing = await generateDailyBriefing(userId);

        if (!briefing) {
            console.log("Daily Briefing: Generation failed");
            return NextResponse.json({ error: "Failed to generate briefing" }, { status: 500 });
        }

        console.log("Daily Briefing: Success");
        return NextResponse.json(briefing);
    } catch (error) {
        console.error("Daily Briefing API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
