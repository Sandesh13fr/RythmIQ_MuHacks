"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Target, Lightbulb, Clock, Zap } from "lucide-react";
import RiskMeter from "@/components/analytics/RiskMeter";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function BehavioralInsightsDashboard() {
    const [insights, setInsights] = useState(null);
    const [effectiveness, setEffectiveness] = useState(null);
    const [trends, setTrends] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch behavioral insights
            const insightsRes = await fetch("/api/analytics/behavioral-insights");
            const insightsData = await insightsRes.json();

            // Fetch effectiveness with trends
            const effectivenessRes = await fetch("/api/analytics/nudge-effectiveness?days=30&trends=true");
            const effectivenessData = await effectivenessRes.json();

            if (insightsData.success) {
                setInsights(insightsData.insights);
            }

            if (effectivenessData.success) {
                setEffectiveness(effectivenessData.effectiveness);
                setTrends(effectivenessData.trends);
            }
        } catch (error) {
            console.error("Error fetching analytics:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
                <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
            </div>
        );
    }

    if (!insights?.hasData) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Behavioral Insights</CardTitle>
                    <CardDescription>Not enough data yet</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">
                        Keep using RythmIQ and providing feedback to build your personalization profile!
                    </p>
                </CardContent>
            </Card>
        );
    }

    // Prepare chart data
    const typeData = effectiveness?.byType
        ? Object.entries(effectiveness.byType).map(([type, metrics]) => ({
            type: type.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
            acceptanceRate: Math.round(metrics.acceptanceRate),
            avgRating: metrics.avgRating,
        }))
        : [];

    const rhythm = insights.rhythm;

    return (
        <div className="space-y-6">
            {/* Overview Stats */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Acceptance Rate</CardTitle>
                        <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {Math.round(insights.acceptanceRate)}%
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {insights.totalNudges} nudges total
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
                        <Zap className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {insights.avgRating.toFixed(1)}/5
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Overall satisfaction
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Preferred Types</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {insights.preferredNudgeTypes.length}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {insights.preferredNudgeTypes.slice(0, 2).join(", ") || "None yet"}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Optimal Time</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {insights.optimalNudgeHour !== null
                                ? `${insights.optimalNudgeHour}:00`
                                : "Learning..."}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Best time for nudges
                        </p>
                    </CardContent>
                </Card>
                <RiskMeter />
            </div>

            {(rhythm?.income || rhythm?.spending) && (
                <Card>
                    <CardHeader>
                        <CardTitle>Income Rhythm & Behavioral Signals</CardTitle>
                        <CardDescription>How the agent adapts to your cashflow patterns</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-6 md:grid-cols-2">
                        {rhythm?.income && (
                            <div className="rounded-lg border p-4">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Income Rhythm</p>
                                <h3 className="text-xl font-semibold mt-1">{rhythm.income.payday || "Learning"}</h3>
                                <ul className="text-sm mt-3 space-y-1 text-muted-foreground">
                                    {rhythm.income.cadence && <li>Cadence: {rhythm.income.cadence}</li>}
                                    {rhythm.income.hourSlot && <li>Payday hour: {rhythm.income.hourSlot}</li>}
                                    {rhythm.income.reliability && <li>Reliability: {rhythm.income.reliability}% of inflows</li>}
                                </ul>
                            </div>
                        )}

                        {rhythm?.spending && (
                            <div className="rounded-lg border p-4">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Spending Watch</p>
                                <ul className="text-sm mt-1 space-y-1 text-muted-foreground">
                                    <li>Weekend share: {rhythm.spending.weekendShare ?? 0}%</li>
                                    <li>Late-night share: {rhythm.spending.lateNightShare ?? 0}%</li>
                                    {Array.isArray(rhythm.spending.highRiskDays) && rhythm.spending.highRiskDays.length > 0 && (
                                        <li>
                                            High-risk days: {rhythm.spending.highRiskDays.map(d => d.weekday).join(", ")}
                                        </li>
                                    )}
                                </ul>
                                {Array.isArray(rhythm.spending.topCategories) && rhythm.spending.topCategories.length > 0 && (
                                    <div className="mt-3">
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Top categories</p>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                            {rhythm.spending.topCategories.map(cat => (
                                                <span key={cat.category} className="text-xs rounded-full bg-muted px-2 py-1">
                                                    {cat.category}: {cat.share}%
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Acceptance Rate Trend */}
            {trends?.success && trends.trends.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Acceptance Rate Trend</CardTitle>
                        <CardDescription>How your engagement is improving over time</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={trends.trends}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="week" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="acceptanceRate"
                                    stroke="#8b5cf6"
                                    strokeWidth={2}
                                    name="Acceptance Rate (%)"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="avgRating"
                                    stroke="#10b981"
                                    strokeWidth={2}
                                    name="Avg Rating"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {/* Effectiveness by Type */}
            {typeData.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Effectiveness by Nudge Type</CardTitle>
                        <CardDescription>Which nudges work best for you</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={typeData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="type" angle={-45} textAnchor="end" height={100} />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="acceptanceRate" fill="#8b5cf6" name="Acceptance Rate (%)" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {/* Recommendations */}
            {insights.recommendations && insights.recommendations.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Lightbulb className="h-5 w-5 text-yellow-500" />
                            Personalization Insights
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {insights.recommendations.map((rec, idx) => (
                                <div key={idx} className="border-l-4 border-purple-500 pl-4 py-2">
                                    <p className="font-medium">{rec.message}</p>
                                    <p className="text-sm text-muted-foreground mt-1">{rec.action}</p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Disliked Types */}
            {insights.dislikedNudgeTypes.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingDown className="h-5 w-5 text-red-500" />
                            Filtered Nudges
                        </CardTitle>
                        <CardDescription>
                            We're avoiding these types based on your feedback
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            {insights.dislikedNudgeTypes.map((type) => (
                                <span
                                    key={type}
                                    className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm"
                                >
                                    {type.replace(/-/g, " ")}
                                </span>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
