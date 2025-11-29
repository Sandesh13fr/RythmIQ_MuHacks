import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { searchSimilar, searchUserTransactions } from "./vector-store";

/**
 * Financial Knowledge Base - Free educational content
 */
const FINANCIAL_KNOWLEDGE = [
    {
        topic: "budgeting",
        content: "The 50/30/20 rule: Allocate 50% of income to needs, 30% to wants, and 20% to savings and debt repayment."
    },
    {
        topic: "emergency_fund",
        content: "Build an emergency fund covering 3-6 months of expenses before investing aggressively."
    },
    {
        topic: "debt_management",
        content: "Pay off high-interest debt first (avalanche method) or smallest debts first (snowball method) for psychological wins."
    },
    {
        topic: "investing",
        content: "Start with low-cost index funds. Diversification reduces risk. Time in the market beats timing the market."
    },
    {
        topic: "tax_saving",
        content: "For gig workers: Track all business expenses, set aside 25-30% for taxes, make quarterly estimated payments."
    },
    {
        topic: "credit_score",
        content: "Pay bills on time, keep credit utilization below 30%, don't close old accounts, and check credit reports regularly."
    }
];

// Helper to clean JSON from markdown code blocks
function cleanJson(text) {
    if (typeof text !== 'string') return text;
    return text.replace(/```json/g, "").replace(/```/g, "").trim();
}

/**
 * Initialize LangChain with Gemini (FREE tier)
 */
export function createFinancialChatbot(apiKey) {
    // Use RAG-specific API key if available, otherwise fall back to main GEMINI_API_KEY
    const ragApiKey = process.env.GEMINI_API_KEY_RAG;
    const mainApiKey = process.env.GEMINI_API_KEY;
    const finalApiKey = apiKey || ragApiKey || mainApiKey;
    
    console.log("🔍 API Key Debug:");
    console.log("  - GEMINI_API_KEY_RAG:", ragApiKey ? "✅ Set" : "❌ Not set");
    console.log("  - GEMINI_API_KEY:", mainApiKey ? "✅ Set" : "❌ Not set");
    console.log("  - Using:", ragApiKey ? "GEMINI_API_KEY_RAG" : mainApiKey ? "GEMINI_API_KEY" : "None");
    
    if (!finalApiKey) {
        console.error("❌ No Gemini API key available (checked GEMINI_API_KEY_RAG and GEMINI_API_KEY)");
        throw new Error("Gemini API key is required for RAG system");
    }

    try {
        const model = new ChatGoogleGenerativeAI({
            apiKey: finalApiKey,
            model: "gemini-2.0-flash",
            temperature: 0.7,
            maxOutputTokens: 1024,
        });

        console.log("✅ ChatGoogleGenerativeAI initialized successfully");
        return model;
    } catch (error) {
        console.error("❌ Error creating ChatGoogleGenerativeAI:", error);
        throw error;
    }
}

/**
 * RAG-powered chat with financial context
 */
