import { GoogleGenerativeAI } from "@google/generative-ai";
import { checkUser } from "@/lib/checkUser";
import { db } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { chatWithFinances } from "@/lib/rag/langchain-rag";
import { sanitizeAIResponse } from "@/lib/security/sanitize-ai";
import { checkRateLimit } from "@/lib/security/rate-limiter";

export async function POST(req) {
  try {
    const user = await checkUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check rate limit
    const rateLimitCheck = checkRateLimit(user.id, "/api/RythmIQ-ai/chat");
    if (rateLimitCheck.exceeded) {
      return NextResponse.json(rateLimitCheck.response, {
        status: 429,
        headers: rateLimitCheck.headers,
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is not defined");
      return NextResponse.json({ error: "API Key missing" }, { status: 500 });
    }

    const body = await req.json();
    const { message } = body;
    let { useRAG = true } = body;

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // 1. Fetch User Context (Transactions & Budget)
    const transactions = await db.transaction.findMany({
      where: { userId: user.id },
      orderBy: { date: "desc" },
      take: 50, // Increased for better RAG context
    });

    const budget = await db.budget.findUnique({
      where: { userId: user.id },
    });

    const accounts = await db.account.findMany({
      where: { userId: user.id },
    });

    const totalBalance = accounts.reduce((acc, a) => acc + Number(a.balance), 0);

    // Calculate monthly stats
    const currentMonth = new Date();
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

    const savingsRate = monthlyIncome > 0
      ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100
      : 0;

    let response;
    let ragMetadata = null;

    // 2. Use RAG-powered chat if enabled
    if (useRAG) {
      try {
        const userContext = {
          totalBalance,
          monthlyIncome,
          monthlyExpenses,
          savingsRate: savingsRate.toFixed(1),
          accountCount: accounts.length,
          transactionCount: transactions.length,
        };

        const ragResult = await chatWithFinances(user.id, message, userContext);

        if (ragResult.success) {
          response = ragResult.response;
          ragMetadata = ragResult.context;
        } else {
          // Fallback to standard chat if RAG fails
          console.warn("RAG failed, using standard chat:", ragResult.error);
          useRAG = false;
        }
      } catch (ragError) {
        console.error("RAG error, falling back to standard chat:", ragError);
        useRAG = false;
      }
    }

    // 3. Fallback to standard Gemini chat
    if (!useRAG || !response) {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

      const context = `
        User: ${user.name}
        Total Balance: ₹${totalBalance}
        Monthly Income: ₹${monthlyIncome}
        Monthly Expenses: ₹${monthlyExpenses}
        Savings Rate: ${savingsRate.toFixed(1)}%
        Budget: ${budget ? `₹${budget.amount}` : "Not set"}
        Recent Transactions:
        ${transactions.slice(0, 5).map((t) => `- ${t.date.toISOString().split('T')[0]}: ${t.description} (₹${t.amount}) [${t.type}]`).join("\n")}
      `;

      const prompt = `
        You are RythmIQ AI, a financial advisor for gig economy workers.
        Your goal is to provide proactive, empathetic, and actionable financial advice.
        
        User Context:
        ${context}

        User Message: "${message}"

        Respond to the user in a helpful and concise manner. Focus on their financial well-being.
      `;

      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent(prompt);
      response = result.response.text();
    }

    // 4. Save Chat History
    await db.chatMessage.createMany({
      data: [
        { userId: user.id, role: "user", content: message },
        { userId: user.id, role: "assistant", content: response },
      ],
    });

    // 5. Sanitize response before sending to client
    const sanitizedResponse = sanitizeAIResponse(response);

    return NextResponse.json(
      {
        message: sanitizedResponse,
        ragEnabled: useRAG,
        ragMetadata,
      },
      { headers: rateLimitCheck.headers }
    );

  } catch (error) {
    console.error("Error in RythmIQ AI Chat:", error);
    return NextResponse.json(
      {
        error: error.message || "Internal Server Error",
        success: false,
      },
      { status: 500 }
    );
  }
}
