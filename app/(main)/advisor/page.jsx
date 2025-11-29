import React from "react";
import { db } from "@/lib/prisma";
import { checkUser } from "@/lib/checkUser";
import { redirect } from "next/navigation";
import ChatInterface from "@/components/advisor/ChatInterface";
import InsightCard from "@/components/advisor/InsightCard";
import GuardianTrigger from "@/components/advisor/GuardianTrigger";
import CashFlowChart from "@/components/advisor/CashFlowChart";
import SpendingAllowance from "@/components/advisor/SpendingAllowance";
import Jarvis from "@/components/Jarvis";
import RAGChatInterface from "@/components/rag/RAGChatInterface";
import RAGInsightsCard from "@/components/rag/RAGInsightsCard";
import SmartTransactionSearch from "@/components/rag/SmartTransactionSearch";
import { predictCashFlow, calculateHistoricalBalance } from "@/lib/predictions";
import WhatIfSimulator from "@/components/explainability/WhatIfSimulator";

const AdvisorPage = async () => {
    const user = await checkUser();

    if (!user) {
        redirect("/sign-in");
    }

    // Fetch latest insights
    const insights = await db.insight.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 5,
    });

    // Fetch budget for guardian status
    const budget = await db.budget.findUnique({
        where: { userId: user.id },
    });

    // Fetch transactions and accounts for chart
    const transactions = await db.transaction.findMany({
        where: { userId: user.id },
        orderBy: { date: "desc" },
        take: 60,
    });

    const accounts = await db.account.findMany({
        where: { userId: user.id },
    });

    // Calculate chart data
    const totalBalance = accounts.reduce((acc, a) => acc + Number(a.balance), 0);
    const historicalData = calculateHistoricalBalance(transactions, totalBalance, 30);
    const predictedData = predictCashFlow(transactions, accounts, 30);

    return (
        <div className="container mx-auto px-4 py-8">
            {/* Jarvis Voice Assistant */}
            <Jarvis />

            <h1 className="text-3xl font-bold gradient-title mb-8">RythmIQ AI Advisor</h1>

            {/* Guilt-Free Spending Allowance - Hero Section */}
            <div className="mb-8">
                <SpendingAllowance />
            </div>

            {/* Cash Flow Chart */}
            <div className="mb-8 p-6 bg-white rounded-lg border shadow-sm">
                <h2 className="text-xl font-semibold mb-4 text-gray-700">Cash Flow Forecast</h2>
                <CashFlowChart historicalData={historicalData} predictedData={predictedData} />
            </div>

            {/* What-If Simulator */}
            <div className="mb-8">
                <WhatIfSimulator />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Left Column: Insights & Nudges */}
                <div className="md:col-span-1 space-y-6">
                    <div>
                        <h2 className="text-xl font-semibold mb-4 text-gray-700">Financial Nudges</h2>
                        {insights.length > 0 ? (
                            insights.map((insight) => (
                                <InsightCard key={insight.id} insight={insight} />
                            ))
                        ) : (
                            <div className="p-4 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
                                <p>No insights yet. Start chatting or wait for an analysis!</p>
                            </div>
                        )}
                    </div>

                    {/* Safety Guardian Status */}
                    <div className={`p-4 rounded-lg border ${budget?.isLocked ? 'bg-orange-50 border-orange-300' : 'bg-green-50 border-green-300'}`}>
                        <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                            🛡️ Safety Guardian
                        </h3>
                        {budget?.isLocked ? (
                            <div className="text-sm text-orange-700 mb-3">
                                <p className="font-medium">Status: Active Protection</p>
                                <p className="mt-1">Your budget is currently locked to prevent overspending.</p>
                            </div>
                        ) : (
                            <div className="text-sm text-green-700 mb-3">
                                <p className="font-medium">Status: Monitoring</p>
                                <p className="mt-1">Your finances are being monitored. No action needed.</p>
                            </div>
                        )}
                        <GuardianTrigger />
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg border">
                        <h3 className="font-semibold text-gray-700 mb-2">What can I do?</h3>
                        <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                            <li>Analyze your spending habits</li>
                            <li>Predict upcoming expenses</li>
                            <li>Suggest savings opportunities</li>
                            <li>Answer questions about your budget</li>
                        </ul>
                    </div>
                </div>

                {/* Right Column: Chat Interface */}
                <div className="md:col-span-2">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">Chat with RythmIQ AI</h2>
                    <ChatInterface />
                </div>
            </div>

            {/* RAG FEATURES SECTION */}
            <div className="mt-12 space-y-8">
                <div className="border-t pt-8">
                    <h2 className="text-2xl font-bold gradient-title mb-6">Smart Transaction Analysis</h2>

                    {/* RAG Chat + Search Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Smart Search - Full Width on Top */}
                        <div className="lg:col-span-3">
                            <SmartTransactionSearch />
                        </div>

                        {/* RAG Chat - Left Side */}
                        <div className="lg:col-span-2">
                            <div className="bg-white rounded-lg border shadow-sm p-6">
                                <h3 className="text-lg font-semibold mb-4 text-gray-900">Ask About Your Transactions</h3>
                                <RAGChatInterface />
                            </div>
                        </div>

                        {/* RAG Insights - Right Side */}
                        <div className="lg:col-span-1">
                            <div className="bg-white rounded-lg border shadow-sm p-6">
                                <h3 className="text-lg font-semibold mb-4 text-gray-900">Smart Insights</h3>
                                <RAGInsightsCard />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdvisorPage;
