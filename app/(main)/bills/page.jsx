import { Suspense } from "react";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import BillsManagementDashboard from "@/components/bills/BillsManagementDashboard";
import { Receipt, Sparkles } from "lucide-react";

export const metadata = {
    title: "Bills & EMI Guardian | RythmIQ",
    description: "Manage your recurring bills and EMIs",
};

export default async function BillsPage() {
    const user = await currentUser();
    if (!user) redirect("/sign-in");

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <Receipt className="h-8 w-8 text-blue-600" />
                    <h1 className="text-3xl font-bold">Bills & EMI Guardian</h1>
                </div>
                <p className="text-muted-foreground">
                    Never miss a payment again. Track, manage, and auto-pay your recurring bills.
                </p>
            </div>

            {/* Info Card */}
            <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-purple-600 mt-0.5" />
                    <div>
                        <h3 className="font-semibold text-purple-900 mb-1">Smart Bill Detection</h3>
                        <p className="text-sm text-purple-800">
                            We automatically detect recurring bills from your transaction history.
                            Review suggestions and add them with one click!
                        </p>
                    </div>
                </div>
            </div>

            {/* Dashboard */}
            <Suspense fallback={<div className="h-96 bg-gray-100 rounded-lg animate-pulse" />}>
                <BillsManagementDashboard />
            </Suspense>
        </div>
    );
}
