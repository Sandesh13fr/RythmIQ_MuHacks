import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { markBillAsPaid } from "@/lib/services/bill-tracking-service";

/**
 * POST /api/bills/[id]/pay - Mark bill as paid
 */

export async function POST(request, { params }) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const billId = params.id;
        const result = await markBillAsPaid(billId, userId);

        return NextResponse.json(result);
    } catch (error) {
        console.error("Error in POST /api/bills/[id]/pay:", error);
        return NextResponse.json(
            { success: false, error: "Failed to mark bill as paid" },
            { status: 500 }
        );
    }
}
