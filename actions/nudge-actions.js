"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { generateNudges, calculateNudgeImpact, NUDGE_TYPES } from "@/lib/nudge-engine";
import { protectBillEnvelope } from "@/lib/auto-guards";
import { adjustProfileFromBehavior } from "@/lib/behavior-engine";

// Helper to serialize Prisma Decimal to number
function serializeNudge(nudge) {
    return {
        ...nudge,
        amount: nudge.amount ? parseFloat(nudge.amount) : null,
        impact: nudge.impact ? parseFloat(nudge.impact) : null,
    };
}

export async function createNudge(nudgeData) {
    try {
        const { userId } = await auth();
        if (!userId) throw new Error("Unauthorized");

        const user = await db.user.findUnique({
            where: { clerkUserId: userId },
        });

        if (!user) throw new Error("User not found");

        const nudge = await db.nudgeAction.create({
            data: {
                userId: user.id,
                nudgeType: nudgeData.type,
                amount: nudgeData.amount,
                message: nudgeData.message,
                reason: nudgeData.reason,
                priority: nudgeData.priority || 0,
                expiresAt: nudgeData.expiresAt,
                metadata: nudgeData.metadata || {},
            },
        });

        // If user has auto-nudge enabled, accept it immediately
        const profile = await db.financialProfile.findUnique({ where: { userId: user.id } });
        if (profile?.autoNudgeEnabled) {
            try {
                // auto-accept
                const accepted = await acceptNudge(nudge.id);
                if (accepted?.success) {
                    return { success: true, nudge: serializeNudge(await db.nudgeAction.findUnique({ where: { id: nudge.id } })), autoAccepted: true };
                }
            } catch (err) {
                console.error("Auto accept failed:", err);
            }
        }

        revalidatePath("/dashboard");
        return { success: true, nudge: serializeNudge(nudge) };
    } catch (error) {
        console.error("Create Nudge Error:", error);
        return { success: false, error: error.message };
    }
}

export async function acceptNudge(nudgeId) {
    try {
        const { userId } = await auth();
        if (!userId) throw new Error("Unauthorized");

        const nudge = await db.nudgeAction.findUnique({
            where: { id: nudgeId },
            include: { user: true },
        });

        if (!nudge || nudge.user.clerkUserId !== userId) {
            throw new Error("Nudge not found");
        }

        if (nudge.status !== "pending") {
            throw new Error("Nudge already processed");
        }

        let executionResult = null;

        switch (nudge.nudgeType) {
            case NUDGE_TYPES.AUTO_SAVE:
                executionResult = await executeAutoSave(nudge);
                break;
            case NUDGE_TYPES.BILL_PAY:
                executionResult = await executeBillPay(nudge);
                break;
            case NUDGE_TYPES.BILL_GUARD:
                executionResult = await executeBillGuard(nudge);
                break;
            case NUDGE_TYPES.MICRO_SAVE:
                executionResult = await executeMicroSave(nudge);
                break;
            default:
                executionResult = { success: true };
        }

        if (!executionResult.success) {
            throw new Error(executionResult.error || "Execution failed");
        }

        const impact = calculateNudgeImpact(nudge.nudgeType, parseFloat(nudge.amount || 0));

        const updatedNudge = await db.nudgeAction.update({
            where: { id: nudgeId },
            data: {
                status: "executed",
                respondedAt: new Date(),
                executedAt: new Date(),
                impact,
            },
        });

        // Feature 4: Adjust profile based on behavior
        await adjustProfileFromBehavior(userId);

        revalidatePath("/dashboard");
        revalidatePath("/nudges");

        return { success: true, nudge: serializeNudge(updatedNudge), impact };
    } catch (error) {
        console.error("Accept Nudge Error:", error);
        return { success: false, error: error.message };
    }
}

export async function rejectNudge(nudgeId) {
    try {
        const { userId } = await auth();
        if (!userId) throw new Error("Unauthorized");

        const nudge = await db.nudgeAction.findUnique({
            where: { id: nudgeId },
            include: { user: true },
        });

        if (!nudge || nudge.user.clerkUserId !== userId) {
            throw new Error("Nudge not found");
        }

        const updatedNudge = await db.nudgeAction.update({
            where: { id: nudgeId },
            data: {
                status: "rejected",
                respondedAt: new Date(),
            },
        });

        // Feature 4: Adjust profile based on behavior
        await adjustProfileFromBehavior(userId);

        revalidatePath("/dashboard");
        revalidatePath("/nudges");

        return { success: true, nudge: serializeNudge(updatedNudge) };
    } catch (error) {
        console.error("Reject Nudge Error:", error);
        return { success: false, error: error.message };
    }
}

export async function getNudgeHistory(limit = 50) {
    try {
        const { userId } = await auth();
        if (!userId) throw new Error("Unauthorized");

        const user = await db.user.findUnique({
            where: { clerkUserId: userId },
        });

        if (!user) throw new Error("User not found");

        const nudges = await db.nudgeAction.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
            take: limit,
        });

        return { success: true, nudges: nudges.map(serializeNudge) };
    } catch (error) {
        console.error("Get Nudge History Error:", error);
        return { success: false, error: error.message, nudges: [] };
    }
}

