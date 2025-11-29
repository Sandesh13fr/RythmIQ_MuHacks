export const MASTER_AGENT_SLUG = "master-agent";

const CORE_AGENT_TRIGGERS = [
  {
    slug: "spending-guardrail-agent",
    label: "Spending Guardrail",
    description: "Clamp discretionary burn and lock budgets when weekly spend spikes.",
  },
  {
    slug: "goal-backstop-agent",
    label: "Goal Backstop",
    description: "Top up goals that fall behind schedule with catch-up plans.",
  },
  {
    slug: "nightly-automation-digest",
    label: "Nightly Digest",
    description: "Send the daily automation recap email to opted-in users.",
  },
  {
    slug: "predictive-cash-flow-agent",
    label: "Predictive Forecast",
    description: "Regenerate the 30-day cash-flow forecast for all users.",
  },
];

export const AGENT_TRIGGERS = [
  {
    slug: MASTER_AGENT_SLUG,
    label: "Master Agent",
    description: "Fan-out trigger that runs every major automation in one shot.",
    fanOut: true,
  },
  ...CORE_AGENT_TRIGGERS,
];

export const ALLOWED_AGENT_SLUGS = new Set(
  AGENT_TRIGGERS.map((agent) => agent.slug)
);

export const FAN_OUT_CHILDREN = CORE_AGENT_TRIGGERS.map((agent) => agent.slug);
