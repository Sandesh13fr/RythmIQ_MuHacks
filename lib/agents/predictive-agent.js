import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";

/**
 * Analyze spending patterns from transaction history

Spending Patterns (from history):
- Weekly Average Spending: $${patterns.weeklyAverage}
- Monthly Average Spending: $${patterns.monthlyAverage}
- Top spending categories: ${patterns.topCategories.map((c) => `${c.category} ($${c.amount})`).join(", ")}
- Average transaction: $${patterns.averageTransactionSize}
      topCategories: [],
      frequencyByDay: {},
    };
  }

  // Group transactions by category
  const byCategory = {};
  let totalExpenses = 0;
  let expenseCount = 0;

  transactions.forEach((tx) => {
    if (tx.type === "EXPENSE") {
      const category = tx.category || "Other";
      byCategory[category] = (byCategory[category] || 0) + Number(tx.amount);
      totalExpenses += Number(tx.amount);
      expenseCount += 1;
    }
  });

  // Calculate averages
  const daysOfData = Math.max(
    1,
    (new Date() - new Date(transactions[transactions.length - 1]?.date || new Date())) /
      (1000 * 60 * 60 * 24)
  );
  const dailyAverage = totalExpenses / Math.max(1, daysOfData);
  const weeklyAverage = dailyAverage * 7;
  const monthlyAverage = dailyAverage * 30;

  // Top spending categories
  const topCategories = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, amount]) => ({ category, amount }));

  return {
    weeklyAverage: Math.round(weeklyAverage),
    monthlyAverage: Math.round(monthlyAverage),
    topCategories,
    totalExpenses: Math.round(totalExpenses),
    averageTransactionSize: Math.round(totalExpenses / Math.max(1, expenseCount)),
  };
}

/**
 * Generate 30-day cash flow forecast using AI
 */
export async function generateCashFlowForecast(userId, userFinancialData, transactions = []) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is missing");
    }

    // Analyze spending patterns
    const patterns = analyzeSpendingPatterns(transactions);

    // Create the model
    const model = new ChatGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
      modelName: "gemini-2.0-flash",
      temperature: 0.5,
      maxOutputTokens: 1024,
    });

    const prompt = PromptTemplate.fromTemplate(`
You are a financial forecasting AI. Based on the user's financial data and spending patterns, generate a 30-day cash flow forecast.

User's Current Financial Status:
- Total Balance: $${userFinancialData.totalBalance || 0}
- Monthly Income: $${userFinancialData.monthlyIncome || 0}
- Monthly Expenses: $${userFinancialData.monthlyExpenses || 0}
- Savings Rate: ${userFinancialData.savingsRate || 0}%
- Days into month: ${userFinancialData.daysIntoMonth || 0}/30

Spending Patterns (from history):
- Weekly Average Spending: $${patterns.weeklyAverage}
- Monthly Average Spending: $${patterns.monthlyAverage}
- Top spending categories: ${patterns.topCategories.map((c) => `${c.category} ($${c.amount})`).join(", ")}
- Average transaction: $${patterns.averageTransactionSize}

Generate a JSON forecast with:
1. "risk_level": "low" | "medium" | "high" | "critical" (based on predicted balance trajectory)
2. "predicted_balance_day_30": estimated balance at end of month
3. "critical_dates": array of {day, reason, predicted_balance} for dates when balance might drop below $1000
4. "recommended_actions": array of 2-3 preventive actions to take now
5. "confidence": 0-100 confidence score
6. "summary": 1-sentence risk assessment

If monthly expenses exceed income or balance will drop below $1000, set risk_level to "high" or "critical".
If balance dropping but above $1000, set to "medium".
Otherwise "low".

Return ONLY valid JSON, no markdown code blocks.`);

    const chain = RunnableSequence.from([
      prompt,
      model,
      new StringOutputParser(),
    ]);

    const result = await chain.invoke({});

    // Clean and parse response
    let cleanResult = result.trim();
    if (cleanResult.startsWith("```json")) {
      cleanResult = cleanResult.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    }
    if (cleanResult.startsWith("```")) {
      cleanResult = cleanResult.replace(/```\n?/g, "");
    }

    const forecast = JSON.parse(cleanResult);

    return {
      success: true,
      forecast,
      patterns,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error generating cash flow forecast:", error);
    return {
      success: false,
      error: error.message,
      forecast: {
        risk_level: "unknown",
        predicted_balance_day_30: userFinancialData.totalBalance || 0,
        critical_dates: [],
        recommended_actions: ["Unable to generate forecast. Please try again later."],
        confidence: 0,
        summary: "Forecast generation failed",
      },
    };
  }
}

/**
 * Check if forecast indicates a crisis (for nudge creation)
 */
export function isForecastCritical(forecast) {
  if (!forecast) return false;
  return (
    forecast.risk_level === "critical" ||
    forecast.risk_level === "high" ||
    forecast.critical_dates?.length > 0
  );
}

/**
 * Cache for forecast results (in-memory, 6-hour TTL)
 */
const forecastCache = new Map();

export function getCachedForecast(userId) {
  const cached = forecastCache.get(userId);
  if (cached && Date.now() - cached.timestamp < 6 * 60 * 60 * 1000) {
    return cached.data;
  }
  forecastCache.delete(userId);
  return null;
}

export function setCachedForecast(userId, data) {
  forecastCache.set(userId, {
    data,
    timestamp: Date.now(),
  });
}

export function clearForecastCache(userId) {
  forecastCache.delete(userId);
}
