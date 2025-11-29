import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/lib/prisma";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "embedding-001" });

/**
 * Generate embedding for a text string using Gemini
 * @param {string} text 
 * @returns {Promise<number[]>} 768-dimensional vector
 */
export async function generateEmbedding(text) {
    try {
        const result = await model.embedContent(text);
        const embedding = result.embedding;
        return embedding.values;
    } catch (error) {
        console.error("Error generating embedding:", error);
        return null;
    }
}

/**
 * Search for transactions similar to the query
 * @param {string} query - User's question
 * @param {string} userId - Current user ID
 * @param {number} limit - Number of results to return
 * @returns {Promise<any[]>} List of relevant transactions
 */
export async function searchTransactions(query, userId, limit = 5) {
    try {
        const embedding = await generateEmbedding(query);
        if (!embedding) return [];

        // Convert embedding to string format for SQL
        const vectorString = `[${embedding.join(",")}]`;

        // Perform vector search using cosine similarity
        // Note: We cast the embedding column to vector type for the operation
        const transactions = await db.$queryRaw`
      SELECT 
        id, 
        amount, 
        description, 
        date, 
        category, 
        type,
        1 - (embedding <=> ${vectorString}::vector) as similarity
      FROM transactions
      WHERE "userId" = ${userId}
      AND embedding IS NOT NULL
      ORDER BY similarity DESC
      LIMIT ${limit};
    `;

        return transactions;
    } catch (error) {
        console.error("Error searching transactions:", error);
        return [];
    }
}

/**
 * Create a text representation of a transaction for embedding
 * @param {object} transaction 
 * @returns {string}
 */
export function transactionToText(transaction) {
    return `
    ${transaction.type} of ${transaction.amount} 
    for ${transaction.description} 
    in category ${transaction.category} 
    on ${new Date(transaction.date).toLocaleDateString()}
  `.trim().replace(/\s+/g, " ");
}
