import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getUpcomingBills } from "@/lib/services/bill-tracking-service";
import { db } from "@/lib/prisma";

/**
 * GET /api/bills/upcoming - Get upcoming bills
 */

export async function GET(request) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await db.user.findUnique({
            where: { clerkUserId: userId },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const { searchParams } = new URL(request.url);
        const days = parseInt(searchParams.get("days") || "7");

        const result = await getUpcomingBills(user.id, days);
        return NextResponse.json(result);
    } catch (error) {
        console.error("Error in GET /api/bills/upcoming:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch upcoming bills" },
            { status: 500 }
        );
    }
}
