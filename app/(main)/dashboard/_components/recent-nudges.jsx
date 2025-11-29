"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import WhyThisButton from "@/components/explainability/WhyThisButton";

const STATUS_CONFIG = {
  executed: { label: "Executed", color: "bg-emerald-500/10 text-emerald-400" },
  pending: { label: "Pending", color: "bg-amber-500/10 text-amber-400" },
  rejected: { label: "Rejected", color: "bg-slate-500/10 text-slate-400" },
  expired: { label: "Expired", color: "bg-rose-500/10 text-rose-400" },
};

const TYPE_ICONS = {
  "micro-save": CheckCircle,
  "guardian-alert": AlertTriangle,
  "auto-save": CheckCircle,
};

export default function RecentNudges({ nudges = [] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold">Recent Agent Actions</CardTitle>
        <Badge variant="outline" className="text-xs">
          {nudges.length > 0 ? `${nudges.length} tracked` : "No activity"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {nudges.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground">
            <Clock className="mx-auto mb-2 h-6 w-6 text-muted-foreground/70" />
            Automation will appear here once the agent acts.
          </div>
        ) : (
          nudges.map((nudge) => {
            const StatusBadge = STATUS_CONFIG[nudge.status] || STATUS_CONFIG.pending;
            const Icon = TYPE_ICONS[nudge.nudgeType] || Zap;
            return (
              <div key={nudge.id} className="flex items-start gap-3 rounded-lg border border-border/50 p-3">
                <div className="rounded-md bg-muted/50 p-2">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium leading-tight">{nudge.message}</p>
                      <Badge className={StatusBadge.color}>{StatusBadge.label}</Badge>
                    </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{nudge.reason}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground items-center">
                    <span>{new Date(nudge.createdAt).toLocaleString()}</span>
                    {nudge.amount && (
                      <span className="font-semibold text-foreground">₹{Number(nudge.amount).toFixed(0)}</span>
                    )}
                    {nudge.metadata?.automation?.mode === "auto" && (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <Clock className="h-3 w-3" /> Auto
                      </span>
                    )}
                    <WhyThisButton type="nudge" id={nudge.id} label="Why?" className="text-xs" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
