import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getLatestRiskSnapshot, generateRiskSnapshot } from "@/lib/risk-engine";

const SNAPSHOT_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours

export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const latest = await getLatestRiskSnapshot(userId);
        if (latest && Date.now() - new Date(latest.createdAt).getTime() < SNAPSHOT_TTL_MS) {
            return NextResponse.json({ success: true, snapshot: latest });
        }

        const snapshot = await generateRiskSnapshot(userId);
        if (!snapshot) {
            return NextResponse.json({ success: false, error: "No data to compute risk" }, { status: 404 });
        }

        return NextResponse.json({ success: true, snapshot });
    } catch (error) {
        console.error("Error in GET /api/analytics/risk:", error);
        return NextResponse.json({ error: "Failed to load risk" }, { status: 500 });
    }
}
