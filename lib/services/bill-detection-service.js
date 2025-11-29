import { db as prisma } from "@/lib/prisma";

/**
 * Bill Detection Service - Auto-detect recurring bills from transaction history
 */

/**
 * Detect recurring bills from user's transaction history
 */
export async function detectRecurringBills(userId) {
    try {
        // Get all expense transactions from last 6 months
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const transactions = await prisma.transaction.findMany({
            where: {
                userId,
                type: "EXPENSE",
                date: { gte: sixMonthsAgo },
            },
            orderBy: { date: "desc" },
        });

        // Group transactions by similar amounts and categories
        const patterns = analyzeBillPatterns(transactions);

        // Filter for high-confidence recurring patterns
        const suggestedBills = patterns
            .filter(pattern => pattern.confidence >= 60)
            .map(pattern => ({
                name: pattern.suggestedName,
                category: pattern.category,
                amount: pattern.averageAmount,
                dueDay: pattern.typicalDay,
                confidence: pattern.confidence,
                occurrences: pattern.count,
                lastTransaction: pattern.lastTransactionId,
            }));

        return {
            success: true,
            suggestions: suggestedBills,
            totalAnalyzed: transactions.length,
        };
    } catch (error) {
        console.error("Error detecting bills:", error);
        return {
            success: false,
            error: error.message,
            suggestions: [],
        };
    }
}

/**
 * Analyze transaction patterns to find recurring bills
 */
function analyzeBillPatterns(transactions) {
    const patterns = [];
    const grouped = {};

    // Group by category and similar amounts (±10%)
    transactions.forEach(tx => {
        const amount = Number(tx.amount);
        const category = tx.category || "Other";
        const day = new Date(tx.date).getDate();

        // Create a key based on category and amount range
        const amountBucket = Math.round(amount / 100) * 100; // Round to nearest 100
        const key = `${category}_${amountBucket}`;

        if (!grouped[key]) {
            grouped[key] = [];
        }

        grouped[key].push({
            id: tx.id,
            amount,
            day,
            date: tx.date,
            description: tx.description,
        });
    });

    // Analyze each group for recurring patterns
    Object.entries(grouped).forEach(([key, txs]) => {
        if (txs.length < 2) return; // Need at least 2 occurrences

        const [category, amountBucket] = key.split("_");

        // Check if transactions occur at regular intervals
        const isRecurring = checkRecurringPattern(txs);

        if (isRecurring) {
            const avgAmount = txs.reduce((sum, t) => sum + t.amount, 0) / txs.length;
            const typicalDay = Math.round(
                txs.reduce((sum, t) => sum + t.day, 0) / txs.length
            );

            // Calculate confidence based on regularity
            const confidence = calculateConfidence(txs);

            // Suggest a name based on category and description
            const suggestedName = suggestBillName(category, txs[0].description);

            patterns.push({
                category,
                averageAmount: Math.round(avgAmount),
                typicalDay,
                confidence,
                count: txs.length,
                suggestedName,
                lastTransactionId: txs[0].id,
            });
        }
    });

    return patterns;
}

/**
 * Check if transactions follow a recurring pattern
 */
function checkRecurringPattern(transactions) {
    if (transactions.length < 2) return false;

    // Sort by date
    const sorted = transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate intervals between transactions (in days)
    const intervals = [];
    for (let i = 1; i < sorted.length; i++) {
        const days = Math.round(
            (new Date(sorted[i].date) - new Date(sorted[i - 1].date)) / (1000 * 60 * 60 * 24)
        );
        intervals.push(days);
    }

    // Check if intervals are consistent (monthly: 28-31 days, weekly: 6-8 days)
    const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;

    // Monthly pattern (28-31 days)
    if (avgInterval >= 25 && avgInterval <= 35) {
        const variance = intervals.every(i => Math.abs(i - 30) <= 5);
        return variance;
    }

    // Weekly pattern (6-8 days)
    if (avgInterval >= 6 && avgInterval <= 8) {
        const variance = intervals.every(i => Math.abs(i - 7) <= 2);
        return variance;
    }

    return false;
}

/**
 * Calculate confidence score for bill detection
 */
function calculateConfidence(transactions) {
    let score = 0;

    // More occurrences = higher confidence
    if (transactions.length >= 6) score += 40;
    else if (transactions.length >= 4) score += 30;
    else if (transactions.length >= 2) score += 20;

    // Amount consistency
    const amounts = transactions.map(t => t.amount);
    const avgAmount = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    const variance = amounts.every(a => Math.abs(a - avgAmount) / avgAmount <= 0.1);
    if (variance) score += 30;

    // Day consistency
    const days = transactions.map(t => t.day);
    const avgDay = days.reduce((sum, d) => sum + d, 0) / days.length;
    const dayVariance = days.every(d => Math.abs(d - avgDay) <= 3);
    if (dayVariance) score += 30;

    return Math.min(100, score);
}

/**
 * Suggest a bill name based on category and description
 */
function suggestBillName(category, description) {
    const categoryNames = {
        "Food & Dining": "Dining Subscription",
        "Shopping": "Shopping Subscription",
        "Entertainment": "Entertainment Subscription",
        "Transportation": "Transport Pass",
        "Bills & Utilities": "Utility Bill",
        "Healthcare": "Health Insurance",
        "Education": "Course Fee",
        "Other": "Recurring Payment",
    };

    // Try to extract meaningful name from description
    if (description) {
        const cleaned = description.trim().slice(0, 30);
        if (cleaned.length > 3) {
            return cleaned;
        }
    }

    return categoryNames[category] || "Recurring Bill";
}

/**
 * Get bill suggestions for a specific transaction
 */
export async function analyzeSingleTransaction(transactionId, userId) {
    try {
        const transaction = await prisma.transaction.findUnique({
            where: { id: transactionId, userId },
        });

        if (!transaction) {
            return { success: false, error: "Transaction not found" };
        }

        // Check if similar transactions exist
        const similarTransactions = await prisma.transaction.findMany({
            where: {
                userId,
                category: transaction.category,
                type: "EXPENSE",
                amount: {
                    gte: Number(transaction.amount) * 0.9,
                    lte: Number(transaction.amount) * 1.1,
                },
                id: { not: transactionId },
            },
            take: 10,
            orderBy: { date: "desc" },
        });

        const allTransactions = [transaction, ...similarTransactions];
        const isRecurring = checkRecurringPattern(allTransactions);

        if (isRecurring) {
            const confidence = calculateConfidence(allTransactions);
            const suggestedName = suggestBillName(
                transaction.category,
                transaction.description
            );

            return {
                success: true,
                isRecurring: true,
                suggestion: {
                    name: suggestedName,
                    category: transaction.category,
                    amount: Number(transaction.amount),
                    dueDay: new Date(transaction.date).getDate(),
                    confidence,
                },
            };
        }

        return {
            success: true,
            isRecurring: false,
        };
    } catch (error) {
        console.error("Error analyzing transaction:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}
