"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, TrendingUp, AlertCircle, CheckCircle, X, Zap, DollarSign, Bell } from "lucide-react";
import AutoNudgeToggle from "@/components/AutoNudgeToggle";
import { toast } from "sonner";
import { acceptNudge, rejectNudge, generateAndCreateNudges } from "@/actions/nudge-actions";

const NUDGE_ICONS = {
    "auto-save": DollarSign,
    "bill-pay": Bell,
    "spending-alert": AlertCircle,
    "income-opportunity": TrendingUp,
    "emergency-buffer": Zap,
};

const NUDGE_COLORS = {
    "auto-save": "text-green-700 bg-green-50 border-green-200",
    "bill-pay": "text-blue-700 bg-blue-50 border-blue-200",
    "spending-alert": "text-yellow-700 bg-yellow-50 border-yellow-200",
    "income-opportunity": "text-indigo-700 bg-indigo-50 border-indigo-200",
    "emergency-buffer": "text-red-700 bg-red-50 border-red-200",
};

export default function DailyBriefing() {
    const [nudges, setNudges] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingNudge, setProcessingNudge] = useState(null);

    useEffect(() => {
        fetchNudges();
    }, []);

    const fetchNudges = async () => {
        try {
            setLoading(true);
            const result = await generateAndCreateNudges();

            if (!result) {
                console.log("Nudge generation not ready");
                setNudges([]);
                return;
            }

            if (result.success) {
                setNudges(result.nudges || []);
            } else {
                console.error("Failed to fetch nudges:", result.error);
                setNudges([]);
            }
        } catch (error) {
            console.error("Error fetching nudges:", error);
            setNudges([]);
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async (nudgeId) => {
        try {
            setProcessingNudge(nudgeId);
            const result = await acceptNudge(nudgeId);

            if (result && result.success) {
                toast.success(`Action completed! Impact: ₹${result.impact?.toFixed(0) || 0}`, {
                    icon: "✅",
                });
                setNudges(nudges.filter(n => n.id !== nudgeId));
            } else {
                toast.error(result?.error || "Failed to execute action");
            }
        } catch (error) {
            toast.error("Something went wrong");
        } finally {
            setProcessingNudge(null);
        }
    };

    const handleReject = async (nudgeId) => {
        try {
            setProcessingNudge(nudgeId);
            const result = await rejectNudge(nudgeId);

            if (result && result.success) {
                toast.info("Nudge dismissed");
                setNudges(nudges.filter(n => n.id !== nudgeId));
            } else {
                toast.error(result?.error || "Failed to dismiss");
            }
        } catch (error) {
            toast.error("Something went wrong");
        } finally {
            setProcessingNudge(null);
        }
    };

    if (loading) {
        return (
            <Card className="bg-white border-gray-200">
                <CardContent className="p-6">
                    <div className="animate-pulse space-y-3">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (nudges.length === 0) {
        return (
            <Card className="bg-white border-gray-200">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg text-gray-900">
                        <Sparkles className="h-5 w-5 text-gray-700" />
                        Your Daily Briefing
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-gray-700">
                        ✨ You're all set! No urgent actions needed right now.
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                        We'll notify you when there are opportunities to save or optimize your finances.
                    </p>

                    <div className="mt-4 pt-4 border-t border-gray-200">
                        <a href="/nudges">
                            <Button
                                variant="outline"
                                className="w-full border-gray-300 text-gray-700 hover:bg-gray-50"
                            >
                                <TrendingUp className="h-4 w-4 mr-2" />
                                View Previous Suggestions & Impact
                            </Button>
                        </a>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-white border-gray-200 overflow-hidden">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg text-gray-900">
                    <Sparkles className="h-5 w-5 text-gray-700" />
                    Your Daily Briefing
                    <span className="ml-auto text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full border border-gray-200">
                        {nudges.length} {nudges.length === 1 ? "suggestion" : "suggestions"}
                    </span>
                </CardTitle>
                <div className="ml-4">
                    <AutoNudgeToggle />
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {nudges.map((nudge) => {
                    const Icon = NUDGE_ICONS[nudge.nudgeType] || Sparkles;
                    const colorClass = NUDGE_COLORS[nudge.nudgeType] || "text-gray-700 bg-gray-50 border-gray-200";
                    const isProcessing = processingNudge === nudge.id;

                    return (
                        <div
                            key={nudge.id}
                            className={`border rounded-lg p-4 ${colorClass} transition-all hover:shadow-sm`}
                        >
                            <div className="flex items-start gap-3 mb-2">
                                <div className="mt-0.5">
                                    <Icon className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium">
                                        {nudge.message}
                                    </p>
                                    <p className="text-xs opacity-70 mt-1">
                                        💡 {nudge.reason}
                                    </p>
                                </div>
                            </div>

                            {nudge.amount && (
                                <div className="ml-8 mb-3">
                                    <span className="text-2xl font-bold">
                                        ₹{parseFloat(nudge.amount).toFixed(0)}
                                    </span>
                                </div>
                            )}

                            <div className="flex gap-2 ml-8">
                                <Button
                                    size="sm"
                                    onClick={() => handleAccept(nudge.id)}
                                    disabled={isProcessing}
                                    className="bg-black hover:bg-gray-800 text-white"
                                >
                                    {isProcessing ? (
                                        <>
                                            <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full mr-2" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle className="h-3 w-3 mr-1" />
                                            Accept
                                        </>
                                    )}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleReject(nudge.id)}
                                    disabled={isProcessing}
                                    className="border-gray-300 text-gray-700 hover:bg-gray-50"
                                >
                                    <X className="h-3 w-3 mr-1" />
                                    Dismiss
                                </Button>
                            </div>

                            {nudge.priority >= 8 && (
                                <div className="ml-8 mt-2 flex items-center gap-1 text-xs text-red-600">
                                    <Zap className="h-3 w-3" />
                                    <span>Urgent</span>
                                </div>
                            )}
                        </div>
                    );
                })}

                <div className="pt-4 border-t border-gray-200">
                    <a href="/nudges">
                        <Button
                            variant="outline"
                            className="w-full border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                            <TrendingUp className="h-4 w-4 mr-2" />
                            View Previous Suggestions & Impact
                        </Button>
                    </a>
                </div>
            </CardContent>
        </Card>
    );
}
