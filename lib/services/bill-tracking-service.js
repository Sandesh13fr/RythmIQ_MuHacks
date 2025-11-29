import { db as prisma } from "@/lib/prisma";
import { agenticLog } from "@/lib/agents/agentic-log";

/**
 * Bill Tracking Service - Manage bills and obligations
 */

/**
 * Get all bills for a user
 */
export async function getUserBills(userId, includeInactive = false) {
    try {
        // AUTONOMOUS DATA CURATION: surfaces pending liabilities so other agents (guardrails, autopay) can intervene without prompting the user.
        const bills = await prisma.bill.findMany({
            where: {
                userId,
                ...(includeInactive ? {} : { isActive: true }),
            },
            orderBy: { nextDueDate: "asc" },
        });

        const envelopes = await prisma.billEnvelope.findMany({
            where: {
                userId,
                status: "active",
            },
            include: { bill: true },
            orderBy: { lockedUntil: "asc" },
        });

        const response = {
            success: true,
            bills,
            envelopes,
        };
        agenticLog(userId, "realtime_behavior_analysis", {
            capability: "bill_intel_refresh",
            billCount: bills.length,
        });
        return response;
    } catch (error) {
        console.error("Error getting bills:", error);
        return {
            success: false,
            error: error.message,
            bills: [],
            envelopes: [],
        };
    }
}

/**
 * Get upcoming bills (due in next N days)
 */
export async function getUpcomingBills(userId, days = 7) {
    try {
        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + days);

        const bills = await prisma.bill.findMany({
            where: {
                userId,
                isActive: true,
                nextDueDate: {
                    gte: today,
                    lte: futureDate,
                },
            },
            orderBy: { nextDueDate: "asc" },
        });

        // Calculate total obligations
        const totalAmount = bills.reduce((sum, bill) => sum + Number(bill.amount), 0);

        // Check for risk (insufficient balance)
        const accounts = await prisma.account.findMany({
            where: { userId },
        });

        const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);
        const hasRisk = totalBalance < totalAmount;

        return {
            success: true,
            bills,
            totalAmount,
            daysAhead: days,
            hasRisk,
            currentBalance: totalBalance,
        };
    } catch (error) {
        console.error("Error getting upcoming bills:", error);
        return {
            success: false,
            error: error.message,
            bills: [],
        };
    }
}

/**
 * Create a new bill
 */
