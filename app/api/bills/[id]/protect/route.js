import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { protectBillEnvelope } from "@/lib/auto-guards";
import { enforceHighValueGuard } from "@/lib/security/action-guard";

export async function POST(request, { params }) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const billId = params.id;
        const body = await request.json().catch(() => ({}));
        const amount = body?.amount ? Number(body.amount) : undefined;
        const guard = await enforceHighValueGuard({
            clerkUserId: userId,
            action: "bill_protect",
            amount,
            otpCode: body?.otp,
        });

        if (!guard.verified) {
            return NextResponse.json(
                {
                    success: false,
                    requiresOtp: true,
                    expiresAt: guard.expiresAt,
                    message: "OTP verification required for this protection request.",
                    devOtp: guard.devOtp,
                },
                { status: 202 }
            );
        }

        const envelope = await protectBillEnvelope({ clerkUserId: userId, billId, amount });

        return NextResponse.json({ success: true, envelope });
    } catch (error) {
        console.error("Error in POST /api/bills/[id]/protect:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
}
