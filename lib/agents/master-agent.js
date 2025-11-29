import { differenceInMinutes, formatDistanceToNow } from "date-fns";
import { db } from "@/lib/prisma";
import { NUDGE_TYPES } from "@/lib/nudge-engine";
import { agenticLog } from "@/lib/agents/agentic-log";

const MINUTE = 60 * 1000;

const AGENT_BLUEPRINTS = [
  {
    id: "predictive-cash-flow",
    name: "Predictive Cash Flow",
    role: "Forecasts 7-day balance and seeds guardian alerts",
    heartbeatMinutes: 240,
    fetcher: fetchPredictiveSnapshot,
  },
  {
    id: "guardian-overwatch",
    name: "Shortfall Guardian",
    role: "Creates emergency guardrails when danger is detected",
    heartbeatMinutes: 180,
    fetcher: (ctx) => fetchNudgeAgent(ctx, NUDGE_TYPES.GUARDIAN_ALERT, "No guardian alerts yet"),
  },
  {
    id: "micro-save-autopilot",
    name: "Micro-Save Autopilot",
    role: "Sweeps buffer cash when risk rises",
    heartbeatMinutes: 180,
    fetcher: (ctx) => fetchNudgeAgent(ctx, NUDGE_TYPES.MICRO_SAVE, "Haven't suggested buffer saves yet"),
  },
  {
    id: "emergency-buffer-builder",
    name: "Emergency Buffer Builder",
    role: "Allocates ₹200-₹500 into protected envelopes weekly",
    heartbeatMinutes: 1440,
    fetcher: (ctx) => fetchNudgeAgent(ctx, NUDGE_TYPES.EMERGENCY_BUFFER, "Buffer builder has not run this week"),
  },
  {
    id: "spending-guardrail",
    name: "Spending Guardrail",
    role: "Keeps discretionary categories in check",
    heartbeatMinutes: 360,
    fetcher: (ctx) => fetchNudgeAgent(ctx, NUDGE_TYPES.SPENDING_GUARDRAIL, "Guardrail agent idle"),
  },
  {
    id: "goal-backstop",
    name: "Goal Backstop",
    role: "Top-ups lagging savings goals",
    heartbeatMinutes: 720,
    fetcher: (ctx) => fetchNudgeAgent(ctx, NUDGE_TYPES.GOAL_BACKSTOP, "No lagging goals detected"),
  },
  {
    id: "nightly-digest",
    name: "Nightly Digest",
    role: "Emails daily automation summaries",
    heartbeatMinutes: 1440,
    fetcher: fetchDigestAgent,
  },
];

const STATUS_BADGE = {
  online: "online",
  idle: "idle",
  offline: "offline",
  locked: "locked",
  error: "error",
};

function computeStatus(lastRun, heartbeatMinutes) {
  if (!lastRun) return STATUS_BADGE.idle;
  const minutesSince = differenceInMinutes(new Date(), new Date(lastRun));
  if (minutesSince <= heartbeatMinutes) return STATUS_BADGE.online;
  return STATUS_BADGE.idle;
}

