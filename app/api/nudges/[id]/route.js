import { NextResponse } from "next/server";
import { acceptNudge, rejectNudge } from "@/actions/nudge-actions";

export async function POST(request, { params }) {
    try {
        const { id } = params;
        const body = await request.json();
        const { action } = body;

        if (action === "accept") {
            const result = await acceptNudge(id);
            return NextResponse.json(result);
        }

        if (action === "reject") {
            const result = await rejectNudge(id);
            return NextResponse.json(result);
        }

        return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    } catch (error) {
        console.error("Nudge Action Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
