import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Detects potential recurring subscriptions from transaction history
 * and analyzes the health of existing subscriptions.
 * 
 * @param {Array} transactions - List of recent transactions
 * @param {Object} userContext - Context like monthly income
 * @returns {Object} Detected patterns and health analysis
 */
export async function analyzeSubscriptions(transactions, userContext) {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not defined");
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        // Filter for expenses only
        const expenses = transactions.filter(t => t.type === "EXPENSE");

        // Separate known recurring from others
        const knownRecurring = expenses.filter(t => t.isRecurring);
        const potentialCandidates = expenses.filter(t => !t.isRecurring);

        const prompt = `
      You are a Subscription Manager Agent. Your goal is to identify recurring payments and analyze subscription health.

      Context:
      - Monthly Income: ₹${userContext.monthlyIncome || 0}
      - Known Recurring Bills: ${JSON.stringify(knownRecurring.map(t => ({
            desc: t.description,
            amount: t.amount,
            date: t.date
        })))}

      Analyze these recent transactions for POTENTIAL new recurring subscriptions (e.g., Netflix, Spotify, Gym, Cloud Storage, broadband, etc.):
      ${JSON.stringify(potentialCandidates.map(t => ({
            id: t.id,
            desc: t.description,
            amount: t.amount,
            date: t.date,
            category: t.category
        })))}

      Return a JSON object with this structure:
      {
        "detected_subscriptions": [
          {
            "transaction_id": "id_from_input",
            "name": "Service Name",
            "amount": 100,
            "confidence": "high/medium/low",
            "reason": "Same amount on same day last month"
          }
        ],
        "health_analysis": {
          "score": 85, // 0-100
          "status": "Good/Warning/Critical",
          "total_monthly_cost": 0, // Sum of known + detected
          "income_percentage": 0, // % of income spent on subs
          "insights": [
            "You are spending 5% of your income on entertainment.",
            "Potential duplicate: You have both Apple Music and Spotify."
          ],
          "actionable_recommendations": [
            {
              "title": "Cancel Unused Gym",
              "impact": "Save ₹2000/mo",
              "action": "cancel"
            }
          ]
        }
      }
    `;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        // Clean and parse JSON
        const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();
        return JSON.parse(cleanedText);

    } catch (error) {
        console.error("Subscription Agent Error:", error);
        // Fallback structure
        return {
            detected_subscriptions: [],
            health_analysis: {
                score: 0,
                status: "Unknown",
                total_monthly_cost: 0,
                income_percentage: 0,
                insights: ["AI analysis failed. Please try again."],
                actionable_recommendations: []
            }
        };
    }
}