export async function chatWithFinances(userId, userMessage, userContext = {}) {
    try {
        if (!process.env.GEMINI_API_KEY) {
            console.warn("⚠️ GEMINI_API_KEY not available for RAG chat");
            return {
                success: false,
                error: "API key not configured",
                response: "I'm not configured yet. Please set up your Gemini API key."
            };
        }

        // 1. Search relevant transactions
        const relevantTransactions = await searchUserTransactions(
            userId,
            userMessage,
            5
        );

        // 2. Search financial knowledge base
        const relevantKnowledge = FINANCIAL_KNOWLEDGE.filter(item =>
            userMessage.toLowerCase().includes(item.topic.replace('_', ' '))
        );

        // 3. Build context
        const context = `
User's Financial Summary:
- Total Balance: $${userContext.totalBalance || 0}
- Monthly Income: $${userContext.monthlyIncome || 'N/A'}
- Monthly Expenses: $${userContext.monthlyExpenses || 'N/A'}

Recent Relevant Transactions:
${relevantTransactions.map(tx => `- ${tx.content}`).join('\n') || 'No recent transactions found'}

Relevant Financial Knowledge:
${relevantKnowledge.map(k => `- ${k.content}`).join('\n') || 'General financial advice available'}
        `.trim();

        // 4. Create chat chain using LCEL (Modern LangChain)
        const model = createFinancialChatbot();

        const prompt = PromptTemplate.fromTemplate(`
You are a helpful financial advisor assistant for RythmIQ, a personal finance app.
You provide clear, actionable financial advice based on the user's context.

Context from user's financial data:
{context}

User question: {input}

Provide a helpful, concise response. If discussing money, use specific numbers from the context.
Be encouraging and practical. Keep responses under 150 words unless detailed analysis is requested.

Response:`);

        const chain = RunnableSequence.from([
            prompt,
            model,
            new StringOutputParser()
        ]);

        // 5. Get response
        const response = await chain.invoke({
            input: userMessage,
            context: context
        });

        return {
            success: true,
            response: response,
            context: {
                transactionsUsed: relevantTransactions.length,
                knowledgeUsed: relevantKnowledge.length
            }
        };
    } catch (error) {
        console.error("Error in RAG chat:", error);
        return {
            success: false,
            error: error.message,
            response: "I'm having trouble processing your request. Please try again."
        };
    }
}

/**
 * Generate smart financial insights using RAG
 */
export async function generateSmartInsights(userId, userFinancialData) {
    try {
        if (!process.env.GEMINI_API_KEY) {
            console.warn("⚠️ GEMINI_API_KEY not available, returning default insights");
            return {
                success: true,
                insights: [
                    { category: "budget", tip: "Set a budget to track your spending patterns" },
                    { category: "savings", tip: "Aim to save at least 20% of your income" }
                ]
            };
        }

        const model = createFinancialChatbot();

        // Search for spending patterns
        const spendingPatterns = await searchUserTransactions(
            userId,
            "spending expenses purchases",
            20
        );

        const prompt = PromptTemplate.fromTemplate(`
Analyze this financial data and provide 3-4 actionable insights:

Total Balance: $${userFinancialData.totalBalance}
Monthly Income: $${userFinancialData.monthlyIncome}
Monthly Expenses: $${userFinancialData.monthlyExpenses}
Savings Rate: ${userFinancialData.savingsRate}%

Recent Spending Patterns:
{spendingPatterns}

Provide insights in this JSON format:
[
  {
    "type": "success|warning|danger|info",
    "icon": "emoji",
    "message": "Short headline",
    "detail": "Actionable advice"
  }
]

Focus on: spending patterns, savings opportunities, budget optimization, and financial health.
`);

        const chain = RunnableSequence.from([
            prompt,
            model,
            new StringOutputParser()
        ]);

        const result = await chain.invoke({
            spendingPatterns: spendingPatterns.map(p => p.content).join('\n')
        });

        const cleanContent = cleanJson(result);
        const insights = JSON.parse(cleanContent);

        return {
            success: true,
            insights
        };
    } catch (error) {
        console.error("Error generating insights:", error);
        return {
            success: false,
            insights: []
        };
    }
}

/**
 * Smart transaction search using natural language
 */
export async function smartTransactionSearch(userId, naturalQuery) {
    try {
        if (!process.env.GEMINI_API_KEY) {
            console.warn("⚠️ GEMINI_API_KEY not available for search");
            return {
                success: false,
                transactions: [],
                message: "RAG search not available - API key missing"
            };
        }

        const results = await searchUserTransactions(userId, naturalQuery, 10);

        return {
            success: true,
            transactions: results.map(r => ({
                ...r.metadata,
                relevance: r.distance // In MemoryVectorStore with default settings, distance is often similarity score
            }))
        };
    } catch (error) {
        console.error("Error in smart search:", error);
        return {
            success: false,
            transactions: [],
            error: error.message
        };
    }
}

export { FINANCIAL_KNOWLEDGE };
