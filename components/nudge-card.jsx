"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function NudgeCard() {
    const [loading, setLoading] = useState(true);
    const [prediction, setPrediction] = useState(null);

    useEffect(() => {
        const fetchPrediction = async () => {
            try {
                const res = await fetch("/api/predict", { method: "POST" });
                const data = await res.json();
                if (data.success) {
                    setPrediction(data);
                }
            } catch (error) {
                console.error("Failed to fetch prediction", error);
            } finally {
                setLoading(false);
            }
        };
        fetchPrediction();
    }, []);

    if (loading) return null;
    if (!prediction) return null;

    const { forecast, risk, minPredicted } = prediction;
    const nextWeekBalance = forecast[6]?.balance;
    const isPositive = nextWeekBalance > forecast[0]?.balance;

    return (
        <Card className={`border-l-4 ${risk === "CRITICAL" ? "border-l-red-500 bg-red-50" : risk === "HIGH" ? "border-l-orange-500 bg-orange-50" : "border-l-green-500 bg-green-50"}`}>
            <CardContent className="p-4">
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className={`font-bold flex items-center gap-2 ${risk === "CRITICAL" ? "text-red-700" : risk === "HIGH" ? "text-orange-700" : "text-green-700"}`}>
                            {risk === "CRITICAL" ? <AlertTriangle className="h-5 w-5" /> : risk === "HIGH" ? <TrendingDown className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
                            {risk === "CRITICAL" ? "Critical Alert: Shortfall Predicted" : risk === "HIGH" ? "Caution: Low Balance Ahead" : "Financial Forecast: Healthy"}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                            Predicted balance in 7 days: <span className="font-bold">₹{nextWeekBalance?.toLocaleString()}</span>
                        </p>
                        {risk !== "LOW" && (
                            <p className="text-xs text-gray-500 mt-2">
                                You are projected to dip as low as <span className="font-bold">₹{minPredicted?.toLocaleString()}</span> this week.
                            </p>
                        )}
                    </div>
                    {risk !== "LOW" && (
                        <Button
                            size="sm"
                            className={`${risk === "CRITICAL" ? "bg-red-600 hover:bg-red-700" : "bg-orange-600 hover:bg-orange-700"} text-white`}
                            onClick={() => toast.success("Action Taken: Spending limits applied.")}
                        >
                            Apply Safety Limits
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
