"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Lock, ShieldAlert, PhoneCall, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function PanicMode({ balance, riskScore }) {
    const [isPanicActive, setIsPanicActive] = useState(false);
    const [isSpendingLocked, setIsSpendingLocked] = useState(false);

    // Trigger logic: Low balance (< 1000) OR High Risk (> 80)
    const shouldTrigger = (balance < 1000) || (riskScore > 80);

    useEffect(() => {
        if (shouldTrigger) {
            setIsPanicActive(true);
        }
    }, [shouldTrigger]);

    const handleLockSpending = () => {
        setIsSpendingLocked(true);
        toast.error("🚫 Spending Locked", {
            description: "All non-essential categories (Dining, Entertainment) are now blocked.",
            duration: 5000,
        });
    };

    if (!isPanicActive) return null;

    return (
        <div className="fixed inset-x-0 bottom-0 z-50 p-4 md:p-6 animate-in slide-in-from-bottom-10">
            <Card className="bg-red-50 border-2 border-red-500 shadow-2xl max-w-4xl mx-auto overflow-hidden">
                {/* Header */}
                <div className="bg-red-600 px-6 py-3 flex items-center justify-between text-white">
                    <div className="flex items-center gap-2 font-bold text-lg">
                        <ShieldAlert className="h-6 w-6 animate-pulse" />
                        DEBT TRAP RESCUE MODE ACTIVE
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-white hover:bg-red-700"
                        onClick={() => setIsPanicActive(false)}
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                <CardContent className="p-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Left: The Situation */}
                        <div>
                            <h3 className="text-red-800 font-bold text-lg mb-2">⚠️ Critical Financial Health</h3>
                            <p className="text-red-700 mb-4">
                                Your balance is critically low (₹{balance?.toLocaleString()}). You are at high risk of falling into a debt trap.
                            </p>

                            <div className="space-y-3">
                                <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-red-100">
                                    <div className="bg-red-100 p-2 rounded-full">
                                        <Lock className="h-5 w-5 text-red-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">Entertainment Budget</p>
                                        <p className="text-xs text-red-500 font-bold">FROZEN ❄️</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-red-100">
                                    <div className="bg-red-100 p-2 rounded-full">
                                        <AlertTriangle className="h-5 w-5 text-red-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">Risk Score</p>
                                        <p className="text-xs text-red-500 font-bold">{riskScore}/100 (DANGER)</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right: The Solution */}
                        <div className="flex flex-col justify-center space-y-4 border-l border-red-200 pl-6">
                            <h4 className="font-semibold text-gray-900">Immediate Actions Required:</h4>

                            {!isSpendingLocked ? (
                                <Button
                                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-12"
                                    onClick={handleLockSpending}
                                >
                                    <Lock className="mr-2 h-5 w-5" />
                                    LOCK NON-ESSENTIAL SPENDING
                                </Button>
                            ) : (
                                <Button className="w-full bg-gray-800 text-white cursor-not-allowed opacity-80" disabled>
                                    <Lock className="mr-2 h-5 w-5" />
                                    SPENDING LOCKED
                                </Button>
                            )}

                            <Button variant="outline" className="w-full border-red-200 text-red-700 hover:bg-red-50">
                                <PhoneCall className="mr-2 h-4 w-4" />
                                Contact Debt Helpline
                            </Button>

                            <p className="text-xs text-center text-gray-500 mt-2">
                                "We are restricting your wallet to ensure you survive the month." <br />
                                - Your Financial Guardian
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
