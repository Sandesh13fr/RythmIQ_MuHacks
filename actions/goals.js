"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function getGoals() {
    try {
        const { userId } = await auth();
        if (!userId) throw new Error("Unauthorized");

        const user = await db.user.findUnique({ where: { clerkUserId: userId } });
        if (!user) throw new Error("User not found");

        const goals = await db.goal.findMany({ where: { userId: user.id }, orderBy: { priority: "desc" } });
        return { success: true, goals };
    } catch (error) {
        console.error("Get Goals Error:", error);
        return { success: false, error: error.message, goals: [] };
    }
}

export async function createGoal(goalData) {
    try {
        const { userId } = await auth();
        if (!userId) throw new Error("Unauthorized");

        const user = await db.user.findUnique({ where: { clerkUserId: userId } });
        if (!user) throw new Error("User not found");

        let targetDate = goalData.targetDate || null;
        if (targetDate && typeof targetDate === 'string') {
            targetDate = new Date(targetDate + 'T00:00:00.000Z');
        }

        const goal = await db.goal.create({
            data: {
                userId: user.id,
                name: goalData.name,
                targetAmount: goalData.targetAmount,
                savedAmount: goalData.savedAmount || 0,
                targetDate,
                priority: goalData.priority || 0,
                status: goalData.status || "active",
            },
        });

        revalidatePath("/dashboard");
        return { success: true, goal };
    } catch (error) {
        console.error("Create Goal Error:", error);
        return { success: false, error: error.message };
    }
}

export async function updateGoal(id, fields) {
    try {
        const { userId } = await auth();
        if (!userId) throw new Error("Unauthorized");

        const user = await db.user.findUnique({ where: { clerkUserId: userId } });
        if (!user) throw new Error("User not found");

        const goal = await db.goal.findUnique({ where: { id } });
        if (!goal || goal.userId !== user.id) throw new Error("Goal not found");

        if (fields.targetDate && typeof fields.targetDate === 'string') {
            fields.targetDate = new Date(fields.targetDate + 'T00:00:00.000Z');
        }

        const updated = await db.goal.update({ where: { id }, data: fields });
        revalidatePath("/dashboard");
        return { success: true, goal: updated };
    } catch (error) {
        console.error("Update Goal Error:", error);
        return { success: false, error: error.message };
    }
}

export async function deleteGoal(id) {
    try {
        const { userId } = await auth();
        if (!userId) throw new Error("Unauthorized");

        const user = await db.user.findUnique({ where: { clerkUserId: userId } });
        if (!user) throw new Error("User not found");

        const goal = await db.goal.findUnique({ where: { id } });
        if (!goal || goal.userId !== user.id) throw new Error("Goal not found");

        await db.goal.delete({ where: { id } });
        revalidatePath("/dashboard");
        return { success: true };
    } catch (error) {
        console.error("Delete Goal Error:", error);
        return { success: false, error: error.message };
    }
}

