"use client";

import { useState } from "react";
import { Search, Sparkles, Loader2, X } from "lucide-react";
import { toast } from "sonner";

export default function SmartTransactionSearch() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async () => {
        if (!query.trim() || isSearching) return;

        setIsSearching(true);
        setHasSearched(true);

        try {
            const response = await fetch("/api/RythmIQ-ai/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: query.trim() }),
            });

            const data = await response.json();

            if (data.success) {
                setResults(data.transactions || []);
                if (data.transactions.length === 0) {
                    toast.info("No matching transactions found");
                } else {
                    toast.success(`Found ${data.transactions.length} relevant transactions`);
                }
            } else {
                toast.error(data.error || "Search failed");
                setResults([]);
            }
        } catch (error) {
            console.error("Search error:", error);
            toast.error("Failed to search transactions");
            setResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === "Enter") {
            handleSearch();
        }
    };

    const clearSearch = () => {
        setQuery("");
        setResults([]);
        setHasSearched(false);
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    const formatAmount = (amount) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(amount);
    };

    return (
        <div className="bg-white rounded-lg border shadow-sm p-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-green-500 to-teal-600 rounded-lg">
                    <Search className="h-5 w-5 text-white" />
                </div>
                <div>
                    <h2 className="text-xl font-semibold text-gray-800">
                        Smart Transaction Search
                    </h2>
                    <p className="text-xs text-gray-600">
                        Use natural language to find transactions
                    </p>
                </div>
            </div>

            {/* Search Input */}
            <div className="mb-6">
                <div className="flex gap-2">
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder='Try: "coffee purchases last week" or "uber rides"'
                            className="w-full px-4 py-3 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                            disabled={isSearching}
                        />
                        {query && (
                            <button
                                onClick={clearSearch}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                    <button
                        onClick={handleSearch}
                        disabled={isSearching || !query.trim()}
                        className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                        {isSearching ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <Search className="h-5 w-5" />
                        )}
                        Search
                    </button>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                    <Sparkles className="h-3 w-3" />
                    <span>Powered by semantic search - understands context, not just keywords</span>
                </div>
            </div>

            {/* Results */}
            {hasSearched && (
                <div>
                    {results.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>No transactions found matching your query</p>
                            <p className="text-xs mt-1">Try a different search term</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold text-gray-700">
                                    Found {results.length} transaction{results.length !== 1 ? "s" : ""}
                                </h3>
                            </div>
                            {results.map((tx, idx) => (
                                <div
                                    key={idx}
                                    className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span
                                                    className={`px-2 py-0.5 text-xs font-medium rounded ${tx.type === "INCOME"
                                                            ? "bg-green-100 text-green-700"
                                                            : "bg-red-100 text-red-700"
                                                        }`}
                                                >
                                                    {tx.type}
                                                </span>
                                                {tx.category && (
                                                    <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                                                        {tx.category}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm font-medium text-gray-900">
                                                {tx.description || "No description"}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {formatDate(tx.date)}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p
                                                className={`text-lg font-semibold ${tx.type === "INCOME"
                                                        ? "text-green-600"
                                                        : "text-red-600"
                                                    }`}
                                            >
                                                {tx.type === "INCOME" ? "+" : "-"}
                                                {formatAmount(Math.abs(tx.amount))}
                                            </p>
                                            {tx.relevance && (
                                                <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                                                    <Sparkles className="h-3 w-3" />
                                                    <span>{(tx.relevance * 100).toFixed(0)}% match</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
