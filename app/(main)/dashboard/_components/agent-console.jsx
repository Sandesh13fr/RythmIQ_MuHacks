"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Play } from "lucide-react";
import { AGENT_TRIGGERS } from "@/lib/agents/agent-trigger-registry";

export default function AgentConsole() {
  const [pendingSlug, setPendingSlug] = useState(null);
  const [statuses, setStatuses] = useState({});
  const [isPending, startTransition] = useTransition();

  const triggerAgent = (slug) => {
    startTransition(async () => {
      setPendingSlug(slug);
      setStatuses((prev) => ({
        ...prev,
        [slug]: { state: "running", message: "Executing…" },
      }));

      try {
        const response = await fetch("/api/agents/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug }),
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to trigger agent");
        }

        setStatuses((prev) => ({
          ...prev,
          [slug]: {
            state: "success",
            message: data.summary || "Triggered successfully",
            children: data.children,
          },
        }));
      } catch (error) {
        setStatuses((prev) => ({
          ...prev,
          [slug]: { state: "error", message: error.message },
        }));
      } finally {
        setPendingSlug(null);
      }
    });
  };

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-lg">Agent Console</CardTitle>
        <p className="text-sm text-muted-foreground">
          Fire any automation on-demand for demos. Requires the Inngest dev server
          (`npx inngest-cli dev`) running locally.
        </p>
      </CardHeader>
      <CardContent className="grid gap-3">
        {AGENT_TRIGGERS.map((agent) => {
          const status = statuses[agent.slug];
          const running = pendingSlug === agent.slug && (isPending || status?.state === "running");

          return (
            <div
              key={agent.slug}
              className="flex flex-col gap-2 rounded-lg border border-muted p-3 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="font-medium">{agent.label}</p>
                <p className="text-sm text-muted-foreground">{agent.description}</p>
                {status && (
                  <div className="mt-1 space-y-1">
                    <p
                      className={`text-sm ${
                        status.state === "success"
                          ? "text-emerald-600"
                          : status.state === "error"
                          ? "text-destructive"
                          : "text-primary"
                      }`}
                    >
                      {status.message}
                    </p>
                    {status.children?.length > 0 && (
                      <div className="rounded border border-muted bg-muted/20 p-2 text-xs font-mono text-muted-foreground">
                        {status.children.map((child) => (
                          <p
                            key={`${agent.slug}-${child.slug}`}
                            className={child.success ? "text-emerald-600" : "text-destructive"}
                          >
                            {child.label}: {child.success ? "ok" : "error"}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <Button
                onClick={() => triggerAgent(agent.slug)}
                disabled={running}
                variant="outline"
                className="mt-1 w-full md:mt-0 md:w-auto"
              >
                {running ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Trigger
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
