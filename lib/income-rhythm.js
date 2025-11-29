import { db } from "@/lib/prisma";

const LOOKBACK_DAYS = 120;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HOUR_BUCKETS = [
    { label: "dawn", start: 0, end: 6 },
    { label: "morning", start: 6, end: 12 },
    { label: "afternoon", start: 12, end: 17 },
    { label: "evening", start: 17, end: 21 },
    { label: "late-night", start: 21, end: 24 },
];

function bucketHour(hour) {
    const bucket = HOUR_BUCKETS.find(({ start, end }) => hour >= start && hour < end);
    return bucket ? bucket.label : "unknown";
}

function representativeHour(bucket) {
    switch (bucket) {
        case "dawn":
            return 6;
        case "morning":
            return 9;
        case "afternoon":
            return 14;
        case "evening":
            return 19;
        case "late-night":
            return 22;
        default:
            return 10;
    }
}

function detectCadence(incomeDates) {
    if (incomeDates.length < 2) return "irregular";
    const sorted = [...incomeDates].sort((a, b) => a - b);
    const intervals = [];
    for (let i = 1; i < sorted.length; i++) {
        intervals.push((sorted[i] - sorted[i - 1]) / DAY_MS);
    }
    const avg = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    if (avg <= 8) return "weekly";
    if (avg <= 16) return "bi-weekly";
    if (avg <= 40) return "monthly";
    return "irregular";
}

function percentage(part, total) {
    if (!total) return 0;
    return Number(((part / total) * 100).toFixed(1));
}

function analyzeRhythmFromTransactions(transactions) {
    const lookbackDate = new Date(Date.now() - LOOKBACK_DAYS * DAY_MS);
    const recent = transactions.filter(t => new Date(t.date) >= lookbackDate);
    if (!recent.length) {
        return null;
    }

    const incomes = recent.filter(t => t.type === "INCOME");
    const expenses = recent.filter(t => t.type === "EXPENSE");

    const incomeByWeekday = {};
    const incomeByBucket = {};
    const incomeDates = [];

    incomes.forEach(tx => {
        const date = new Date(tx.date);
        const weekday = WEEKDAYS[date.getDay()];
        incomeByWeekday[weekday] = (incomeByWeekday[weekday] || 0) + Number(tx.amount);
        const bucket = bucketHour(date.getHours());
        incomeByBucket[bucket] = (incomeByBucket[bucket] || 0) + Number(tx.amount);
        incomeDates.push(date.getTime());
    });

    const totalIncome = incomes.reduce((sum, tx) => sum + Number(tx.amount), 0);
    const paydayEntry = Object.entries(incomeByWeekday).sort((a, b) => b[1] - a[1])[0];
    const bucketEntry = Object.entries(incomeByBucket).sort((a, b) => b[1] - a[1])[0];

    const incomeRhythm = paydayEntry
        ? {
              payday: paydayEntry[0],
              reliability: percentage(paydayEntry[1], totalIncome),
              hourSlot: bucketEntry ? bucketEntry[0] : null,
              cadence: detectCadence(incomeDates),
              lookbackDays: LOOKBACK_DAYS,
          }
        : null;

    const spendByWeekday = {};
    const spendByBucket = {};
    const spendByCategory = {};
    let weekendSpend = 0;
    let lateNightSpend = 0;
    const totalSpend = expenses.reduce((sum, tx) => sum + Number(tx.amount), 0);

    expenses.forEach(tx => {
        const date = new Date(tx.date);
        const weekdayIndex = date.getDay();
        const weekday = WEEKDAYS[weekdayIndex];
        const bucket = bucketHour(date.getHours());
        spendByWeekday[weekday] = (spendByWeekday[weekday] || 0) + Number(tx.amount);
        spendByBucket[bucket] = (spendByBucket[bucket] || 0) + Number(tx.amount);
        const category = tx.category || "uncategorized";
        spendByCategory[category] = (spendByCategory[category] || 0) + Number(tx.amount);
        if (weekdayIndex === 0 || weekdayIndex === 6) {
            weekendSpend += Number(tx.amount);
        }
        if (bucket === "late-night") {
            lateNightSpend += Number(tx.amount);
        }
    });

    const avgSpend = totalSpend / (Object.keys(spendByWeekday).length || 1);
    const highRiskDays = Object.entries(spendByWeekday)
        .filter(([, amount]) => amount > avgSpend * 1.2)
        .map(([weekday, amount]) => ({ weekday, overspend: percentage(amount - avgSpend, avgSpend) }));

    const topCategories = Object.entries(spendByCategory)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([category, amount]) => ({ category, share: percentage(amount, totalSpend) }));

    const spendRhythm = {
        weekendShare: percentage(weekendSpend, totalSpend),
        lateNightShare: percentage(lateNightSpend, totalSpend),
        highRiskDays,
        topCategories,
        peakHourSlot: Object.entries(spendByBucket).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    };

    return {
        incomeRhythm,
        spendRhythm,
        optimalHour: incomeRhythm?.hourSlot ? representativeHour(incomeRhythm.hourSlot) : null,
    };
}

export async function updateRhythmProfile(userId) {
    const transactions = await db.transaction.findMany({
        where: { userId },
        orderBy: { date: "desc" },
        take: 400,
    });

    const rhythm = analyzeRhythmFromTransactions(transactions);
    if (!rhythm) return null;

    await db.financialProfile.upsert({
        where: { userId },
        update: {
            incomeRhythm: rhythm.incomeRhythm,
            spendRhythm: rhythm.spendRhythm,
            optimalNudgeHour: rhythm.optimalHour ?? undefined,
            lastPersonalizationUpdate: new Date(),
        },
        create: {
            userId,
            incomeRhythm: rhythm.incomeRhythm,
            spendRhythm: rhythm.spendRhythm,
            optimalNudgeHour: rhythm.optimalHour ?? null,
        },
    });

    return rhythm;
}

export function analyzeRhythm(transactions) {
    return analyzeRhythmFromTransactions(transactions);
}
