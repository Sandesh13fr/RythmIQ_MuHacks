import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Tax Estimation Agent for Gig Workers (NO LANGCHAIN)
 * Uses direct Gemini API like the chat code
 */

// Indian Tax Slabs for FY 2024-25 (New Regime)
const TAX_SLABS = [
    { min: 0, max: 300000, rate: 0 },
    { min: 300001, max: 700000, rate: 5 },
    { min: 700001, max: 1000000, rate: 10 },
    { min: 1000001, max: 1200000, rate: 15 },
    { min: 1200001, max: 1500000, rate: 20 },
    { min: 1500001, max: Infinity, rate: 30 },
];

const GST_RATE = 18;
const GST_THRESHOLD = 2000000;

/**
 * Calculate GST liability
 */
export function calculateGST(quarterlyIncome, category = "services") {
    const annualProjection = quarterlyIncome * 4;
    const gstRequired = annualProjection >= GST_THRESHOLD;

    if (!gstRequired) {
        return {
            gstAmount: 0,
            gstRequired: false,
            annualProjection,
            message: "GST registration not required (below ₹20L threshold)",
        };
    }

    const gstAmount = Math.round((quarterlyIncome * GST_RATE) / 100);

    return {
        gstAmount,
        gstRequired: true,
        annualProjection,
        quarterlyIncome,
        gstRate: GST_RATE,
        message: `GST applicable at ${GST_RATE}%`,
    };
}

/**
 * Calculate Income Tax
 */
export function calculateIncomeTax(annualIncome) {
    let taxAmount = 0;
    let previousSlabMax = 0;

    for (const slab of TAX_SLABS) {
        if (annualIncome > slab.min) {
            const taxableInThisSlab = Math.min(annualIncome, slab.max) - previousSlabMax;
            taxAmount += (taxableInThisSlab * slab.rate) / 100;
            previousSlabMax = slab.max;
        }
    }

    const cess = taxAmount * 0.04;
    const totalTax = Math.round(taxAmount + cess);

    return {
        taxAmount: totalTax,
        taxBeforeCess: Math.round(taxAmount),
        cess: Math.round(cess),
        annualIncome,
        effectiveRate: annualIncome > 0 ? ((totalTax / annualIncome) * 100).toFixed(2) : "0.00",
    };
}

/**
 * Generate tax estimate with AI recommendations (using direct Gemini API)
 */
export async function generateTaxEstimate(userId, financialData) {
    try {
        const { quarterlyIncome, annualIncome, category } = financialData;

        // Calculate taxes
        const gstData = calculateGST(quarterlyIncome, category);
        const incomeTaxData = calculateIncomeTax(annualIncome);
        const totalTaxLiability = gstData.gstAmount + incomeTaxData.taxAmount;
        const quarterlyTaxLiability = Math.round(totalTaxLiability / 4);

        // Try to get AI recommendations
        let aiRecommendations = null;

        if (process.env.GEMINI_API_KEY) {
            try {
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

                const prompt = `You are a tax advisor for Indian gig workers.

Financial Data:
- Quarterly Income: ₹${quarterlyIncome}
- Annual Income: ₹${annualIncome}
- GST Liability: ₹${gstData.gstAmount}
- Income Tax: ₹${incomeTaxData.taxAmount}
- Total Tax: ₹${totalTaxLiability}

Provide 3 tax-saving recommendations in JSON format:
{
  "recommendations": [
    {"action": "specific action", "savings": 0, "priority": "high"},
    {"action": "specific action", "savings": 0, "priority": "medium"},
    {"action": "specific action", "savings": 0, "priority": "low"}
  ],
  "urgency": "medium",
  "next_deadline": "Quarterly advance tax - 15th of next month",
  "summary": "one-sentence assessment"
}

Return ONLY valid JSON.`;

                const result = await model.generateContent(prompt);
                const text = result.response.text();

                // Clean and parse
                let cleanText = text.trim();
                if (cleanText.startsWith("```json")) {
                    cleanText = cleanText.replace(/```json\n?/g, "").replace(/```\n?/g, "");
                }
                if (cleanText.startsWith("```")) {
                    cleanText = cleanText.replace(/```\n?/g, "");
                }

                aiRecommendations = JSON.parse(cleanText);
            } catch (aiError) {
                console.error("AI recommendations failed:", aiError);
            }
        }

        // Fallback recommendations
        if (!aiRecommendations) {
            aiRecommendations = {
                recommendations: [
                    { action: "Save monthly for tax payments", savings: 0, priority: "high" },
                    { action: "Maintain expense records for deductions", savings: 0, priority: "medium" },
                    { action: "Consult a CA for tax planning", savings: 0, priority: "low" },
                ],
                urgency: "medium",
                next_deadline: "Quarterly advance tax",
                summary: "Basic tax estimate calculated successfully.",
            };
        }

        return {
            success: true,
            gst: gstData,
            incomeTax: incomeTaxData,
            totalTaxLiability,
            quarterlyTaxLiability,
            suggestedMonthlySavings: Math.round(totalTaxLiability / 12),
            aiRecommendations,
            generatedAt: new Date().toISOString(),
        };
    } catch (error) {
        console.error("Error generating tax estimate:", error);

        const gstData = calculateGST(financialData.quarterlyIncome);
        const incomeTaxData = calculateIncomeTax(financialData.annualIncome);
        const totalTaxLiability = gstData.gstAmount + incomeTaxData.taxAmount;

        return {
            success: false,
            error: error.message,
            gst: gstData,
            incomeTax: incomeTaxData,
            totalTaxLiability,
            quarterlyTaxLiability: Math.round(totalTaxLiability / 4),
            suggestedMonthlySavings: Math.round(totalTaxLiability / 12),
            aiRecommendations: {
                recommendations: [
                    { action: "Save monthly for tax payments", savings: 0, priority: "high" },
                ],
                urgency: "medium",
                next_deadline: "Quarterly advance tax",
                summary: "Tax calculation completed.",
            },
        };
    }
}

// Cache
const taxCache = new Map();

export function getCachedTaxEstimate(userId) {
    const cached = taxCache.get(userId);
    if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
        return cached.data;
    }
    taxCache.delete(userId);
    return null;
}

export function setCachedTaxEstimate(userId, data) {
    taxCache.set(userId, { data, timestamp: Date.now() });
}
