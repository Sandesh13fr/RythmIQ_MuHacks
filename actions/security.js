"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { getSafetyState, resetAutopilot } from "@/lib/security/agent-watchdog";
import { logSecurityEvent } from "@/lib/security/action-guard";

async function requireUser() {
    const { userId } = await auth();
    if (!userId) {
        throw new Error("Unauthorized");
    }

    const user = await db.user.findUnique({
        where: { clerkUserId: userId },
        select: { id: true, email: true, name: true },
    });

    if (!user) {
        throw new Error("User not found");
    }

    return { clerkUserId: userId, user };
}

export async function fetchSafetyState() {
    try {
        const { user } = await requireUser();
        const state = await getSafetyState(user.id);
        return { success: true, state };
    } catch (error) {
        console.error("Fetch safety state error:", error);
        return { success: false, error: error.message };
    }
}

export async function unlockAutopilot(note = "user_acknowledged") {
    try {
        const { clerkUserId, user } = await requireUser();
        await resetAutopilot(user.id, { actor: "user", note });
        await logSecurityEvent({
            clerkUserId,
            actorType: "user",
            action: "autopilot_unlock",
            context: { note },
            otpVerified: false,
        });
        return { success: true };
    } catch (error) {
        console.error("Unlock autopilot error:", error);
        return { success: false, error: error.message };
    }
}
