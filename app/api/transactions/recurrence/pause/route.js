import { checkUser } from "@/lib/checkUser";
import { db } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req) {
    try {
        const user = await checkUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const nonEssential = ["Entertainment", "Shopping", "Dining", "Leisure", "Subscriptions"];

        const updated = await db.transaction.updateMany({
            where: { userId: user.id, isRecurring: true, category: { in: nonEssential } },
            data: { recurrencePaused: true },
        });

        return NextResponse.json({ success: true, updated: updated.count });
    } catch (error) {
        console.error("Pause Recurrence Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
