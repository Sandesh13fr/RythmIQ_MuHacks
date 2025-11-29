import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

// Simple in-memory vector store implementation to avoid dependency issues
class SimpleVectorStore {
    constructor(embeddings) {
        this.embeddings = embeddings;
        this.documents = []; // { pageContent, metadata, vector }
    }

    async addDocuments(docs) {
        const texts = docs.map(d => d.pageContent);
        const vectors = await this.embeddings.embedDocuments(texts);

        docs.forEach((doc, i) => {
            this.documents.push({
                pageContent: doc.pageContent,
                metadata: doc.metadata,
                vector: vectors[i]
            });
        });
    }

    async similaritySearchWithScore(query, k = 5) {
        const queryVector = await this.embeddings.embedQuery(query);

        const results = this.documents.map(doc => {
            const similarity = this.cosineSimilarity(queryVector, doc.vector);
            return { doc, score: similarity };
        });

        // Sort by similarity (descending)
        results.sort((a, b) => b.score - a.score);

        // Return top k
        return results.slice(0, k).map(r => [r.doc, r.score]);
    }

    cosineSimilarity(a, b) {
        let dot = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}

let store = null;

/**
 * Initialize the vector store with Gemini embeddings
 */
export async function initVectorStore() {
    if (store) {
        return store;
    }

    try {
        // Use RAG-specific API key if available, otherwise use main key
        const ragApiKey = process.env.GEMINI_API_KEY_RAG;
        const apiKey = ragApiKey || process.env.GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error("Gemini API key is missing (checked GEMINI_API_KEY_RAG and GEMINI_API_KEY)");
        }

        const embeddings = new GoogleGenerativeAIEmbeddings({
            apiKey: apiKey,
            modelName: "embedding-001",
        });

        store = new SimpleVectorStore(embeddings);

        console.log("✅ Custom in-memory vector store initialized (using", ragApiKey ? "GEMINI_API_KEY_RAG" : "GEMINI_API_KEY", ")");
        return store;
    } catch (error) {
        console.error("Error initializing vector store:", error);
        throw error;
    }
}

/**
 * Add documents to the vector store
 */
export async function addDocuments(documents) {
    const vectorStore = await initVectorStore();
    await vectorStore.addDocuments(documents);
    return documents.map((_, i) => `doc_${Date.now()}_${i}`);
}

/**
 * Search for similar documents
 */
export async function searchSimilar(query, limit = 5) {
    const vectorStore = await initVectorStore();

    // Perform similarity search
    const results = await vectorStore.similaritySearchWithScore(query, limit);

    // Format results
    return results.map(([doc, score]) => ({
        content: doc.pageContent,
        metadata: doc.metadata,
        distance: score // We use score as distance/relevance here
    }));
}

/**
 * Add user's transaction history to vector store for context
 */
export async function indexUserTransactions(userId, transactions) {
    const documents = transactions.map(tx => ({
        pageContent: `Transaction: ${tx.type} of $${Number(tx.amount).toFixed(2)} for ${tx.description} on ${new Date(tx.date).toLocaleDateString()}. Category: ${tx.category || 'uncategorized'}`,
        metadata: {
            userId,
            transactionId: tx.id,
            type: tx.type,
            amount: Number(tx.amount),
            category: tx.category,
            date: tx.date.toString()
        }
    }));

    return await addDocuments(documents);
}

/**
 * Search user's transaction history
 */
export async function searchUserTransactions(userId, query, limit = 10) {
    try {
        // First, try to get and index user's recent transactions if not already in store
        const { db } = await import("@/lib/prisma");
        
        if (!userId) {
            console.warn("No userId provided for transaction search");
            return [];
        }

        // Get user's transactions
        const userTransactions = await db.transaction.findMany({
            where: { 
                userId: userId
            },
            orderBy: { date: "desc" },
            take: 500
        });

        console.log(`Found ${userTransactions.length} transactions for user ${userId}`);

        // If there are transactions, index them (they'll only be added if not already present)
        if (userTransactions.length > 0) {
            try {
                await indexUserTransactions(userId, userTransactions);
                console.log(`Indexed ${userTransactions.length} transactions`);
            } catch (indexError) {
                console.error("Error indexing transactions:", indexError);
            }
        } else {
            console.warn(`No transactions found for user ${userId} - RAG will have limited context`);
        }

        // Now search
        const results = await searchSimilar(query, limit * 2);

        console.log(`Search found ${results.length} potential results, filtering for userId ${userId}`);

        // Filter by userId and return top matches
        const filtered = results
            .filter(r => r.metadata && r.metadata.userId === userId)
            .slice(0, limit);

        console.log(`Returning ${filtered.length} filtered results`);
        return filtered;
    } catch (error) {
        if (error?.code === "P1001") {
            console.error("Database unreachable while searching transactions. Returning empty results to keep chat responsive.");
        } else {
            console.error("Error searching user transactions:", error);
        }
        return [];
    }
}
