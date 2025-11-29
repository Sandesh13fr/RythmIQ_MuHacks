"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, DollarSign, Zap, MoreVertical, CheckCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function BillCard({ bill, onUpdate }) {
    const [paying, setPaying] = useState(false);
    const [guarding, setGuarding] = useState(false);

    const handlePayBill = async () => {
        setPaying(true);
        try {
            const response = await fetch(`/api/bills/${bill.id}/pay`, {
                method: "POST",
            });

            const data = await response.json();
            if (data.success) {
                toast.success(`Paid ${bill.name}!`, {
                    description: `₹${Number(bill.amount).toFixed(0)} deducted from your account`,
                });
                onUpdate?.();
            } else {
                toast.error("Failed to pay bill");
            }
        } catch (error) {
            console.error("Error paying bill:", error);
            toast.error("Failed to pay bill");
        } finally {
            setPaying(false);
        }
    };

    const handleProtectBill = async (otpCode) => {
        setGuarding(true);
        try {
            const response = await fetch(`/api/bills/${bill.id}/protect`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount: bill.amount, otp: otpCode }),
            });

            const data = await response.json();

            if (response.status === 202 && data.requiresOtp) {
                if (data.devOtp) {
                    toast.message("Dev OTP", {
                        description: `Use ${data.devOtp} to verify this action (dev mode only).`,
                    });
                }
                const userOtp = window.prompt("Enter the one-time code sent to you to protect this bill");
                if (!userOtp) {
                    toast.info("Bill protection cancelled");
                    return;
                }
                return await handleProtectBill(userOtp);
            }

            if (data.success) {
                toast.success(`Protected ₹${Number(data.envelope.protectedAmount).toFixed(0)} for ${bill.name}`);
                onUpdate?.();
            } else {
                toast.error(data.error || "Failed to protect bill");
            }
        } catch (error) {
            console.error("Error protecting bill:", error);
            toast.error("Failed to protect bill");
        } finally {
            setGuarding(false);
        }
    };

    const activeEnvelope = bill.envelopes?.[0];

    const daysUntilDue = Math.ceil(
        (new Date(bill.nextDueDate) - new Date()) / (1000 * 60 * 60 * 24)
    );

    const isOverdue = daysUntilDue < 0;
    const isDueSoon = daysUntilDue <= 3 && daysUntilDue >= 0;

    return (
        <Card className={`${isOverdue ? "border-red-500" : isDueSoon ? "border-yellow-500" : ""
            } ${bill.isPaid ? "opacity-60" : ""}`}>
            <CardContent className="p-4">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{bill.name}</h3>
                            {bill.autoPayEnabled && (
                                <Badge variant="secondary" className="text-xs">
                                    <Zap className="h-3 w-3 mr-1" />
                                    Auto-pay
                                </Badge>
                            )}
                            {bill.isPaid && (
                                <Badge variant="outline" className="text-xs text-green-600">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Paid
                                </Badge>
                            )}
                        </div>

                        <div className="space-y-1 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4" />
                                <span className="font-medium text-foreground">₹{Number(bill.amount).toFixed(0)}</span>
                            </div>

                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                <span>
                                    {isOverdue ? (
                                        <span className="text-red-600 font-medium">Overdue by {Math.abs(daysUntilDue)} days</span>
                                    ) : daysUntilDue === 0 ? (
                                        <span className="text-orange-600 font-medium">Due today</span>
                                    ) : daysUntilDue === 1 ? (
                                        <span className="text-yellow-600 font-medium">Due tomorrow</span>
                                    ) : (
                                        `Due in ${daysUntilDue} days`
                                    )}
                                </span>
                            </div>

                            <div className="text-xs">
                                <span className="capitalize">{bill.category.replace(/-/g, " ")}</span>
                                {bill.detectedFrom && bill.detectedFrom !== "manual" && (
                                    <span className="ml-2 text-purple-600">• Auto-detected</span>
                                )}
                                {activeEnvelope?.lockedUntil && (
                                    <span className="ml-2 text-emerald-600">
                                        • Protected until {new Date(activeEnvelope.lockedUntil).toLocaleDateString("en-IN")}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {!bill.isPaid && (
                            <>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleProtectBill()}
                                    disabled={guarding || !!activeEnvelope}
                                >
                                    {activeEnvelope
                                        ? `Protected ₹${Number(activeEnvelope.protectedAmount).toFixed(0)}`
                                        : guarding
                                            ? "Protecting..."
                                            : "Protect"}
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handlePayBill}
                                    disabled={paying}
                                    className="bg-green-600 hover:bg-green-700"
                                >
                                    {paying ? "Paying..." : "Pay Now"}
                                </Button>
                            </>
                        )}

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem>Edit Bill</DropdownMenuItem>
                                <DropdownMenuItem>View History</DropdownMenuItem>
                                <DropdownMenuItem>
                                    {bill.autoPayEnabled ? "Disable" : "Enable"} Auto-pay
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600">Delete Bill</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