export async function createBill(userId, billData) {
    try {
        const { name, category, amount, dueDay, autoPayEnabled, detectedFrom, confidence } = billData;

        // Calculate next due date
        const nextDueDate = calculateNextDueDate(dueDay);

        const bill = await prisma.bill.create({
            data: {
                userId,
                name,
                category,
                amount,
                dueDay,
                nextDueDate,
                autoPayEnabled: autoPayEnabled || false,
                detectedFrom: detectedFrom || "manual",
                confidence,
            },
        });

        return {
            success: true,
            bill,
        };
    } catch (error) {
        console.error("Error creating bill:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Update a bill
 */
export async function updateBill(billId, userId, updates) {
    try {
        const bill = await prisma.bill.update({
            where: {
                id: billId,
                userId, // Ensure user owns this bill
            },
            data: updates,
        });

        return {
            success: true,
            bill,
        };
    } catch (error) {
        console.error("Error updating bill:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Delete a bill
 */
export async function deleteBill(billId, userId) {
    try {
        await prisma.bill.delete({
            where: {
                id: billId,
                userId,
            },
        });

        return {
            success: true,
        };
    } catch (error) {
        console.error("Error deleting bill:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Mark bill as paid
 */
export async function markBillAsPaid(billId, userId) {
    try {
        const bill = await prisma.bill.findUnique({
            where: { id: billId, userId },
        });

        if (!bill) {
            return { success: false, error: "Bill not found" };
        }

        // Calculate next due date
        const nextDueDate = calculateNextDueDate(bill.dueDay);

        const updatedBill = await prisma.bill.update({
            where: { id: billId },
            data: {
                isPaid: true,
                lastPaidDate: new Date(),
                nextDueDate,
            },
        });

        await prisma.billEnvelope.updateMany({
            where: { billId, status: "active" },
            data: { status: "released", lockedUntil: null },
        });

        // Create a transaction record for the payment
        const defaultAccount = await prisma.account.findFirst({
            where: { userId, isDefault: true },
        });

        if (defaultAccount) {
            await prisma.transaction.create({
                data: {
                    userId,
                    accountId: defaultAccount.id,
                    type: "EXPENSE",
                    amount: bill.amount,
                    category: bill.category,
                    description: `Bill payment: ${bill.name}`,
                    date: new Date(),
                    status: "COMPLETED",
                },
            });

            // Update account balance
            await prisma.account.update({
                where: { id: defaultAccount.id },
                data: {
                    balance: {
                        decrement: bill.amount,
                    },
                },
            });
        }

        return {
            success: true,
            bill: updatedBill,
            transactionCreated: !!defaultAccount,
        };
    } catch (error) {
        console.error("Error marking bill as paid:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Execute auto-pay for bills
 */
export async function executeAutoPay(userId) {
    try {
        // Get bills with auto-pay enabled that are due soon
        const today = new Date();
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

        const billsToPay = await prisma.bill.findMany({
            where: {
                userId,
                isActive: true,
                autoPayEnabled: true,
                isPaid: false,
                nextDueDate: {
                    gte: today,
                    lte: threeDaysFromNow,
                },
            },
        });

        const results = [];

        for (const bill of billsToPay) {
            const result = await markBillAsPaid(bill.id, userId);
            results.push({
                billId: bill.id,
                billName: bill.name,
                ...result,
            });
            agenticLog(userId, "proactive_intervention", {
                trigger: "autopay_window",
                billId: bill.id,
                amount: Number(bill.amount),
            });
        }

        return {
            success: true,
            paidCount: results.filter(r => r.success).length,
            results,
        };
    } catch (error) {
        console.error("Error executing auto-pay:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Calculate next due date based on day of month
 */
function calculateNextDueDate(dueDay) {
    const today = new Date();
    const currentDay = today.getDate();

    let nextDate = new Date(today);
    nextDate.setDate(dueDay);

    // If due day has passed this month, set to next month
    if (dueDay <= currentDay) {
        nextDate.setMonth(nextDate.getMonth() + 1);
    }

    // Handle months with fewer days (e.g., Feb 30 -> Feb 28)
    if (nextDate.getDate() !== dueDay) {
        nextDate.setDate(0); // Set to last day of previous month
    }

    return nextDate;
}

/**
 * Check bill payment risk
 */
export async function checkBillRisk(userId, days = 7) {
    try {
        const upcoming = await getUpcomingBills(userId, days);

        if (!upcoming.success) {
            return upcoming;
        }

        const riskLevel = upcoming.hasRisk ? "high" : "low";
        const shortfall = upcoming.hasRisk
            ? upcoming.totalAmount - upcoming.currentBalance
            : 0;

        return {
            success: true,
            riskLevel,
            hasRisk: upcoming.hasRisk,
            shortfall,
            totalDue: upcoming.totalAmount,
            currentBalance: upcoming.currentBalance,
            billsCount: upcoming.bills.length,
        };
    } catch (error) {
        console.error("Error checking bill risk:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Get bill payment history
 */
export async function getBillHistory(billId, userId) {
    try {
        const bill = await prisma.bill.findUnique({
            where: { id: billId, userId },
        });

        if (!bill) {
            return { success: false, error: "Bill not found" };
        }

        // Find related transactions
        const transactions = await prisma.transaction.findMany({
            where: {
                userId,
                category: bill.category,
                description: {
                    contains: bill.name,
                },
            },
            orderBy: { date: "desc" },
            take: 12, // Last 12 payments
        });

        return {
            success: true,
            bill,
            history: transactions,
        };
    } catch (error) {
        console.error("Error getting bill history:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}
