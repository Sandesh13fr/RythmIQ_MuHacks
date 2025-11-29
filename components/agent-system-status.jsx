"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Terminal, Activity, ShieldCheck, Zap, AlertTriangle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const STATUS_COLOR = {
    success: "text-green-300",
    info: "text-green-400",
    warning: "text-amber-400",
    error: "text-red-400",
};

const AGENT_STATUS_CHIP = {
    online: "text-emerald-400",
    idle: "text-amber-300",
    offline: "text-rose-400",
    locked: "text-amber-400",
    error: "text-rose-400",
};

export default function AgentSystemStatus() {
    const [fleet, setFleet] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;

        const load = async () => {
            try {
                const res = await fetch("/api/agents/fleet", { cache: "no-store" });
                const payloadText = await res.text();
                let data = null;
                if (payloadText) {
                    try {
                        data = JSON.parse(payloadText);
                    } catch (parseError) {
                        throw new Error(
                            res.ok
                                ? "Received malformed data from fleet endpoint"
                                : payloadText.slice(0, 160) || "Upstream error"
                        );
                    }
                }

                if (!res.ok) {
                    throw new Error(data?.error || "Unable to load agent status");
                }

                if (active) {
                    setFleet(data);
                    setError(null);
                }
            } catch (err) {
                if (active) {
                    setError(err.message || "Unknown error loading agents");
                }
            } finally {
                if (active) setLoading(false);
            }
        };

        load();
        const interval = setInterval(load, 60_000);
        return () => {
            active = false;
            clearInterval(interval);
        };
    }, []);

    const logs = fleet?.logs || [];
    const agents = fleet?.agents || [];
    const summary = fleet?.summary;

    const headerStatus = summary?.health === "degraded"
        ? "DEGRADED"
        : summary?.health === "attention"
        ? "ATTENTION"
        : "ONLINE";

    return (
        <Card className="bg-black text-green-400 font-mono border-green-800 shadow-lg shadow-green-900/20">
            <CardHeader className="pb-2 border-b border-green-900/50">
                <CardTitle className="text-sm flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Terminal className="h-4 w-4" />
                        RythmIQ OS :: MASTER AGENT
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <span className="relative flex h-2 w-2">
                            <span className={cn(
                                "absolute inline-flex h-full w-full rounded-full opacity-75",
                                summary?.health === "degraded" ? "bg-rose-400 animate-ping" : "bg-green-400 animate-ping"
                            )}></span>
                            <span
                                className={cn(
                                    "relative inline-flex rounded-full h-2 w-2",
                                    summary?.health === "degraded" ? "bg-rose-500" : summary?.health === "attention" ? "bg-amber-400" : "bg-green-500"
                                )}
                            ></span>
                        </span>
                        {headerStatus}
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="p-4 space-y-4">
                    {error && (
                        <div className="text-xs text-red-300">⚠️ {error}</div>
                    )}
                    {loading && !fleet && (
                        <div className="text-xs text-green-500">Loading agent telemetry…</div>
                    )}

                    <div className="grid grid-cols-3 gap-2 text-[11px] uppercase">
                        <div className="border border-green-900/60 rounded p-2 text-center">
                            <p className="text-green-600 tracking-wider">ONLINE</p>
                            <p className="text-green-300 text-lg">{summary?.online ?? 0}</p>
                        </div>
                        <div className="border border-green-900/60 rounded p-2 text-center">
                            <p className="text-amber-500 tracking-wider">IDLE</p>
                            <p className="text-amber-300 text-lg">{summary?.idle ?? 0}</p>
                        </div>
                        <div className="border border-green-900/60 rounded p-2 text-center">
                            <p className="text-rose-500 tracking-wider">OFFLINE</p>
                            <p className="text-rose-300 text-lg">{summary?.offline ?? 0}</p>
                        </div>
                    </div>

                    {summary?.autopilotLocked && (
                        <div className="flex items-center gap-2 text-xs text-amber-300">
                            <AlertTriangle className="h-4 w-4" />
                            Autopilot locked: {summary.autopilotReason || "Manual review required"}
                        </div>
                    )}

                    <ScrollArea className="h-[150px] w-full border border-green-900/40 rounded bg-black/40">
                        <div className="p-3 space-y-2 text-xs">
                            {logs.length === 0 && (
                                <div className="text-green-500">No telemetry yet. Agents will appear once they run.</div>
                            )}
                            {logs.map((log, idx) => (
                                <div key={`${log.time}-${idx}`} className="flex gap-3">
                                    <span className="text-green-700 shrink-0">[
                                        {log.time
                                            ? new Date(log.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                            : "--:--"}
                                        ]
                                    </span>
                                    <span className={STATUS_COLOR[log.type] || STATUS_COLOR.info}>{log.message}</span>
                                </div>
                            ))}
                            <div className="flex gap-3 animate-pulse">
                                <span className="text-green-700 shrink-0">[
                                    {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    ]
                                </span>
                                <span className="text-green-400">_</span>
                            </div>
                        </div>
                    </ScrollArea>

                    <div className="space-y-2">
                        {agents.slice(0, 5).map((agent) => (
                            <div key={agent.id} className="border border-green-900/50 rounded p-2">
                                <div className="flex items-center justify-between text-[11px]">
                                    <span className="tracking-wide text-green-500">{agent.name}</span>
                                    <span className={cn("font-semibold", AGENT_STATUS_CHIP[agent.status] || "text-green-400")}>
                                        {agent.status.toUpperCase()}
                                    </span>
                                </div>
                                <p className="text-xs text-green-300 mt-1">{agent.detail}</p>
                                <p className="text-[10px] text-green-700 mt-1">
                                    {agent.relativeLastRun ? `Last run ${agent.relativeLastRun}` : "Awaiting first run"}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-3 border-t border-green-900/50 bg-green-950/20 p-2 text-xs text-center">
                    <div className="flex flex-col items-center gap-1">
                        <Activity className="h-3 w-3 text-green-600" />
                        <span className="text-green-700">TOTAL: {summary?.totalAgents ?? "-"}</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <ShieldCheck className="h-3 w-3 text-green-600" />
                        <span className="text-green-700">WATCHDOG: {summary?.autopilotLocked ? "LOCKED" : "CLEAR"}</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <Zap className="h-3 w-3 text-green-600" />
                        <span className="text-green-700">HEALTH: {summary?.health?.toUpperCase() || "--"}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
