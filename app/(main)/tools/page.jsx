"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

const tools = [];

export default function ToolsPage() {
    return (
        <div className="container mx-auto px-4 py-8 max-w-5xl">
            <div className="text-center mb-12">
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-gray-800 to-gray-900 px-4 py-2 rounded-full mb-4 border border-gray-700">
                    <Sparkles className="h-4 w-4 text-yellow-400" />
                    <span className="text-sm font-medium text-gray-300">Wealth Labs</span>
                </div>
                <h1 className="text-4xl font-bold mb-4">Smart Tools Suite</h1>
                <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                    Experimental features coming soon. Check back later!
                </p>
            </div>

            <div className="text-center py-12">
                <p className="text-gray-500">No tools available at the moment.</p>
            </div>
        </div>
    );
}
