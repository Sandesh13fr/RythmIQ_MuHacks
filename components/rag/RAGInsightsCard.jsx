"use client";

import { useEffect, useState } from "react";
import { Sparkles, TrendingUp, AlertCircle, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function RAGInsightsCard() {
    const [insights, setInsights] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchInsights();
    }, []);

    const fetchInsights = async () => {
        setIsLoading(true);
        try {
            const response = await fetch("/api/RythmIQ-ai/insights");
            const data = await response.json();

            if (data.success && data.insights) {
                setInsights(data.insights);
            } else {
                toast.error("Failed to load insights");
            }
        } catch (error) {
            console.error("Error fetching insights:", error);
            toast.error("Failed to load insights");
        } finally {
            setIsLoading(false);
        }
    };

    const getIcon = (type) => {
        switch (type) {
            case "success":
                return "✅";
            case "warning":
                return "⚠️";
            case "danger":
                return "🚨";
            case "info":
            default:
                return "💡";
        }
    };

    const getColorClasses = (type) => {
        switch (type) {
            case "success":
                return "bg-green-50 border-green-200 text-green-900";
            case "warning":
                return "bg-yellow-50 border-yellow-200 text-yellow-900";
            case "danger":
                return "bg-red-50 border-red-200 text-red-900";
            case "info":
            default:
                return "bg-blue-50 border-blue-200 text-blue-900";
        }
    };

    if (isLoading) {
        return (
            <div className="bg-white rounded-lg border shadow-sm p-6">
                <div className="flex items-center justify-center h-48">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg border shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg">
                        <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-gray-800">
                            RAG-Powered Insights
                        </h2>
                        <p className="text-xs text-gray-600">
                            AI-analyzed from your spending patterns
                        </p>
                    </div>
                </div>
                <button
                    onClick={fetchInsights}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                    Refresh
                </button>
            </div>

            {insights.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                    <Info className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No insights available yet. Add more transactions to get started!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {insights.map((insight, index) => (
                        <div
                            key={index}
                            className={`p-4 rounded-lg border ${getColorClasses(insight.type)}`}
                        >
                            <div className="flex items-start gap-3">
                                <span className="text-2xl flex-shrink-0">
                                    {insight.icon || getIcon(insight.type)}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm mb-1">
                                        {insight.message}
                                    </p>
                                    <p className="text-xs opacity-80">
                                        {insight.detail}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Sparkles className="h-3 w-3" />
                    <span>Powered by LangChain RAG + Gemini AI</span>
                </div>
            </div>
        </div>
    );
}
