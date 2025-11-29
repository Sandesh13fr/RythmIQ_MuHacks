"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BillCard from "./BillCard";
import BillDetectionResults from "./BillDetectionResults";
import { Button } from "@/components/ui/button";
import { Plus, Receipt } from "lucide-react";
import AddBillDialog from "./AddBillDialog";

export default function BillsManagementDashboard() {
    const [bills, setBills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("all");

    useEffect(() => {
        fetchBills();
    }, []);

    const fetchBills = async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/bills");
            const data = await response.json();
            if (data.success) {
                setBills(data.bills);
            }
        } catch (error) {
            console.error("Error fetching bills:", error);
        } finally {
            setLoading(false);
        }
    };

    const activeBills = bills.filter(b => b.isActive && !b.isPaid);
    const paidBills = bills.filter(b => b.isPaid);

    if (loading) {
        return <div className="h-96 bg-gray-100 rounded-lg animate-pulse" />;
    }

    return (
        <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="flex items-center justify-between mb-4">
                    <TabsList>
                        <TabsTrigger value="all">
                            All Bills ({activeBills.length})
                        </TabsTrigger>
                        <TabsTrigger value="paid">
                            Paid ({paidBills.length})
                        </TabsTrigger>
                        <TabsTrigger value="detect">
                            Auto-Detect
                        </TabsTrigger>
                    </TabsList>

                    <AddBillDialog onBillCreated={fetchBills} />
                </div>

                <TabsContent value="all" className="space-y-4">
                    {activeBills.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-lg">
                            <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <h3 className="font-semibold text-gray-900 mb-2">No active bills</h3>
                            <p className="text-sm text-gray-600 mb-4">
                                Add bills manually or use auto-detection to get started
                            </p>
                            <Button variant="outline" onClick={() => setActiveTab("detect")}>
                                Try Auto-Detection
                            </Button>
                        </div>
                    ) : (
                        activeBills.map((bill) => (
                            <BillCard key={bill.id} bill={bill} onUpdate={fetchBills} />
                        ))
                    )}
                </TabsContent>

                <TabsContent value="paid" className="space-y-4">
                    {paidBills.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-600">No paid bills this month</p>
                        </div>
                    ) : (
                        paidBills.map((bill) => (
                            <BillCard key={bill.id} bill={bill} onUpdate={fetchBills} />
                        ))
                    )}
                </TabsContent>

                <TabsContent value="detect">
                    <BillDetectionResults onBillCreated={fetchBills} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
