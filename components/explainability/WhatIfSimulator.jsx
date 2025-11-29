"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, DollarSign, ArrowRight, Lightbulb } from "lucide-react";

export default function WhatIfSimulator() {
    const [scenario, setScenario] = useState("spending");
    const [amount, setAmount] = useState(500);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const runSimulation = async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/explainability/what-if", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ scenario, amount }),
            });

            const data = await response.json();
            if (data.success) {
                setResult(data);
            }
        } catch (error) {
            console.error("Simulation error:", error);
        } finally {
            setLoading(false);
        }
    };

    const getRiskColor = (riskLevel) => {
        const colors = {
            low: "text-green-600 bg-green-50",
            medium: "text-yellow-600 bg-yellow-50",
            high: "text-orange-600 bg-orange-50",
            critical: "text-red-600 bg-red-50",
        };
        return colors[riskLevel] || colors.medium;
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                    What-If Simulator
                </CardTitle>
                <CardDescription>
                    See how different decisions would impact your finances
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs value={scenario} onValueChange={setScenario}>
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="spending">
                            <TrendingDown className="h-4 w-4 mr-1" />
                            Spending
                        </TabsTrigger>
                        <TabsTrigger value="saving">
                            <DollarSign className="h-4 w-4 mr-1" />
                            Saving
                        </TabsTrigger>
                        <TabsTrigger value="income">
                            <TrendingUp className="h-4 w-4 mr-1" />
                            Income
                        </TabsTrigger>
                    </TabsList>

                    <div className="mt-6 space-y-4">
                        <div>
                            <Label htmlFor="amount">
                                {scenario === "spending" && "How much do you want to spend?"}
                                {scenario === "saving" && "How much do you want to save?"}
                                {scenario === "income" && "How much extra income?"}
                            </Label>
                            <div className="flex gap-2 mt-2">
                                <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                        ₹
                                    </span>
                                    <Input
                                        id="amount"
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(Number(e.target.value))}
                                        min={0}
                                        className="pl-7"
                                    />
                                </div>
                                <Button onClick={runSimulation} disabled={loading || amount <= 0}>
                                    {loading ? "Simulating..." : "Simulate"}
                                </Button>
                            </div>
                        </div>

                        {result && (
                            <div className="mt-6 space-y-4">
                                {/* Before & After Comparison */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-gray-50 rounded-lg">
                                        <p className="text-sm text-muted-foreground mb-1">Current</p>
                                        <div className="space-y-2">
                                            <div>
                                                <p className="text-xs text-muted-foreground">Balance</p>
                                                <p className="text-lg font-bold">₹{(result.current?.balance || 0).toFixed(0)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">Daily Allowance</p>
                                                <p className="text-sm font-medium">₹{(result.current?.dailyAllowance || 0).toFixed(0)}</p>
                                            </div>
                                            {result.current?.riskLevel && (
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Risk</p>
                                                    <span className={`text-xs px-2 py-1 rounded ${getRiskColor(result.current.riskLevel)}`}>
                                                        {result.current.riskLevel}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
                                        <p className="text-sm text-purple-900 font-medium mb-1">After {scenario}</p>
                                        <div className="space-y-2">
                                            <div>
                                                <p className="text-xs text-purple-700">Balance</p>
                                                <p className="text-lg font-bold text-purple-900">
                                                    ₹{(result.projected?.balance || 0).toFixed(0)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-purple-700">Daily Allowance</p>
                                                <p className="text-sm font-medium text-purple-900">
                                                    ₹{(result.projected?.dailyAllowance || 0).toFixed(0)}
                                                </p>
                                            </div>
                                            {result.projected?.riskLevel && (
                                                <div>
                                                    <p className="text-xs text-purple-700">Risk</p>
                                                    <span className={`text-xs px-2 py-1 rounded ${getRiskColor(result.projected.riskLevel)}`}>
                                                        {result.projected.riskLevel}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Impact Summary */}
                                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                    <h4 className="font-semibold text-blue-900 mb-2">Impact</h4>
                                    <div className="space-y-1 text-sm text-blue-800">
                                        <div className="flex items-center justify-between">
                                            <span>Balance Change:</span>
                                            <span className="font-medium">
                                                {result.impact?.balanceChange > 0 ? "+" : ""}₹{(result.impact?.balanceChange || 0).toFixed(0)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span>Allowance Change:</span>
                                            <span className="font-medium">
                                                {result.impact?.allowanceChange > 0 ? "+" : ""}₹{(result.impact?.allowanceChange || 0).toFixed(0)}/day
                                            </span>
                                        </div>
                                        {result.impact.riskChange && (
                                            <div className="flex items-center justify-between">
                                                <span>Risk Change:</span>
                                                <span className="font-medium">{result.impact.riskChange}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Recommendation */}
                                <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-white rounded-full">
                                            <Lightbulb className="h-5 w-5 text-purple-600" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-semibold text-purple-900 mb-1">Recommendation</h4>
                                            <p className="text-sm text-purple-800">{result.recommendation}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Additional Info for Saving/Income */}
                                {scenario === "saving" && result.impact?.yearlyProjection && (
                                    <div className="p-3 bg-green-50 rounded text-sm text-green-800">
                                        <strong>Long-term benefit:</strong> {result.impact.yearlyProjection}
                                    </div>
                                )}

                                {scenario === "income" && result.projected?.safeToSave && (
                                    <div className="p-3 bg-green-50 rounded text-sm text-green-800">
                                        <strong>Safe to save:</strong> ₹{result.projected.safeToSave.toFixed(0)} from this income
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </Tabs>
            </CardContent>
        </Card>
    );
}