export async function getNudgeMetrics() {
    try {
        const { userId } = await auth();
        if (!userId) throw new Error("Unauthorized");

        const user = await db.user.findUnique({
            where: { clerkUserId: userId },
        });

        if (!user) throw new Error("User not found");

        const allNudges = await db.nudgeAction.findMany({
            where: { userId: user.id },
        });

        const total = allNudges.length;
        const accepted = allNudges.filter((n) => n.status === "executed").length;
        const rejected = allNudges.filter((n) => n.status === "rejected").length;
        const pending = allNudges.filter((n) => n.status === "pending").length;

        const totalImpact = allNudges
            .filter((n) => n.impact)
            .reduce((sum, n) => sum + parseFloat(n.impact), 0);

        const acceptanceRate = total > 0 ? (accepted / total) * 100 : 0;

        return {
            success: true,
            metrics: {
                total,
                accepted,
                rejected,
                pending,
                acceptanceRate: acceptanceRate.toFixed(1),
                totalImpact: totalImpact.toFixed(0),
            },
        };
    } catch (error) {
        console.error("Get Nudge Metrics Error:", error);
        return { success: false, error: error.message };
    }
}

export async function generateAndCreateNudges() {
    try {
        const { userId } = await auth();
        if (!userId) throw new Error("Unauthorized");

        const nudges = await generateNudges(userId);

        const created = [];
        for (const nudgeData of nudges) {
            const result = await createNudge(nudgeData);
            if (result.success) {
                created.push(result.nudge);
            }
        }

        return { success: true, nudges: created };
    } catch (error) {
        console.error("Generate Nudges Error:", error);
        return { success: false, error: error.message };
    }
}

async function executeAutoSave(nudge) {
    try {
        const user = await db.user.findUnique({
            where: { id: nudge.userId },
            include: { accounts: true },
        });

        const defaultAccount = user.accounts.find((a) => a.isDefault);
        if (!defaultAccount) {
            return { success: false, error: "No default account found" };
        }

        const newTransaction = await db.transaction.create({
            data: {
                userId: nudge.userId,
                accountId: defaultAccount.id,
                type: "EXPENSE",
                amount: nudge.amount,
                description: "Auto-Save (AI Suggested)",
                category: "Savings",
                date: new Date(),
                status: "COMPLETED",
            },
        });

        // If this nudge was for a goal, update the Goal.savedAmount
        if (nudge.metadata?.goalId) {
            try {
                await db.goal.update({ where: { id: nudge.metadata.goalId }, data: { savedAmount: { increment: nudge.amount } } });
            } catch (err) {
                console.error("Failed to update goal savedAmount:", err);
            }
        }

        return { success: true, transaction: newTransaction };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function executeBillPay(nudge) {
    try {
        const billId = nudge.metadata?.billId;
        if (!billId) {
            return { success: false, error: "Bill ID not found" };
        }

        const bill = await db.bill.findUnique({
            where: { id: billId },
        });

        if (!bill) {
            return { success: false, error: "Bill not found" };
        }

        const account = await db.account.findFirst({
            where: { userId: nudge.userId, isDefault: true },
        });

        if (!account) {
            return { success: false, error: "No default account" };
        }

        await db.transaction.create({
            data: {
                userId: nudge.userId,
                accountId: account.id,
                type: "EXPENSE",
                amount: bill.amount,
                description: `${bill.name} (Auto-Paid)`,
                category: bill.category,
                date: new Date(),
                status: "COMPLETED",
            },
        });

        const nextDueDate = bill.dueDay
            ? (() => {
                  const next = new Date();
                  next.setDate(bill.dueDay);
                  if (next <= new Date()) {
                      next.setMonth(next.getMonth() + 1);
                  }
                  return next;
              })()
            : null;

        await db.bill.update({
            where: { id: billId },
            data: {
                isPaid: true,
                lastPaidDate: new Date(),
                nextDueDate,
            },
        });

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function executeBillGuard(nudge) {
    try {
        const billId = nudge.metadata?.billId;
        if (!billId) {
            return { success: false, error: "Bill ID missing" };
        }

        await protectBillEnvelope({
            clerkUserId: nudge.user.clerkUserId,
            billId,
            amount: nudge.amount,
        });

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function executeMicroSave(nudge) {
    try {
        const user = await db.user.findUnique({
            where: { id: nudge.userId },
            include: { accounts: true },
        });

        const defaultAccount = user.accounts.find((a) => a.isDefault);
        if (!defaultAccount) {
            return { success: false, error: "No default account found" };
        }

        const newTransaction = await db.transaction.create({
            data: {
                userId: nudge.userId,
                accountId: defaultAccount.id,
                type: "EXPENSE",
                amount: nudge.amount,
                description: "Micro-Save (AI Buffer)",
                category: "Savings",
                date: new Date(),
                status: "COMPLETED",
            },
        });

        return { success: true, transaction: newTransaction };
    } catch (error) {
        return { success: false, error: error.message };
    }
}
