import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { detectRecurringBills } from "@/lib/services/bill-detection-service";
import { db } from "@/lib/prisma";

/**
 * POST /api/bills/detect - Auto-detect recurring bills from transactions
 */

export async function POST(request) {
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

        const result = await detectRecurringBills(user.id);
        return NextResponse.json(result);
    } catch (error) {
        console.error("Error in POST /api/bills/detect:", error);
        return NextResponse.json(
            { success: false, error: "Failed to detect bills" },
            { status: 500 }
        );
    }
}
