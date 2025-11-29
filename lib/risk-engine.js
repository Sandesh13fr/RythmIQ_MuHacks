import { db } from "@/lib/prisma";
import { get7DayForecast, calculateRiskScore, mapRiskToMeter, checkEmiAtRisk } from "@/lib/predictions";

const TRANSACTION_LOOKBACK = 120;

function buildDrivers({ forecast, totalBalance, emiRisk, billCount }) {
    const drivers = [];
    if (forecast?.trend === "declining") {
        drivers.push({ type: "trend", message: "Spending trending higher than inflow" });
    }
    if (forecast?.riskScore >= 70) {
        drivers.push({ type: "buffer", message: "Buffer may fall below ₹1,000" });
    }
    if (emiRisk?.atRisk) {
        drivers.push({ type: "emi", message: `${emiRisk.upcomingEmis} EMI(s) at risk this week` });
    }
    if (billCount > 0) {
        drivers.push({ type: "bills", message: `${billCount} protected bills in next 7 days` });
    }
    if (totalBalance < 2000) {
        drivers.push({ type: "balance", message: "Cash reserve under ₹2,000" });
    }
    return drivers;
}

export async function generateRiskSnapshot(clerkUserId) {
    const user = await db.user.findUnique({
        where: { clerkUserId },
        include: {
            accounts: true,
            transactions: {
                orderBy: { date: "desc" },
                take: TRANSACTION_LOOKBACK,
            },
            bills: {
                where: {
                    isActive: true,
                    nextDueDate: {
                        lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    },
                },
            },
        },
    });

    if (!user || user.accounts.length === 0) {
        return null;
    }

    const totalBalance = user.accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);
    const forecast = get7DayForecast(user.transactions, user.accounts);
    const riskScore = forecast.riskScore ?? calculateRiskScore(forecast.predictions || [], totalBalance);
    const riskLevel = mapRiskToMeter(riskScore);

    const emiRisk = user.transactions.length
        ? checkEmiAtRisk(user.transactions, user.accounts, 7)
        : null;

    const drivers = buildDrivers({
        forecast,
        totalBalance,
        emiRisk,
        billCount: user.bills.length,
    });

    const snapshot = await db.riskSnapshot.create({
        data: {
            userId: user.id,
            riskScore,
            riskLevel,
            drivers,
            forecast,
            metrics: {
                totalBalance,
                emiRisk,
                billCount: user.bills.length,
            },
        },
    });

    return snapshot;
}

export async function getLatestRiskSnapshot(clerkUserId) {
    const user = await db.user.findUnique({
        where: { clerkUserId },
        select: { id: true },
    });

    if (!user) {
        return null;
    }

    return db.riskSnapshot.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
    });
}
