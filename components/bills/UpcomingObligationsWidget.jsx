"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Calendar, DollarSign, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function UpcomingObligationsWidget({ days = 7 }) {
    const [obligations, setObligations] = useState(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        fetchObligations();
    }, [days]);

    const fetchObligations = async () => {
        try {
            const response = await fetch(`/api/bills/upcoming?days=${days}`);
            const data = await response.json();
            if (data.success) {
                setObligations(data);
            }
        } catch (error) {
            console.error("Error fetching obligations:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="h-48 bg-gray-100 rounded-lg animate-pulse" />;
    }

    if (!obligations || obligations.bills.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Upcoming Bills
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">No bills due in the next {days} days</p>
                    <Button
                        variant="outline"
                        className="mt-4 w-full"
                        onClick={() => router.push("/bills")}
                    >
                        Manage Bills
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const daysUntilFirst = Math.ceil(
        (new Date(obligations.bills[0].nextDueDate) - new Date()) / (1000 * 60 * 60 * 24)
    );

    return (
        <Card className={obligations.hasRisk ? "border-red-500 border-2" : ""}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Upcoming Bills ({days} days)
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Total Amount */}
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                    <div className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-purple-600" />
                        <span className="text-sm font-medium">Total Due</span>
                    </div>
                    <span className="text-2xl font-bold text-purple-900">
                        ₹{obligations.totalAmount.toFixed(0)}
                    </span>
                </div>

                {/* Risk Warning */}
                {obligations.hasRisk && (
                    <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm font-medium text-red-900">Insufficient Balance</p>
                            <p className="text-xs text-red-700 mt-1">
                                You need ₹{(obligations.totalAmount - obligations.currentBalance).toFixed(0)} more to cover all bills
                            </p>
                        </div>
                    </div>
                )}

                {/* Bills List */}
                <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Bills Due</h4>
                    {obligations.bills.slice(0, 3).map((bill) => {
                        const daysUntil = Math.ceil(
                            (new Date(bill.nextDueDate) - new Date()) / (1000 * 60 * 60 * 24)
                        );

                        return (
                            <div key={bill.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex-1">
                                    <p className="font-medium text-sm">{bill.name}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Clock className="h-3 w-3 text-muted-foreground" />
                                        <span className="text-xs text-muted-foreground">
                                            {daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `In ${daysUntil} days`}
                                        </span>
                                    </div>
                                </div>
                                <span className="text-sm font-semibold">₹{Number(bill.amount).toFixed(0)}</span>
                            </div>
                        );
                    })}

                    {obligations.bills.length > 3 && (
                        <p className="text-xs text-center text-muted-foreground mt-2">
                            +{obligations.bills.length - 3} more bills
                        </p>
                    )}
                </div>

                {/* View All Button */}
                <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => router.push("/bills")}
                >
                    View All Bills
                </Button>
            </CardContent>
        </Card>
    );
}
