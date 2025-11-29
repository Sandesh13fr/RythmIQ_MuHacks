"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { enforceHighValueGuard } from "@/lib/security/action-guard";

export async function sendMoney(recipientEmail, amount, pin, accountId, otpCode) {
    console.log("P2P Transfer started:", { recipientEmail, amount, accountId });

    try {
        const { userId } = await auth();
        if (!userId) throw new Error("Unauthorized");

        const user = await db.user.findUnique({
            where: { clerkUserId: userId },
        });

        if (!user) throw new Error("User not found");

        // 1. Validate Amount
        const transferAmount = parseFloat(amount);
        if (isNaN(transferAmount) || transferAmount <= 0) {
            throw new Error("Invalid amount");
        }

        // 2. Validate PIN (Mock validation for hackathon)
        if (pin !== "1234") {
            throw new Error("Invalid PIN");
        }

        // 3. Find Recipient
        const recipient = await db.user.findUnique({
            where: { email: recipientEmail },
            include: { accounts: true },
        });

        if (!recipient) {
            throw new Error("Recipient not found. Ask them to join RythmIQ!");
        }

        if (recipient.id === user.id) {
            throw new Error("You cannot send money to yourself.");
        }

        const recipientAccount = recipient.accounts.find((a) => a.isDefault);
        if (!recipientAccount) {
            throw new Error("Recipient has no default account setup.");
        }

        // 4. Check Sender Balance
        const senderAccount = await db.account.findUnique({
            where: { id: accountId },
        });

        if (!senderAccount || parseFloat(senderAccount.balance) < transferAmount) {
            throw new Error("Insufficient funds");
        }

        const guard = await enforceHighValueGuard({
            clerkUserId: userId,
            action: "p2p_transfer",
            amount: transferAmount,
            otpCode,
        });

        if (!guard.verified) {
            return {
                success: false,
                requiresOtp: true,
                expiresAt: guard.expiresAt,
                devOtp: guard.devOtp,
                message: "OTP verification required for this transfer",
            };
        }

        // 5. Perform Atomic Transaction (Debit Sender, Credit Recipient)
        await db.$transaction([
            // Debit Sender
            db.account.update({
                where: { id: senderAccount.id },
                data: { balance: { decrement: transferAmount } },
            }),
            // Create Expense Transaction for Sender
            db.transaction.create({
                data: {
                    userId: user.id,
                    accountId: senderAccount.id,
                    type: "EXPENSE",
                    amount: transferAmount,
                    description: `Sent to ${recipient.name || recipient.email}`,
                    category: "Transfer",
                    date: new Date(),
                    status: "COMPLETED",
                },
            }),

            // Credit Recipient
            db.account.update({
                where: { id: recipientAccount.id },
                data: { balance: { increment: transferAmount } },
            }),
            // Create Income Transaction for Recipient
            db.transaction.create({
                data: {
                    userId: recipient.id,
                    accountId: recipientAccount.id,
                    type: "INCOME",
                    amount: transferAmount,
                    description: `Received from ${user.name || user.email}`,
                    category: "Transfer",
                    date: new Date(),
                    status: "COMPLETED",
                },
            }),
        ]);

        revalidatePath("/dashboard");
        revalidatePath("/account/[id]");

        console.log("P2P Transfer successful");
        return { success: true, message: `Sent ₹${transferAmount} to ${recipient.name || recipientEmail}` };

    } catch (error) {
        console.error("P2P Error:", error);
        return { success: false, error: error.message };
    }
}
