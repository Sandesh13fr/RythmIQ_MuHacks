import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { generateCoachResponse } from "@/lib/services/coach";

export async function POST(request) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const question = body?.question?.toString() || "";
        const locale = body?.locale || "en";

        if (!question.trim()) {
            return NextResponse.json({ success: false, error: "Question required" }, { status: 400 });
        }

        const answer = await generateCoachResponse({ clerkUserId: userId, question, locale });
        return NextResponse.json({ success: true, answer });
    } catch (error) {
        console.error("Mini coach error", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
