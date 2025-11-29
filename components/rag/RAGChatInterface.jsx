"use client";

import { useState } from "react";
import { Send, Sparkles, Loader2, Brain } from "lucide-react";
import { toast } from "sonner";

export default function RAGChatInterface() {
    const [messages, setMessages] = useState([
        {
            role: "assistant",
            content: "👋 Hi! I'm your AI financial advisor powered by advanced RAG technology. Ask me anything about your finances, spending patterns, or financial advice!",
            ragEnabled: false,
        }
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [ragEnabled, setRagEnabled] = useState(true);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput("");
        setMessages(prev => [...prev, { role: "user", content: userMessage }]);
        setIsLoading(true);

        try {
            const response = await fetch("/api/RythmIQ-ai/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: userMessage,
                    useRAG: ragEnabled
                }),
            });

            const data = await response.json();

            if (response.ok) {
                setMessages(prev => [...prev, {
                    role: "assistant",
                    content: data.message,
                    ragEnabled: data.ragEnabled,
                    ragMetadata: data.ragMetadata,
                }]);

                if (data.ragMetadata) {
                    toast.success(`RAG used ${data.ragMetadata.transactionsUsed} transactions & ${data.ragMetadata.knowledgeUsed} knowledge items`);
                }
            } else {
                toast.error(data.error || "Failed to get response");
            }
        } catch (error) {
            console.error("Chat error:", error);
            toast.error("Failed to send message");
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="bg-white rounded-lg border shadow-sm flex flex-col h-[600px]">
            {/* Header */}
            <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                            <Brain className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">
                                AI Financial Advisor
                            </h2>
                            <p className="text-xs text-gray-600">
                                Powered by LangChain RAG + Gemini
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setRagEnabled(!ragEnabled)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${ragEnabled
                                ? "bg-purple-100 text-purple-700 border border-purple-200"
                                : "bg-gray-100 text-gray-600 border border-gray-200"
                            }`}
                    >
                        <Sparkles className="h-3 w-3" />
                        RAG {ragEnabled ? "ON" : "OFF"}
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                        <div
                            className={`max-w-[80%] rounded-lg px-4 py-2 ${msg.role === "user"
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-100 text-gray-900"
                                }`}
                        >
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            {msg.ragEnabled && (
                                <div className="mt-2 pt-2 border-t border-gray-200 flex items-center gap-1 text-xs text-gray-600">
                                    <Sparkles className="h-3 w-3" />
                                    <span>Enhanced with RAG</span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-gray-100 rounded-lg px-4 py-2">
                            <Loader2 className="h-5 w-5 animate-spin text-gray-600" />
                        </div>
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="p-4 border-t bg-gray-50">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Ask about your finances..."
                        className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={isLoading || !input.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Send className="h-5 w-5" />
                    </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                    💡 Try: "How much did I spend on food last month?" or "Give me budgeting tips"
                </p>
            </div>
        </div>
    );
}
