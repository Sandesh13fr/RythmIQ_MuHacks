
export function calculateFitnessScore(accounts, transactions, budget, nudges = []) {
    let score = 0;
    const breakdown = {
        savings: 0,
        bills: 0,
        budget: 0,
        emergency: 0,
        engagement: 0
    };

    // 1. Savings Rate (Max 30 pts)
    // Calculate income vs expense for last 30 days
    const last30Days = transactions.filter(t => {
        const daysAgo = (Date.now() - new Date(t.date).getTime()) / (1000 * 60 * 60 * 24);
        return daysAgo <= 30;
    });

    const income = last30Days
        .filter(t => t.type === "INCOME")
        .reduce((acc, t) => acc + Number(t.amount), 0);

    const expenses = last30Days
        .filter(t => t.type === "EXPENSE")
        .reduce((acc, t) => acc + Number(t.amount), 0);

    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;

    if (savingsRate >= 20) breakdown.savings = 30;
    else if (savingsRate >= 10) breakdown.savings = 20;
    else if (savingsRate > 0) breakdown.savings = 10;

    score += breakdown.savings;

    // 2. Bill Discipline (Max 20 pts)
    // Mock logic: Assume perfect bill payment if no "late fee" transactions found
    const hasLateFees = last30Days.some(t =>
        t.description?.toLowerCase().includes("late fee") ||
        t.category?.toLowerCase().includes("penalty")
    );

    if (!hasLateFees) {
        breakdown.bills = 20;
        score += 20;
    }

    // 3. Budget Adherence (Max 20 pts)
    if (budget) {
        const budgetUsage = (budget.currentExpenses / budget.amount) * 100;
        if (budgetUsage <= 90) {
            breakdown.budget = 20;
            score += 20;
        } else if (budgetUsage <= 100) {
            breakdown.budget = 10;
            score += 10;
        }
    }

    // 4. Emergency Fund (Max 15 pts)
    // Ideal: 3 months of expenses. MVP: 1 month of average expense
    const totalBalance = accounts.reduce((acc, a) => acc + Number(a.balance), 0);
    const monthlyExpense = expenses || 10000; // Fallback

    if (totalBalance >= monthlyExpense * 3) {
        breakdown.emergency = 15;
        score += 15;
    } else if (totalBalance >= monthlyExpense) {
        breakdown.emergency = 10;
        score += 10;
    }

    // 5. Engagement (Max 15 pts)
    // Based on accepted nudges
    const acceptedNudges = nudges.filter(n => n.status === "accepted").length;
    if (acceptedNudges >= 5) {
        breakdown.engagement = 15;
        score += 15;
    } else if (acceptedNudges >= 1) {
        breakdown.engagement = 5 + (acceptedNudges * 2);
        score += breakdown.engagement;
    }

    return {
        score: Math.min(score, 100),
        breakdown,
        level: getLevel(score),
        nextLevel: getNextLevel(score)
    };
}

function getLevel(score) {
    if (score >= 80) return { name: "Financial Master", color: "text-emerald-600", bg: "bg-emerald-100" };
    if (score >= 60) return { name: "Smart Saver", color: "text-blue-600", bg: "bg-blue-100" };
    if (score >= 40) return { name: "Building Wealth", color: "text-purple-600", bg: "bg-purple-100" };
    return { name: "Just Starting", color: "text-gray-600", bg: "bg-gray-100" };
}

function getNextLevel(score) {
    if (score >= 80) return null;
    if (score >= 60) return { name: "Financial Master", pointsNeeded: 80 - score };
    if (score >= 40) return { name: "Smart Saver", pointsNeeded: 60 - score };
    return { name: "Building Wealth", pointsNeeded: 40 - score };
}
