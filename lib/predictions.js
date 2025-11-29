/**
 * Enhanced Cash Flow Prediction with ML-like features
 * Includes: Moving averages, trend detection, seasonal adjustment, confidence intervals
 */

/**
 * Calculate moving average for smoothing
 */
function calculateMovingAverage(data, window = 7) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
        const start = Math.max(0, i - window + 1);
        const slice = data.slice(start, i + 1);
        const avg = slice.reduce((sum, val) => sum + val, 0) / slice.length;
        result.push(avg);
    }
    return result;
}

/**
 * Detect trend (upward, downward, stable)
 */
function detectTrend(transactions) {
    const last30Days = transactions.filter(t => {
        const daysAgo = (Date.now() - new Date(t.date).getTime()) / (1000 * 60 * 60 * 24);
        return daysAgo <= 30;
    });

    // Calculate weekly net flows
    const weeks = [[], [], [], []];
    last30Days.forEach(t => {
        const daysAgo = (Date.now() - new Date(t.date).getTime()) / (1000 * 60 * 60 * 24);
        const weekIndex = Math.floor(daysAgo / 7);
        if (weekIndex < 4) {
            const amount = t.type === "INCOME" ? Number(t.amount) : -Number(t.amount);
            weeks[weekIndex].push(amount);
        }
    });

    const weeklyAverages = weeks.map(week =>
        week.length > 0 ? week.reduce((sum, val) => sum + val, 0) / week.length : 0
    );

    // Calculate trend slope
    const slope = (weeklyAverages[0] - weeklyAverages[3]) / 4;

    if (slope > 50) return { direction: "improving", rate: slope };
    if (slope < -50) return { direction: "declining", rate: slope };
    return { direction: "stable", rate: slope };
}

/**
 * Detect seasonal patterns (e.g., month-end spikes)
 */
function detectSeasonalPattern(transactions) {
    const monthlySpending = {};

    transactions.filter(t => t.type === "EXPENSE").forEach(t => {
        const date = new Date(t.date);
        const dayOfMonth = date.getDate();
        const bucket = dayOfMonth <= 10 ? "start" : dayOfMonth <= 20 ? "mid" : "end";

        if (!monthlySpending[bucket]) monthlySpending[bucket] = [];
        monthlySpending[bucket].push(Number(t.amount));
    });

    const averages = {};
    Object.keys(monthlySpending).forEach(bucket => {
        const amounts = monthlySpending[bucket];
        averages[bucket] = amounts.reduce((sum, val) => sum + val, 0) / amounts.length;
    });

    return averages;
}

/**
 * Calculate prediction confidence based on data quality
 */
function calculateConfidence(transactions, days) {
    const dataPoints = transactions.length;
    const timeSpan = transactions.length > 0 ?
        (Date.now() - new Date(transactions[transactions.length - 1].date).getTime()) / (1000 * 60 * 60 * 24) : 0;

    // More data = higher confidence
    let confidence = Math.min(dataPoints / 50, 1) * 100;

    // Longer prediction = lower confidence
    const horizonPenalty = Math.max(0, 1 - (days / 60));
    confidence *= horizonPenalty;

    // Recent data = higher confidence
    if (timeSpan < 7) confidence *= 1.1;
    else if (timeSpan > 30) confidence *= 0.8;

    return Math.min(Math.max(confidence, 20), 95); // Clamp between 20-95%
}

/**
 * Enhanced cash flow prediction with ML features
 */
export function predictCashFlow(transactions, accounts, days = 30) {
    const totalBalance = accounts.reduce((acc, a) => acc + Number(a.balance), 0);

    // Get recent transactions
    const last60Days = transactions.filter(t => {
        const daysAgo = (Date.now() - new Date(t.date).getTime()) / (1000 * 60 * 60 * 24);
        return daysAgo <= 60;
    });

    // Calculate base daily rates
    const dailyIncome = last60Days
        .filter(t => t.type === "INCOME")
        .reduce((acc, t) => acc + Number(t.amount), 0) / 60;

    const dailyExpense = last60Days
        .filter(t => t.type === "EXPENSE")
        .reduce((acc, t) => acc + Number(t.amount), 0) / 60;

    // Detect trend and adjust
    const trend = detectTrend(transactions);
    const trendAdjustment = trend.rate / 7; // Daily adjustment

    // Detect seasonal patterns
    const seasonal = detectSeasonalPattern(transactions);

    // Calculate confidence
    const confidence = calculateConfidence(transactions, days);

    // Calculate confidence interval (±)
    const variance = Math.abs(dailyIncome - dailyExpense) * 0.3;

    // Generate predictions
    const predictions = [];
    let runningBalance = totalBalance;

    for (let i = 0; i <= days; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);

        // Apply trend
        const trendedIncome = dailyIncome + (trendAdjustment * i);
        const dailyNet = trendedIncome - dailyExpense;

        // Apply seasonal adjustment
        const dayOfMonth = date.getDate();
        let seasonalMultiplier = 1;
        if (dayOfMonth <= 10 && seasonal.start) {
            seasonalMultiplier = seasonal.start / dailyExpense;
        } else if (dayOfMonth > 20 && seasonal.end) {
            seasonalMultiplier = seasonal.end / dailyExpense;
        }

        // Calculate predicted balance
        runningBalance += dailyNet * seasonalMultiplier;

        // Calculate confidence bounds
        const upperBound = runningBalance + (variance * i * 0.1);
        const lowerBound = runningBalance - (variance * i * 0.1);

        predictions.push({
            date: date.toISOString().split('T')[0],
            predicted: Math.round(runningBalance),
            upperBound: Math.round(upperBound),
            lowerBound: Math.round(lowerBound),
            confidence: Math.round(confidence * (1 - i / (days * 2))), // Decreases with time
            dayOffset: i,
        });
    }

    return {
        predictions,
        trend: trend.direction,
        trendRate: Math.round(trend.rate),
        confidence: Math.round(confidence),
        metadata: {
            dailyIncome: Math.round(dailyIncome),
            dailyExpense: Math.round(dailyExpense),
            dailyNet: Math.round(dailyIncome - dailyExpense),
        }
    };
}

