"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function setAutoNudgeEnabled(enabled) {
    try {
        const { userId } = await auth();
        if (!userId) throw new Error("Unauthorized");

        const user = await db.user.findUnique({ where: { clerkUserId: userId } });
        if (!user) throw new Error("User not found");

        if (enabled) {
            const safetyState = await db.agentSafetyState.findUnique({ where: { userId: user.id } });
            if (safetyState?.autopilotLocked) {
                return { success: false, error: "Automations are locked pending review." };
            }
        }

        const profile = await db.financialProfile.upsert({
            where: { userId: user.id },
            update: { autoNudgeEnabled: enabled },
            create: { userId: user.id, autoNudgeEnabled: enabled },
        });

        revalidatePath("/nudges");
        revalidatePath("/dashboard");
        return { success: true, profile };
    } catch (error) {
        console.error("Set AutoNudge Error:", error);
        return { success: false, error: error.message };
    }
}

export async function getProfile() {
    try {
        const { userId } = await auth();
        if (!userId) throw new Error("Unauthorized");

        const user = await db.user.findUnique({ where: { clerkUserId: userId } });
        if (!user) throw new Error("User not found");

        const profile = await db.financialProfile.findUnique({ where: { userId: user.id } });
        return { success: true, profile };
    } catch (error) {
        console.error("Get Profile Error:", error);
        return { success: false, error: error.message };
    }
}
