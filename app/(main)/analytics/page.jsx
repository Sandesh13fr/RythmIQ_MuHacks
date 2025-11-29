import { Suspense } from "react";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import BehavioralInsightsDashboard from "@/components/analytics/BehavioralInsightsDashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, TrendingUp } from "lucide-react";

export const metadata = {
    title: "Analytics | RythmIQ",
    description: "Behavioral insights and nudge effectiveness",
};

export default async function AnalyticsPage() {
    const user = await currentUser();
    if (!user) redirect("/sign-in");

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <Brain className="h-8 w-8 text-purple-600" />
                    <h1 className="text-3xl font-bold">Behavioral Analytics</h1>
                </div>
                <p className="text-muted-foreground">
                    See how RythmIQ is learning your preferences and adapting to serve you better
                </p>
            </div>

            {/* Info Card */}
            <Card className="mb-6 border-purple-200 bg-purple-50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-purple-900">
                        <TrendingUp className="h-5 w-5" />
                        How It Works
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-purple-800">
                    <p>
                        Every time you interact with a nudge, RythmIQ learns your preferences.
                        We track what types of nudges you find helpful, when you're most responsive,
                        and how to personalize your experience. The more feedback you provide,
                        the smarter RythmIQ becomes!
                    </p>
                </CardContent>
            </Card>

            {/* Dashboard */}
            <Suspense fallback={<div className="h-96 bg-gray-100 rounded-lg animate-pulse" />}>
                <BehavioralInsightsDashboard />
            </Suspense>
        </div>
    );
}
