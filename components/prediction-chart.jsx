"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, Area, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Info } from "lucide-react";

export default function PredictionChart() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState(7);

    useEffect(() => {
        fetchPredictions();
    }, [days]);

    const fetchPredictions = async () => {
        try {
            setLoading(true);
            const response = await fetch("/api/predict", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ days }),
            });

            const result = await response.json();
            if (result.success) {
                setData(result);
            }
        } catch (error) {
            console.error("Prediction fetch error:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Card className="bg-white border-gray-200">
                <CardContent className="p-6">
                    <div className="animate-pulse space-y-4">
                        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                        <div className="h-64 bg-gray-200 rounded"></div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!data) return null;

    const getTrendIcon = () => {
        if (data.trend === "improving") return <TrendingUp className="h-5 w-5 text-green-600" />;
        if (data.trend === "declining") return <TrendingDown className="h-5 w-5 text-red-600" />;
        return <Minus className="h-5 w-5 text-gray-600" />;
    };

    const getTrendColor = () => {
        if (data.trend === "improving") return "text-green-600";
        if (data.trend === "declining") return "text-red-600";
        return "text-gray-600";
    };

    const getRiskLevel = () => {
        if (data.risk < 30) return { label: "Low", color: "text-green-600", bg: "bg-green-50", icon: CheckCircle };
        if (data.risk < 60) return { label: "Medium", color: "text-yellow-600", bg: "bg-yellow-50", icon: Info };
        return { label: "High", color: "text-red-600", bg: "bg-red-50", icon: AlertTriangle };
    };

    const riskLevel = getRiskLevel();
    const RiskIcon = riskLevel.icon;

    // Format data for chart
    const chartData = data.forecast.map(f => ({
        date: new Date(f.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        balance: f.predicted,
        upper: f.upperBound,
        lower: f.lowerBound,
        confidence: f.confidence,
    }));

    return (
        <div className="space-y-6">
            {/* Time Range Selector */}
            <div className="flex gap-2">
                {[7, 14, 30].map(d => (
                    <button
                        key={d}
                        onClick={() => setDays(d)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${days === d
                                ? "bg-black text-white"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                    >
                        {d} Days
                    </button>
                ))}
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-white border-gray-200">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Trend</p>
                                <p className={`text-lg font-bold ${getTrendColor()} capitalize`}>
                                    {data.trend}
                                </p>
                            </div>
                            {getTrendIcon()}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            {data.trendRate > 0 ? "+" : ""}₹{data.trendRate}/week
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-white border-gray-200">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Confidence</p>
                                <p className="text-lg font-bold text-gray-900">
                                    {data.confidence}%
                                </p>
                            </div>
                            <CheckCircle className="h-5 w-5 text-blue-600" />
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            Prediction accuracy
                        </p>
                    </CardContent>
                </Card>

                <Card className={`${riskLevel.bg} border-gray-200`}>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Risk Score</p>
                                <p className={`text-lg font-bold ${riskLevel.color}`}>
                                    {data.risk}/100
                                </p>
                            </div>
                            <RiskIcon className={`h-5 w-5 ${riskLevel.color}`} />
                        </div>
                        <p className={`text-xs ${riskLevel.color} mt-2`}>
                            {riskLevel.label} risk
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-white border-gray-200">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Minimum</p>
                                <p className="text-lg font-bold text-gray-900">
                                    ₹{data.minPredicted.toFixed(0)}
                                </p>
                            </div>
                            <TrendingDown className="h-5 w-5 text-gray-600" />
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            Lowest predicted
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Chart */}
            <Card className="bg-white border-gray-200">
                <CardHeader>
                    <CardTitle className="text-lg">Balance Forecast with Confidence Interval</CardTitle>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#000000" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="#000000" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis
                                dataKey="date"
                                stroke="#6b7280"
                                style={{ fontSize: '12px' }}
                            />
                            <YAxis
                                stroke="#6b7280"
                                style={{ fontSize: '12px' }}
                                tickFormatter={(value) => `₹${value}`}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'white',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px',
                                    fontSize: '12px'
                                }}
                                formatter={(value, name) => {
                                    if (name === "balance") return [`₹${value.toFixed(0)}`, "Predicted"];
                                    if (name === "upper") return [`₹${value.toFixed(0)}`, "Upper Bound"];
                                    if (name === "lower") return [`₹${value.toFixed(0)}`, "Lower Bound"];
                                    return [value, name];
                                }}
                            />
                            <Legend
                                wrapperStyle={{ fontSize: '12px' }}
                                iconType="line"
                            />

                            {/* Confidence interval area */}
                            <Area
                                type="monotone"
                                dataKey="upper"
                                stroke="none"
                                fill="url(#colorConfidence)"
                                fillOpacity={0.3}
                            />
                            <Area
                                type="monotone"
                                dataKey="lower"
                                stroke="none"
                                fill="url(#colorConfidence)"
                                fillOpacity={0.3}
                            />

                            {/* Main prediction line */}
                            <Line
                                type="monotone"
                                dataKey="balance"
                                stroke="#000000"
                                strokeWidth={3}
                                dot={{ fill: '#000000', r: 4 }}
                                activeDot={{ r: 6 }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>

                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-700">
                            <strong>Daily Net:</strong> ₹{data.metadata.dailyNet}
                            <span className="text-gray-500 ml-2">
                                (Income: ₹{data.metadata.dailyIncome}, Expenses: ₹{data.metadata.dailyExpense})
                            </span>
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Insights */}
            {data.risk > 50 && (
                <Card className="bg-red-50 border-red-200">
                    <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                            <div>
                                <p className="font-medium text-red-900">High Risk Detected</p>
                                <p className="text-sm text-red-700 mt-1">
                                    Your predicted balance may drop below safe levels. Consider reducing expenses or increasing income.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {data.trend === "improving" && (
                <Card className="bg-green-50 border-green-200">
                    <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                            <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
                            <div>
                                <p className="font-medium text-green-900">Positive Trend</p>
                                <p className="text-sm text-green-700 mt-1">
                                    Your finances are improving by ₹{Math.abs(data.trendRate)} per week. Keep it up!
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
