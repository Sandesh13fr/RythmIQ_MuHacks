import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getUserBills, createBill } from "@/lib/services/bill-tracking-service";
import { db } from "@/lib/prisma";

/**
 * GET /api/bills - Get all bills for user
 * POST /api/bills - Create a new bill
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
        const includeInactive = searchParams.get("includeInactive") === "true";

        const result = await getUserBills(user.id, includeInactive);
        return NextResponse.json(result);
    } catch (error) {
        console.error("Error in GET /api/bills:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch bills" },
            { status: 500 }
        );
    }
}

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

        const body = await request.json();
        const { name, category, amount, dueDay, autoPayEnabled, detectedFrom, confidence } = body;

        // Validate required fields
        if (!name || !category || !amount || !dueDay) {
            return NextResponse.json(
                { success: false, error: "Missing required fields" },
                { status: 400 }
            );
        }

        const result = await createBill(user.id, {
            name,
            category,
            amount: Number(amount),
            dueDay: Number(dueDay),
            autoPayEnabled: autoPayEnabled || false,
            detectedFrom,
            confidence,
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error("Error in POST /api/bills:", error);
        return NextResponse.json(
            { success: false, error: "Failed to create bill" },
            { status: 500 }
        );
    }
}
