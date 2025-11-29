"use client";

import { useEffect, useState } from "react";
import { X, Lightbulb, TrendingUp, AlertCircle } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function ExplainabilityModal({ isOpen, onClose, type, id }) {
    const [explanation, setExplanation] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchExplanation();
        }
    }, [isOpen, type, id]);

    const fetchExplanation = async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/explainability/why", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type, id }),
            });

            const data = await response.json();
            if (data.success) {
                setExplanation(data);
            }
        } catch (error) {
            console.error("Error fetching explanation:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-yellow-500" />
                        Why This Decision?
                    </DialogTitle>
                    <DialogDescription>
                        Understanding the AI's reasoning
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="py-8 text-center">
                        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent"></div>
                        <p className="mt-4 text-sm text-muted-foreground">Generating explanation...</p>
                    </div>
                ) : explanation ? (
                    <div className="space-y-6">
                        {type === "nudge" && explanation.nudge?.metadata?.riskContext && (
                            <div className="rounded-lg border p-4">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Risk Context</p>
                                <div className="mt-2 flex flex-wrap gap-2 text-sm">
                                    <Badge variant="outline">Level: {explanation.nudge.metadata.riskContext.riskLevel}</Badge>
                                    {explanation.nudge.metadata.riskContext.trend && (
                                        <Badge variant="outline">Trend: {explanation.nudge.metadata.riskContext.trend}</Badge>
                                    )}
                                    {explanation.nudge.metadata.riskContext.incomeRhythm?.payday && (
                                        <Badge variant="outline">
                                            Payday: {explanation.nudge.metadata.riskContext.incomeRhythm.payday}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        )}
                        {/* Summary */}
                        {type === "nudge" && explanation.explanation && (
                            <div className="p-4 bg-purple-50 rounded-lg">
                                <h3 className="font-semibold text-purple-900 mb-2">Summary</h3>
                                <p className="text-sm text-purple-800">{explanation.explanation.summary}</p>
                            </div>
                        )}

                        {explanation.explanation?.counterfactual && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                                <h3 className="font-semibold text-amber-900 mb-1">If you ignore this…</h3>
                                <p className="text-sm text-amber-800">
                                    {explanation.explanation.counterfactual}
                                </p>
                            </div>
                        )}

                        {type === "allowance" && explanation.explanation && (
                            <div className="p-4 bg-blue-50 rounded-lg">
                                <h3 className="font-semibold text-blue-900 mb-2">
                                    {explanation.explanation.summary}
                                </h3>
                                <div className="mt-3 space-y-2">
                                    {explanation.explanation.reasoning.map((reason, idx) => (
                                        <div key={idx} className="flex items-start gap-2 text-sm text-blue-800">
                                            <TrendingUp className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                            <span>{reason}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {type === "risk" && explanation.explanation && (
                            <div className="space-y-4">
                                <div className="p-4 bg-orange-50 rounded-lg">
                                    <h3 className="font-semibold text-orange-900 mb-2">
                                        {explanation.explanation.summary}
                                    </h3>
                                </div>

                                {explanation.riskFactors && explanation.riskFactors.length > 0 && (
                                    <div>
                                        <h3 className="font-semibold mb-3">Risk Factors</h3>
                                        <div className="space-y-2">
                                            {explanation.riskFactors.map((factor, idx) => (
                                                <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                                    <AlertCircle className={`h-5 w-5 mt-0.5 ${factor.impact === "high" ? "text-red-500" : "text-yellow-500"
                                                        }`} />
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="font-medium">{factor.factor}</span>
                                                            <Badge variant={factor.impact === "high" ? "destructive" : "secondary"}>
                                                                {factor.impact}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground">{factor.description}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {explanation.explanation?.recommendations && (
                                    <div>
                                        <h3 className="font-semibold mb-3">Recommendations</h3>
                                        <ul className="space-y-2">
                                            {explanation.explanation.recommendations.map((rec, idx) => (
                                                <li key={idx} className="flex items-start gap-2 text-sm">
                                                    <span className="text-green-600 mt-1">✓</span>
                                                    <span>{rec}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Key Factors (for nudges) */}
                        {type === "nudge" && explanation.explanation?.keyFactors && (
                            <div>
                                <h3 className="font-semibold mb-3">Key Factors</h3>
                                <ul className="space-y-2">
                                    {explanation.explanation.keyFactors.map((factor, idx) => (
                                        <li key={idx} className="flex items-start gap-2 text-sm">
                                            <span className="text-purple-600 mt-1">•</span>
                                            <span>{factor}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Alternatives (for nudges) */}
                        {type === "nudge" && explanation.explanation?.alternatives && (
                            <div>
                                <h3 className="font-semibold mb-3">Alternative Actions</h3>
                                <div className="space-y-2">
                                    {explanation.explanation.alternatives.map((alt, idx) => (
                                        <div key={idx} className="p-3 bg-gray-50 rounded-lg text-sm">
                                            {alt}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Confidence */}
                        {explanation.explanation?.confidence && (
                            <div className="pt-4 border-t">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Confidence Level</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-purple-600 rounded-full"
                                                style={{ width: `${explanation.explanation.confidence}%` }}
                                            />
                                        </div>
                                        <span className="font-medium">{explanation.explanation.confidence}%</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="py-8 text-center text-muted-foreground">
                        No explanation available
                    </div>
                )}

                <div className="flex justify-end pt-4 border-t">
                    <Button onClick={onClose}>Close</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
