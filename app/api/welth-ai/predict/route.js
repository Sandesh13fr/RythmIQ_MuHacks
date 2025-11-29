import { NextResponse } from "next/server";
import { checkUser } from "@/lib/checkUser";
import { db } from "@/lib/prisma";
import { generateCashFlowForecast, getCachedForecast, setCachedForecast } from "@/lib/agents/predictive-agent";

/**
 * Predictive Cash Flow Forecast Endpoint
 * GET /api/RythmIQ-ai/predict
 *
 * Returns a 30-day financial forecast including:
 * - Predicted end-of-month balance
 * - Critical dates when balance may drop below threshold
 * - Risk assessment
 * - Recommended preventive actions
 */
export async function GET(req) {
  try {
    const user = await checkUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check cache first
    const cachedForecast = getCachedForecast(user.id);
    if (cachedForecast) {
      return NextResponse.json({
        success: true,
        forecast: cachedForecast.forecast,
        patterns: cachedForecast.patterns,
        cached: true,
        generatedAt: cachedForecast.generatedAt,
      });
    }

    // Fetch user's financial data
    const [transactions, accounts, budget] = await Promise.all([
      db.transaction.findMany({
        where: { userId: user.id },
        orderBy: { date: "desc" },
        take: 100, // Last 100 transactions for pattern analysis
      }),
      db.account.findMany({
        where: { userId: user.id },
      }),
      db.budget.findUnique({
        where: { userId: user.id },
      }),
    ]);

    const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);

    // Calculate monthly metrics
    const currentMonth = new Date();
    const daysIntoMonth = currentMonth.getDate();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const monthlyTransactions = transactions.filter(
      (tx) => new Date(tx.date) >= currentMonth
    );

    const monthlyIncome = monthlyTransactions
      .filter((tx) => tx.type === "INCOME")
      .reduce((sum, tx) => sum + Number(tx.amount), 0);

    const monthlyExpenses = monthlyTransactions
      .filter((tx) => tx.type === "EXPENSE")
      .reduce((sum, tx) => sum + Number(tx.amount), 0);

    const savingsRate =
      monthlyIncome > 0
        ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100
        : 0;

    const userFinancialData = {
      totalBalance,
      monthlyIncome,
      monthlyExpenses,
      savingsRate: savingsRate.toFixed(1),
      daysIntoMonth,
    };

    // Generate forecast
    const result = await generateCashFlowForecast(
      user.id,
      userFinancialData,
      transactions
    );

    if (result.success) {
      // Cache the result
      setCachedForecast(user.id, result);
    }

    return NextResponse.json({
      success: result.success,
      forecast: result.forecast,
      patterns: result.patterns,
      error: result.error || null,
      generatedAt: result.generatedAt,
    });
  } catch (error) {
    console.error("Error generating forecast:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to generate forecast",
        forecast: null,
      },
      { status: 500 }
    );
  }
}
