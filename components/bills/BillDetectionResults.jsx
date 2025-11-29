"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function BillDetectionResults({ onBillCreated }) {
    const [suggestions, setSuggestions] = useState([]);
    const [detecting, setDetecting] = useState(false);
    const [loading, setLoading] = useState(false);

    const detectBills = async () => {
        setDetecting(true);
        try {
            const response = await fetch("/api/bills/detect", {
                method: "POST",
            });

            const data = await response.json();
            if (data.success) {
                setSuggestions(data.suggestions);
                toast.success(`Found ${data.suggestions.length} recurring bills!`, {
                    description: `Analyzed ${data.totalAnalyzed} transactions`,
                });
            } else {
                toast.error("Failed to detect bills");
            }
        } catch (error) {
            console.error("Error detecting bills:", error);
            toast.error("Failed to detect bills");
        } finally {
            setDetecting(false);
        }
    };

    const acceptSuggestion = async (suggestion) => {
        setLoading(true);
        try {
            const response = await fetch("/api/bills", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: suggestion.name,
                    category: suggestion.category,
                    amount: suggestion.amount,
                    dueDay: suggestion.dueDay,
                    detectedFrom: suggestion.lastTransaction,
                    confidence: suggestion.confidence,
                }),
            });

            const data = await response.json();
            if (data.success) {
                toast.success(`Added ${suggestion.name} to your bills`);
                setSuggestions(suggestions.filter(s => s !== suggestion));
                onBillCreated?.();
            } else {
                toast.error("Failed to add bill");
            }
        } catch (error) {
            console.error("Error adding bill:", error);
            toast.error("Failed to add bill");
        } finally {
            setLoading(false);
        }
    };

    const rejectSuggestion = (suggestion) => {
        setSuggestions(suggestions.filter(s => s !== suggestion));
        toast.info(`Dismissed ${suggestion.name}`);
    };

    return (
        <div className="space-y-4">
            {suggestions.length === 0 ? (
                <Card>
                    <CardContent className="p-6 text-center">
                        <Sparkles className="h-12 w-12 text-purple-600 mx-auto mb-4" />
                        <h3 className="font-semibold mb-2">Auto-Detect Recurring Bills</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            We'll analyze your transaction history to find recurring payments
                        </p>
                        <Button onClick={detectBills} disabled={detecting}>
                            {detecting ? "Detecting..." : "Detect Bills"}
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold">Detected Bills ({suggestions.length})</h3>
                        <Button variant="outline" size="sm" onClick={detectBills} disabled={detecting}>
                            {detecting ? "Re-detecting..." : "Detect Again"}
                        </Button>
                    </div>

                    <div className="space-y-3">
                        {suggestions.map((suggestion, idx) => (
                            <Card key={idx} className="border-purple-200">
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <h4 className="font-semibold">{suggestion.name}</h4>
                                                <Badge variant="secondary" className="text-xs">
                                                    {suggestion.confidence}% confident
                                                </Badge>
                                            </div>

                                            <div className="space-y-1 text-sm text-muted-foreground">
                                                <div className="flex items-center gap-4">
                                                    <span>Amount: <strong className="text-foreground">₹{suggestion.amount}</strong></span>
                                                    <span>Due: <strong className="text-foreground">Day {suggestion.dueDay}</strong></span>
                                                    <span className="capitalize">{suggestion.category}</span>
                                                </div>
                                                <div className="flex items-center gap-1 text-xs text-purple-600">
                                                    <TrendingUp className="h-3 w-3" />
                                                    <span>Found {suggestion.occurrences} similar transactions</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                onClick={() => acceptSuggestion(suggestion)}
                                                disabled={loading}
                                                className="bg-green-600 hover:bg-green-700"
                                            >
                                                <CheckCircle className="h-4 w-4 mr-1" />
                                                Accept
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => rejectSuggestion(suggestion)}
                                            >
                                                <XCircle className="h-4 w-4 mr-1" />
                                                Dismiss
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
