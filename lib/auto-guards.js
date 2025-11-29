import { addDays } from "date-fns";
import { db } from "@/lib/prisma";

const DEFAULT_LOCK_DAYS = 10;

export async function protectBillEnvelope({ clerkUserId, billId, amount, lockDays = DEFAULT_LOCK_DAYS }) {
    const user = await db.user.findUnique({
        where: { clerkUserId },
        select: { id: true },
    });

    if (!user) {
        throw new Error("User not found");
    }

    const bill = await db.bill.findFirst({
        where: { id: billId, userId: user.id },
        select: { id: true, amount: true, nextDueDate: true, name: true },
    });

    if (!bill) {
        throw new Error("Bill not found");
    }

    const protectedAmount = amount ?? Number(bill.amount);
    const lockedUntil = addDays(bill.nextDueDate ?? new Date(), lockDays);

    const envelope = await db.billEnvelope.upsert({
        where: {
            billId_status: {
                billId: bill.id,
                status: "active",
            },
        },
        update: {
            protectedAmount,
            lockedUntil,
        },
        create: {
            billId: bill.id,
            userId: user.id,
            protectedAmount,
            lockedUntil,
        },
    });

    return envelope;
}

export async function releaseBillEnvelope(envelopeId, clerkUserId) {
    const envelope = await db.billEnvelope.findFirst({
        where: {
            id: envelopeId,
            user: { clerkUserId },
        },
    });

    if (!envelope) {
        throw new Error("Envelope not found");
    }

    return db.billEnvelope.update({
        where: { id: envelope.id },
        data: {
            status: "released",
            lockedUntil: null,
        },
    });
}

export async function listActiveEnvelopes(clerkUserId) {
    const envelopes = await db.billEnvelope.findMany({
        where: {
            user: { clerkUserId },
            status: "active",
        },
        include: {
            bill: true,
        },
        orderBy: { lockedUntil: "asc" },
    });

    return envelopes;
}