/**
 * Calculate risk score (0-100, higher = riskier)
 */
export function calculateRiskScore(predictions, currentBalance) {
    const minPredicted = Math.min(...predictions.map(p => p.predicted));
    const volatility = Math.max(...predictions.map(p => p.predicted)) - minPredicted;

    let risk = 0;

    // Risk from low balance
    if (minPredicted < 500) risk += 40;
    else if (minPredicted < 1000) risk += 25;
    else if (minPredicted < 2000) risk += 10;

    // Risk from high volatility
    const volatilityPercent = (volatility / currentBalance) * 100;
    if (volatilityPercent > 50) risk += 30;
    else if (volatilityPercent > 30) risk += 15;

    // Risk from negative trend
    const endBalance = predictions[predictions.length - 1].predicted;
    if (endBalance < currentBalance) {
        const decline = ((currentBalance - endBalance) / currentBalance) * 100;
        risk += Math.min(decline, 30);
    }

    return Math.min(Math.round(risk), 100);
}

/**
 * Calculate historical balance for the last N days
 */
export function calculateHistoricalBalance(transactions, currentBalance, days = 30) {
    const history = [];
    let balance = currentBalance;

    const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

    for (let i = 0; i <= days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const futureTransactions = sorted.filter(t => new Date(t.date) > date);
        let adjustedBalance = balance;

        futureTransactions.forEach(t => {
            if (t.type === "INCOME") {
                adjustedBalance -= Number(t.amount);
            } else {
                adjustedBalance += Number(t.amount);
            }
        });

        history.unshift({
            date: dateStr,
            balance: adjustedBalance,
            dayOffset: -i,
        });
    }

    return history;
}

/**
 * Calculate safe amount to auto-save
 */
export function calculateSafeToSave(transactions, accounts, budget) {
    const totalBalance = accounts.reduce((acc, a) => acc + Number(a.balance), 0);

    if (totalBalance < 1000) return 0;

    const currentMonthExpenses = transactions
        .filter(t => t.type === "EXPENSE" && new Date(t.date).getMonth() === new Date().getMonth())
        .reduce((acc, t) => acc + Number(t.amount), 0);

    if (budget) {
        const budgetUsage = (currentMonthExpenses / Number(budget.amount)) * 100;
        if (budgetUsage > 70) return 0;
    }

    const minimumBuffer = 2000;
    const excess = totalBalance - minimumBuffer;

    if (excess <= 0) return 0;

    const safeAmount = Math.min(excess * 0.05, 500);

    return Math.floor(safeAmount);
}

/**
 * Get 7-day cash flow forecast
 */
export function get7DayForecast(transactions, accounts) {
    const forecast = predictCashFlow(transactions, accounts, 7);
    return {
        predictions: forecast.predictions.slice(0, 7),
        riskScore: calculateRiskScore(forecast.predictions.slice(0, 7), accounts.reduce((acc, a) => acc + Number(a.balance), 0)),
        trend: forecast.trend,
        confidence: forecast.confidence,
    };
}

/**
 * Map risk score to meter level
 */
export function mapRiskToMeter(riskScore) {
    if (riskScore <= 30) return "Safe";
    if (riskScore <= 70) return "Caution";
    return "Danger";
}

/**
 * Check if upcoming EMIs are at risk
 */
export function checkEmiAtRisk(transactions, accounts, days = 7) {
    const forecast = predictCashFlow(transactions, accounts, days);
    const minPredicted = Math.min(...forecast.predictions.slice(0, days).map(p => p.predicted));

    const upcomingEmis = transactions.filter(
        (t) =>
            t.isRecurring &&
            t.type === "EXPENSE" &&
            t.nextRecurringDate &&
            new Date(t.nextRecurringDate) <= new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    );

    const totalEmi = upcomingEmis.reduce((sum, t) => sum + Number(t.amount), 0);
    const buffer = 1000; // Minimum buffer
    const shortfall = totalEmi - (minPredicted - buffer);

    return {
        atRisk: shortfall > 0,
        shortfall: Math.max(0, shortfall),
        totalEmi,
        minPredicted,
        upcomingEmis: upcomingEmis.length,
    };
}
