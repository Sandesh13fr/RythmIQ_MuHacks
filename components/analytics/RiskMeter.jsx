"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import WhyThisButton from "@/components/explainability/WhyThisButton";

const LEVEL_COLORS = {
    Safe: "bg-emerald-500",
    Caution: "bg-amber-500",
    Danger: "bg-rose-600",
};

export default function RiskMeter() {
    const [snapshot, setSnapshot] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let active = true;
        async function load() {
            try {
                const res = await fetch("/api/analytics/risk");
                if (!res.ok) {
                    throw new Error("Failed to load risk");
                }
                const json = await res.json();
                if (active) {
                    setSnapshot(json.snapshot);
                }
            } catch (err) {
                if (active) setError(err.message);
            } finally {
                if (active) setLoading(false);
            }
        }
        load();
        return () => {
            active = false;
        };
    }, []);

    if (loading) {
        return <div className="rounded-xl border p-4">Loading risk…</div>;
    }

    if (error || !snapshot) {
        return <div className="rounded-xl border p-4 text-sm text-muted-foreground">Risk data unavailable</div>;
    }

    const level = snapshot.riskLevel;
    const color = LEVEL_COLORS[level] || "bg-slate-500";
    const drivers = Array.isArray(snapshot.drivers) ? snapshot.drivers : [];

    return (
        <div className="rounded-xl border p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">7-day risk</p>
                    <p className="text-2xl font-semibold">{level}</p>
                </div>
                <div className={cn("h-12 w-12 rounded-full flex items-center justify-center text-white font-bold", color)}>
                    {snapshot.riskScore}
                </div>
            </div>
            <div className="flex justify-end">
                <WhyThisButton type="risk" label="Why risk?" className="px-2 py-0 h-6" />
            </div>
            <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Drivers</p>
                <ul className="space-y-1 text-sm">
                    {drivers.slice(0, 4).map((driver, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                            <span>{driver.message || driver}</span>
                        </li>
                    ))}
                </ul>
            </div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Auto-refreshes every 3 hours</p>
        </div>
    );
}
