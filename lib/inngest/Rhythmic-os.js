import { db } from "../prisma";
import { inngest } from "./client";
import { sendEmail } from "@/actions/send-email";
import EmailTemplate from "@/emails/template";

export const runFinancialAgent = inngest.createFunction(
    { id: "run-financial-agent", name: "Rhythmic AI OS Agent" },
    { cron: "0 9 * * *" },
    async ({ step }) => {
        const users = await step.run("fetch-users", async () => {
            return await db.user.findMany({
                include: {
                    accounts: true,
                    budgets: true,
                },
            });
        });

        const results = [];

        for (const user of users) {
            await step.run(`agent-check-${user.id}`, async () => {
                const defaultAccount = user.accounts.find((a) => a.isDefault);
                if (!defaultAccount) return;

                const balance = Number(defaultAccount.balance);
                let actionLog = [];

                const primaryBudget = user.budgets?.[0];

                if (balance < 1000 && primaryBudget && !primaryBudget.isLocked) {
                    await db.budget.update({
                        where: { id: primaryBudget.id },
                        data: { isLocked: true },
                    });
                    actionLog.push("⚠️ Critical Balance! Budget Locked.");

                    await db.insight.create({
                        data: {
                            userId: user.id,
                            type: "BUDGET",
                            action: "LOCKED_BUDGET",
                            content: "Agent locked your budget due to critical balance (< ₹1000).",
                        },
                    });
                }

                const upcomingBills = await db.transaction.findMany({
                    where: {
                        userId: user.id,
                        type: "EXPENSE",
                        isRecurring: true,
                        status: "COMPLETED",
                        nextRecurringDate: {
                            lte: new Date(new Date().setDate(new Date().getDate() + 3)),
                            gte: new Date(),
                        }
                    }
                });

                for (const bill of upcomingBills) {
                    if (balance > Number(bill.amount) + 2000) {
                        await db.transaction.create({
                            data: {
                                userId: user.id,
                                accountId: defaultAccount.id,
                                type: "EXPENSE",
                                amount: bill.amount,
                                description: `Auto-Paid: ${bill.description}`,
                                category: bill.category,
                                date: new Date(),
                                status: "COMPLETED",
                            }
                        });

                        await db.account.update({
                            where: { id: defaultAccount.id },
                            data: { balance: { decrement: Number(bill.amount) } }
                        });

                        actionLog.push(`✅ Auto-Paid ${bill.description} (₹${bill.amount})`);
                    } else {
                        actionLog.push(`❌ Skipped ${bill.description} (Insufficient Safe Balance)`);
                    }
                }

                if (balance > 20000) {
                    const savingsAccount = user.accounts.find(a => a.type === "SAVINGS");
                    if (savingsAccount) {
                        const saveAmount = 1000;

                        await db.transaction.create({
                            data: {
                                userId: user.id,
                                accountId: savingsAccount.id,
                                type: "INCOME",
                                amount: saveAmount,
                                description: "Agent Smart Sweep",
                                category: "Savings",
                                date: new Date(),
                                status: "COMPLETED",
                            }
                        });

                        await db.account.update({
                            where: { id: defaultAccount.id },
                            data: { balance: { decrement: saveAmount } }
                        });

                        await db.account.update({
                            where: { id: savingsAccount.id },
                            data: { balance: { increment: saveAmount } }
                        });

                        actionLog.push(`💰 Smart Swept ₹${saveAmount} to Savings`);
                    }
                }

                if (actionLog.length > 0) {
                    await sendEmail({
                        to: user.email,
                        subject: "🤖 Rhythmic AI Daily Report",
                        react: EmailTemplate({
                            userName: user.name,
                            type: "guardian-alert",
                            data: {
                                action: "Agent Actions Executed",
                                reason: "Daily System Check",
                                message: actionLog.join("\n"),
                            },
                        }),
                    });
                    results.push({ user: user.name, actions: actionLog });
                }
            });
        }

        return { processed: users.length, results };
    }
);
