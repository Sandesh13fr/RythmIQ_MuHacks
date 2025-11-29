"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AddBillDialog({ onBillCreated }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        amount: "",
        dueDay: "",
        category: "Bills & Utilities",
        autoPayEnabled: false,
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await fetch("/api/bills", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (data.success) {
                toast.success("Bill added successfully");
                setOpen(false);
                setFormData({
                    name: "",
                    amount: "",
                    dueDay: "",
                    category: "Bills & Utilities",
                    autoPayEnabled: false,
                });
                if (onBillCreated) onBillCreated();
            } else {
                toast.error(data.error || "Failed to add bill");
            }
        } catch (error) {
            console.error("Error adding bill:", error);
            toast.error("An error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Bill Manually
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add New Bill</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Bill Name</Label>
                        <Input
                            id="name"
                            placeholder="e.g. Netflix, Rent, Electricity"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="amount">Amount (₹)</Label>
                            <Input
                                id="amount"
                                type="number"
                                placeholder="0.00"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                required
                                min="0"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="dueDay">Due Day (1-31)</Label>
                            <Input
                                id="dueDay"
                                type="number"
                                placeholder="DD"
                                value={formData.dueDay}
                                onChange={(e) => setFormData({ ...formData, dueDay: e.target.value })}
                                required
                                min="1"
                                max="31"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="category">Category</Label>
                        <Select
                            value={formData.category}
                            onValueChange={(value) => setFormData({ ...formData, category: value })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Bills & Utilities">Bills & Utilities</SelectItem>
                                <SelectItem value="Entertainment">Entertainment</SelectItem>
                                <SelectItem value="Housing">Housing</SelectItem>
                                <SelectItem value="Transportation">Transportation</SelectItem>
                                <SelectItem value="Insurance">Insurance</SelectItem>
                                <SelectItem value="Education">Education</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            id="autoPay"
                            className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                            checked={formData.autoPayEnabled}
                            onChange={(e) => setFormData({ ...formData, autoPayEnabled: e.target.checked })}
                        />
                        <Label htmlFor="autoPay" className="font-normal">
                            Enable Auto-Pay Simulation
                        </Label>
                    </div>

                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Adding...
                            </>
                        ) : (
                            "Add Bill"
                        )}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
