import { getNudgeHistory, getNudgeMetrics } from "@/actions/nudge-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, CheckCircle, XCircle, Clock, DollarSign, Bell, AlertCircle, Zap } from "lucide-react";
import { checkUser } from "@/lib/checkUser";

const NUDGE_ICONS = {
    "auto-save": DollarSign,
    "bill-pay": Bell,
    "spending-alert": AlertCircle,
    "income-opportunity": TrendingUp,
    "emergency-buffer": Zap,
};

const STATUS_COLORS = {
    executed: "bg-green-500/10 text-green-400 border-green-500/20",
    rejected: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    expired: "bg-red-500/10 text-red-400 border-red-500/20",
};

const STATUS_ICONS = {
    executed: CheckCircle,
    rejected: XCircle,
    pending: Clock,
    expired: AlertCircle,
};

export default async function NudgesPage() {
    await checkUser();

    const [historyResult, metricsResult] = await Promise.all([
        getNudgeHistory(50),
        getNudgeMetrics(),
    ]);

    const nudges = historyResult.nudges || [];
    const metrics = metricsResult.metrics || {
        total: 0,
        accepted: 0,
        rejected: 0,
        pending: 0,
        acceptanceRate: "0",
        totalImpact: "0",
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <Sparkles className="h-8 w-8 text-purple-400" />
                    AI Suggestions
                </h1>
                <p className="text-gray-400 mt-1">
                    Track your financial nudges and see the impact of AI-powered suggestions
                </p>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-400">Total Impact</p>
                                <p className="text-2xl font-bold text-green-400">
                                    ₹{metrics.totalImpact}
                                </p>
                            </div>
                            <DollarSign className="h-10 w-10 text-green-400 opacity-50" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-400">Acceptance Rate</p>
                                <p className="text-2xl font-bold text-blue-400">
                                    {metrics.acceptanceRate}%
                                </p>
                            </div>
                            <TrendingUp className="h-10 w-10 text-blue-400 opacity-50" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-400">Accepted</p>
                                <p className="text-2xl font-bold text-purple-400">
                                    {metrics.accepted}
                                </p>
                            </div>
                            <CheckCircle className="h-10 w-10 text-purple-400 opacity-50" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-gray-500/10 to-slate-500/10 border-gray-500/20">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-400">Total Nudges</p>
                                <p className="text-2xl font-bold text-gray-300">
                                    {metrics.total}
                                </p>
                            </div>
                            <Sparkles className="h-10 w-10 text-gray-400 opacity-50" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Nudge History */}
            <Card>
                <CardHeader>
                    <CardTitle>Suggestion History</CardTitle>
                </CardHeader>
                <CardContent>
                    {nudges.length === 0 ? (
                        <div className="text-center py-12">
                            <Sparkles className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                            <p className="text-gray-400">No suggestions yet</p>
                            <p className="text-sm text-gray-500 mt-2">
                                Check back tomorrow for personalized financial nudges!
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {nudges.map((nudge) => {
                                const Icon = NUDGE_ICONS[nudge.nudgeType] || Sparkles;
                                const StatusIcon = STATUS_ICONS[nudge.status] || Clock;
                                const statusColor = STATUS_COLORS[nudge.status] || STATUS_COLORS.pending;

                                return (
                                    <div
                                        key={nudge.id}
                                        className="border border-gray-800 rounded-lg p-4 hover:bg-gray-900/50 transition-colors"
                                    >
                                        <div className="flex items-start gap-4">
                                            {/* Icon */}
                                            <div className="mt-1">
                                                <Icon className="h-5 w-5 text-purple-400" />
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <p className="text-sm font-medium text-white">
                                                            {nudge.message}
                                                        </p>
                                                        <p className="text-xs text-gray-400 mt-1">
                                                            {nudge.reason}
                                                        </p>
                                                    </div>

                                                    {/* Status Badge */}
                                                    <Badge
                                                        variant="outline"
                                                        className={`${statusColor} flex items-center gap-1`}
                                                    >
                                                        <StatusIcon className="h-3 w-3" />
                                                        {nudge.status}
                                                    </Badge>
                                                </div>

                                                {/* Metadata */}
                                                <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                                                    <span>
                                                        {new Date(nudge.createdAt).toLocaleDateString("en-US", {
                                                            month: "short",
                                                            day: "numeric",
                                                            year: "numeric",
                                                        })}
                                                    </span>

                                                    {nudge.amount && (
                                                        <span className="text-white font-medium">
                                                            ₹{parseFloat(nudge.amount).toFixed(0)}
                                                        </span>
                                                    )}

                                                    {nudge.impact && nudge.status === "executed" && (
                                                        <span className="text-green-400 font-medium">
                                                            Impact: +₹{parseFloat(nudge.impact).toFixed(0)}
                                                        </span>
                                                    )}

                                                    {nudge.priority >= 8 && (
                                                        <span className="text-red-400 flex items-center gap-1">
                                                            <Zap className="h-3 w-3" />
                                                            Urgent
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Insights */}
            {metrics.total > 0 && (
                <Card className="bg-gradient-to-br from-purple-500/5 to-pink-500/5 border-purple-500/10">
                    <CardHeader>
                        <CardTitle className="text-lg">💡 Insights</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        {metrics.acceptanceRate > 70 && (
                            <p className="text-gray-300">
                                ✨ Great job! You're accepting {metrics.acceptanceRate}% of suggestions. This shows strong financial discipline.
                            </p>
                        )}

                        {metrics.totalImpact > 1000 && (
                            <p className="text-green-400">
                                💰 You've saved ₹{metrics.totalImpact} by following AI suggestions!
                            </p>
                        )}

                        {metrics.pending > 0 && (
                            <p className="text-yellow-400">
                                ⏰ You have {metrics.pending} pending suggestion{metrics.pending > 1 ? "s" : ""}. Check your dashboard!
                            </p>
                        )}

                        {metrics.total >= 10 && metrics.acceptanceRate < 30 && (
                            <p className="text-gray-400">
                                🤔 You're rejecting most suggestions. We'll learn your preferences and improve recommendations.
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
