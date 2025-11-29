import { checkUser } from "@/lib/checkUser";
import { getNudgeMetrics, getNudgeHistory } from "@/actions/nudge-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Target, CheckCircle, DollarSign, Activity, Award } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default async function MetricsPage() {
    await checkUser();

    const [metricsResult, historyResult] = await Promise.all([
        getNudgeMetrics(),
        getNudgeHistory(100),
    ]);

    const metrics = metricsResult.metrics || {
        total: 0,
        accepted: 0,
        rejected: 0,
        pending: 0,
        acceptanceRate: 0,
        totalImpact: 0,
    };

    const nudges = historyResult.nudges || [];

    // Calculate additional metrics
    const avgImpact = metrics.accepted > 0
        ? (parseFloat(metrics.totalImpact) / metrics.accepted).toFixed(0)
        : 0;

    // Group nudges by type
    const nudgesByType = nudges.reduce((acc, nudge) => {
        acc[nudge.nudgeType] = (acc[nudge.nudgeType] || 0) + 1;
        return acc;
    }, {});

    const typeData = Object.entries(nudgesByType).map(([type, count]) => ({
        name: type.replace("-", " ").replace(/\b\w/g, l => l.toUpperCase()),
        value: count,
    }));

    // Group by status for pie chart
    const statusData = [
        { name: "Accepted", value: metrics.accepted, color: "#10b981" },
        { name: "Rejected", value: metrics.rejected, color: "#ef4444" },
        { name: "Pending", value: metrics.pending, color: "#f59e0b" },
    ].filter(d => d.value > 0);

    // Weekly trend data
    const weeklyData = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const dayNudges = nudges.filter(n =>
            new Date(n.createdAt).toISOString().split('T')[0] === dateStr
        );

        weeklyData.push({
            day: date.toLocaleDateString("en-US", { weekday: "short" }),
            accepted: dayNudges.filter(n => n.status === "executed").length,
            rejected: dayNudges.filter(n => n.status === "rejected").length,
        });
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">AI Performance Metrics</h1>
                <p className="text-gray-600 mt-2">Track your AI assistant's impact on your finances</p>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-green-700 font-medium">Total Impact</p>
                                <p className="text-3xl font-bold text-green-900 mt-1">
                                    ₹{metrics.totalImpact}
                                </p>
                            </div>
                            <DollarSign className="h-10 w-10 text-green-600" />
                        </div>
                        <p className="text-xs text-green-600 mt-2">Money saved through AI suggestions</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-blue-700 font-medium">Acceptance Rate</p>
                                <p className="text-3xl font-bold text-blue-900 mt-1">
                                    {metrics.acceptanceRate}%
                                </p>
                            </div>
                            <Target className="h-10 w-10 text-blue-600" />
                        </div>
                        <p className="text-xs text-blue-600 mt-2">
                            {metrics.accepted} of {metrics.total} suggestions accepted
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-purple-700 font-medium">Avg Impact</p>
                                <p className="text-3xl font-bold text-purple-900 mt-1">
                                    ₹{avgImpact}
                                </p>
                            </div>
                            <TrendingUp className="h-10 w-10 text-purple-600" />
                        </div>
                        <p className="text-xs text-purple-600 mt-2">Per accepted suggestion</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-orange-700 font-medium">Total Nudges</p>
                                <p className="text-3xl font-bold text-orange-900 mt-1">
                                    {metrics.total}
                                </p>
                            </div>
                            <Activity className="h-10 w-10 text-orange-600" />
                        </div>
                        <p className="text-xs text-orange-600 mt-2">AI suggestions generated</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Weekly Activity */}
                <Card className="bg-white border-gray-200">
                    <CardHeader>
                        <CardTitle className="text-lg">Weekly Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={weeklyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis dataKey="day" stroke="#6b7280" style={{ fontSize: '12px' }} />
                                <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'white',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '8px',
                                        fontSize: '12px'
                                    }}
                                />
                                <Legend wrapperStyle={{ fontSize: '12px' }} />
                                <Bar dataKey="accepted" fill="#10b981" name="Accepted" />
                                <Bar dataKey="rejected" fill="#ef4444" name="Rejected" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Status Distribution */}
                <Card className="bg-white border-gray-200">
                    <CardHeader>
                        <CardTitle className="text-lg">Suggestion Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={statusData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {statusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Nudge Types */}
            {typeData.length > 0 && (
                <Card className="bg-white border-gray-200">
                    <CardHeader>
                        <CardTitle className="text-lg">Suggestions by Type</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={typeData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis type="number" stroke="#6b7280" style={{ fontSize: '12px' }} />
                                <YAxis dataKey="name" type="category" stroke="#6b7280" style={{ fontSize: '12px' }} width={120} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'white',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '8px',
                                        fontSize: '12px'
                                    }}
                                />
                                <Bar dataKey="value" fill="#000000" name="Count" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {/* Achievements */}
            <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Award className="h-5 w-5 text-yellow-600" />
                        Your Achievements
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {metrics.accepted >= 10 && (
                            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-yellow-200">
                                <CheckCircle className="h-8 w-8 text-green-600" />
                                <div>
                                    <p className="font-medium text-gray-900">Action Taker</p>
                                    <p className="text-sm text-gray-600">Accepted 10+ suggestions</p>
                                </div>
                            </div>
                        )}

                        {parseFloat(metrics.totalImpact) >= 5000 && (
                            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-yellow-200">
                                <DollarSign className="h-8 w-8 text-green-600" />
                                <div>
                                    <p className="font-medium text-gray-900">Money Saver</p>
                                    <p className="text-sm text-gray-600">Saved ₹5,000+</p>
                                </div>
                            </div>
                        )}

                        {parseFloat(metrics.acceptanceRate) >= 70 && (
                            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-yellow-200">
                                <Target className="h-8 w-8 text-blue-600" />
                                <div>
                                    <p className="font-medium text-gray-900">AI Believer</p>
                                    <p className="text-sm text-gray-600">70%+ acceptance rate</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {metrics.total === 0 && (
                        <p className="text-gray-600 text-center py-8">
                            Start accepting AI suggestions to unlock achievements! 🏆
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
