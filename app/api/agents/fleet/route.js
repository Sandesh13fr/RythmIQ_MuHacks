import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { getAgentFleetSnapshot } from "@/lib/agents/master-agent";

export async function GET() {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { clerkUserId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "User profile missing" }, { status: 404 });
    }

    const snapshot = await getAgentFleetSnapshot({ userId: user.id, clerkUserId });
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("Agent fleet API error", error);
    return NextResponse.json(
      { success: false, error: error.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
