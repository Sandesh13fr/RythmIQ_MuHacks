"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Trophy, TrendingUp, Shield, Wallet, Target, Award } from "lucide-react";

export default function FitnessScoreCard({ scoreData }) {
    const { score, breakdown, level, nextLevel } = scoreData;

    return (
        <Card className="border-2 border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Trophy className="h-5 w-5 text-yellow-500" />
                        Financial Fitness Score
                    </CardTitle>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${level.bg} ${level.color}`}>
                        {level.name}
                    </span>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex items-end gap-4 mb-4">
                    <div className="relative">
                        <svg className="w-24 h-24 transform -rotate-90">
                            <circle
                                cx="48"
                                cy="48"
                                r="40"
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="transparent"
                                className="text-gray-100"
                            />
                            <circle
                                cx="48"
                                cy="48"
                                r="40"
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="transparent"
                                strokeDasharray={251.2}
                                strokeDashoffset={251.2 - (251.2 * score) / 100}
                                className={score >= 80 ? "text-emerald-500" : score >= 60 ? "text-blue-500" : "text-purple-500"}
                            />
                        </svg>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                            <span className="text-3xl font-bold text-gray-900">{score}</span>
                        </div>
                    </div>

                    <div className="flex-1 pb-2">
                        {nextLevel ? (
                            <div>
                                <p className="text-sm text-gray-600 mb-1">
                                    <span className="font-bold text-gray-900">{nextLevel.pointsNeeded} pts</span> to {nextLevel.name}
                                </p>
                                <Progress value={(score % 20) * 5} className="h-2" />
                            </div>
                        ) : (
                            <p className="text-sm font-medium text-emerald-600">Max Level Achieved! 🏆</p>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                        <Wallet className="h-4 w-4 text-blue-500" />
                        <div>
                            <p className="text-xs text-gray-500">Savings</p>
                            <p className="text-sm font-bold">{breakdown.savings}/30</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                        <Shield className="h-4 w-4 text-purple-500" />
                        <div>
                            <p className="text-xs text-gray-500">Emergency</p>
                            <p className="text-sm font-bold">{breakdown.emergency}/15</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                        <Target className="h-4 w-4 text-red-500" />
                        <div>
                            <p className="text-xs text-gray-500">Budget</p>
                            <p className="text-sm font-bold">{breakdown.budget}/20</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                        <Award className="h-4 w-4 text-yellow-500" />
                        <div>
                            <p className="text-xs text-gray-500">Actions</p>
                            <p className="text-sm font-bold">{breakdown.engagement}/15</p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
