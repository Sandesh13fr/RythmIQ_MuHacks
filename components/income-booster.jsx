"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, MapPin, TrendingUp, Clock } from "lucide-react";
import { useState, useEffect } from "react";

export default function IncomeBooster() {
    const [isVisible, setIsVisible] = useState(true);

    // Simulate "Demand Surge" logic
    // In a real app, this would fetch from Uber/Swiggy APIs
    const surgeData = {
        location: "Indiranagar, Bangalore",
        multiplier: "2.1x",
        potential: "₹800 - ₹1200",
        duration: "Next 3 hours",
        platform: "Swiggy/Uber"
    };

    if (!isVisible) return null;

    return (
        <Card className="bg-gradient-to-r from-indigo-600 to-purple-600 border-none text-white shadow-lg mb-6 relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl"></div>
            <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-20 h-20 bg-white opacity-10 rounded-full blur-xl"></div>

            <CardContent className="p-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">

                    {/* Left: Signal */}
                    <div className="flex items-start gap-4">
                        <div className="bg-white/20 p-3 rounded-full animate-pulse">
                            <Zap className="h-8 w-8 text-yellow-300 fill-yellow-300" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-lg font-bold">High Demand Alert! ⚡</h3>
                                <span className="bg-yellow-400 text-black text-xs font-bold px-2 py-0.5 rounded-full">
                                    {surgeData.multiplier} Surge
                                </span>
                            </div>
                            <p className="text-indigo-100 text-sm mb-2">
                                High order volume detected in your area.
                            </p>
                            <div className="flex flex-wrap gap-3 text-sm">
                                <div className="flex items-center gap-1 bg-black/20 px-2 py-1 rounded">
                                    <MapPin className="h-3 w-3" /> {surgeData.location}
                                </div>
                                <div className="flex items-center gap-1 bg-black/20 px-2 py-1 rounded">
                                    <Clock className="h-3 w-3" /> {surgeData.duration}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Action */}
                    <div className="flex flex-col items-end gap-2 min-w-[140px]">
                        <div className="text-right">
                            <p className="text-xs text-indigo-200">Potential Earnings</p>
                            <p className="text-2xl font-bold text-white">{surgeData.potential}</p>
                        </div>
                        <Button
                            className="w-full bg-white text-indigo-600 hover:bg-indigo-50 font-bold"
                            onClick={() => window.open("https://driver.uber.com", "_blank")}
                        >
                            Go Online Now
                        </Button>
                    </div>

                </div>
            </CardContent>
        </Card>
    );
}