function formatRelative(date) {
  if (!date) return null;
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

function normalizeAgent(definition, result = {}) {
  const lastRun = result.lastRun ? new Date(result.lastRun) : null;
  const status = result.status || computeStatus(lastRun, definition.heartbeatMinutes);
  return {
    id: definition.id,
    name: definition.name,
    role: definition.role,
    status,
    detail: result.detail || definition.role,
    lastRun: lastRun ? lastRun.toISOString() : null,
    relativeLastRun: lastRun ? formatRelative(lastRun) : null,
    metrics: result.metrics || null,
    severity:
      result.severity ||
      (status === STATUS_BADGE.offline
        ? "error"
        : status === STATUS_BADGE.locked
        ? "warning"
        : status === STATUS_BADGE.idle
        ? "info"
        : "success"),
  };
}

async function fetchPredictiveSnapshot({ userId }) {
  const where = userId ? { userId } : undefined;
  const snapshot = await db.riskSnapshot.findFirst({
    where,
    orderBy: { createdAt: "desc" },
  });

  if (!snapshot) {
    return { detail: "No risk snapshots calculated yet" };
  }

  return {
    lastRun: snapshot.createdAt,
    detail: `Risk ${snapshot.riskLevel} (score ${snapshot.riskScore})`,
    metrics: {
      riskLevel: snapshot.riskLevel,
      riskScore: snapshot.riskScore,
      drivers: Array.isArray(snapshot.drivers) ? snapshot.drivers.slice(0, 3) : [],
    },
  };
}

async function fetchNudgeAgent({ userId }, nudgeType, emptyMessage) {
  const where = { nudgeType };
  if (userId) {
    where.userId = userId;
  }

  const nudge = await db.nudgeAction.findFirst({
    where,
    orderBy: { createdAt: "desc" },
  });

  if (!nudge) {
    return { detail: emptyMessage };
  }

  return {
    lastRun: nudge.createdAt,
    detail: nudge.message,
    metrics: {
      amount: nudge.amount ? Number(nudge.amount) : null,
      priority: nudge.priority,
      status: nudge.status,
    },
  };
}

async function fetchDigestAgent({ userId }) {
  const where = userId
    ? { action: "nightly_digest", userId }
    : { action: "nightly_digest" };

  const log = await db.securityAuditLog.findFirst({
    where,
    orderBy: { createdAt: "desc" },
  });

  if (!log) {
    return { detail: "Digest scheduled for 20:30 IST (no sends recorded yet)" };
  }

  return {
    lastRun: log.createdAt,
    detail: "Digest delivered",
    metrics: {
      recipients: log.context?.recipients || 1,
    },
  };
}

function buildSummary(agents, watchdog) {
  const summary = {
    totalAgents: agents.length + 1,
    online: 0,
    idle: 0,
    offline: 0,
    locked: 0,
    autopilotLocked: Boolean(watchdog?.autopilotLocked),
    autopilotReason: watchdog?.reason || null,
  };

  for (const agent of agents) {
    if (agent.status === STATUS_BADGE.online) summary.online += 1;
    else if (agent.status === STATUS_BADGE.offline) summary.offline += 1;
    else if (agent.status === STATUS_BADGE.locked) summary.locked += 1;
    else summary.idle += 1;
  }

  if (watchdog?.autopilotLocked) {
    summary.locked += 1;
  } else {
    summary.online += 1;
  }

  if (summary.offline > 0) {
    summary.health = "degraded";
  } else if (summary.locked > 0) {
    summary.health = "attention";
  } else {
    summary.health = "stable";
  }

  return summary;
}

function buildLogs(agents, summary, generatedAt, watchdogEntry) {
  const sorted = [...agents].sort((a, b) => {
    const aTime = a.lastRun ? new Date(a.lastRun).getTime() : 0;
    const bTime = b.lastRun ? new Date(b.lastRun).getTime() : 0;
    return bTime - aTime;
  });

  const base = sorted.slice(0, 5).map((agent) => ({
    time: agent.lastRun || generatedAt,
    message: `${agent.name}: ${agent.detail}`,
    type:
      agent.status === STATUS_BADGE.offline
        ? "error"
        : agent.status === STATUS_BADGE.locked
        ? "warning"
        : agent.status === STATUS_BADGE.online
        ? "success"
        : "info",
  }));

  if (watchdogEntry) {
    base.unshift(watchdogEntry);
  }

  return base.slice(0, 6);
}

async function buildWatchdogStatus({ userId }) {
  if (!userId) {
    return {
      status: STATUS_BADGE.idle,
      detail: "No user scope provided",
      lastRun: null,
    };
  }

  const state = await db.agentSafetyState.findUnique({ where: { userId } });
  if (!state) {
    return {
      status: STATUS_BADGE.online,
      detail: "Autopilot clear",
      lastRun: null,
    };
  }

  if (state.autopilotLocked) {
    return {
      status: STATUS_BADGE.locked,
      detail: state.reason || "Autopilot locked by watchdog",
      lastRun: state.lockedAt || state.updatedAt || state.createdAt,
      autopilotLocked: true,
      meta: state,
    };
  }

  return {
    status: STATUS_BADGE.online,
    detail: "No anomalies detected",
    lastRun: state.updatedAt || state.createdAt,
    meta: state,
  };
}

function sanitizeError(error) {
  if (!error) return "Unknown error";
  if (error.code === "P1001") {
    return "Database unreachable (P1001)";
  }
  return error.message || "Unexpected error";
}

export async function getAgentFleetSnapshot({ userId, clerkUserId } = {}) {
  const generatedAt = new Date();
  // AUTONOMOUS SUPERVISION: fan out to every child agent in parallel so the master can score the fleet in real time.
  const agents = await Promise.all(
    AGENT_BLUEPRINTS.map(async (blueprint) => {
      try {
        const result = await blueprint.fetcher({ userId, clerkUserId });
        if (userId && result?.detail) {
          agenticLog(userId, "proactive_intervention", {
            agentId: blueprint.id,
            summary: result.detail,
          });
        }
        return normalizeAgent(blueprint, result);
      } catch (error) {
        console.error(`[master-agent] ${blueprint.id} fetch failed`, error);
        return normalizeAgent(blueprint, {
          status: STATUS_BADGE.offline,
          detail: sanitizeError(error),
        });
      }
    })
  );

  let watchdog;
  try {
    watchdog = await buildWatchdogStatus({ userId });
  } catch (error) {
    console.error("[master-agent] watchdog fetch failed", error);
    watchdog = {
      status: STATUS_BADGE.offline,
      detail: sanitizeError(error),
      lastRun: null,
    };
  }

  const summary = buildSummary(agents, watchdog);

  const watchdogLog = {
    time: watchdog.lastRun || generatedAt.toISOString(),
    message: `Master Watchdog: ${watchdog.detail}`,
    type:
      watchdog.status === STATUS_BADGE.locked
        ? "warning"
        : watchdog.status === STATUS_BADGE.offline
        ? "error"
        : "info",
  };

  const logs = buildLogs(
    agents,
    summary,
    generatedAt.toISOString(),
    watchdog.detail ? watchdogLog : null
  );

  return {
    success: true,
    generatedAt: generatedAt.toISOString(),
    summary,
    agents,
    watchdog,
    logs,
  };
}
