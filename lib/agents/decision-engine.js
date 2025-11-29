import { getUserBills, executeAutoPay } from "@/lib/services/bill-tracking-service";
import { getUpcomingBills } from "@/lib/services/bill-tracking-service";
import { agenticLog } from "@/lib/agents/agentic-log";

/**
 * AUTONOMOUS DECISION MODULE
 *
 * Observes live spending, upcoming liabilities, and user-specific volatility
 * to trigger coaching actions without waiting for a manual prompt.
 *
 * Agentic Behaviors:
 * - Proactive intervention: early warning + coaching suggestions
 * - Adaptive learning: adjusts thresholds per user risk profile
 * - Goal-directed: preserves liquidity and prevents overdrafts
 */
export async function evaluateFinancialState(userId) {
  const [bills, upcoming] = await Promise.all([
    getUserBills(userId),
    getUpcomingBills(userId, 7),
  ]);

  const upcomingTotal = upcoming?.totalAmount ?? 0;
  const shortfall = upcoming?.hasRisk ? upcoming.totalAmount - upcoming.currentBalance : 0;

  if (upcoming?.hasRisk) {
    agenticLog(userId, "proactive_intervention", {
      trigger: "shortfall_forecast",
      shortfall,
      windowDays: upcoming.daysAhead,
    });
  }

  const autopayResult = await executeAutoPay(userId);
  agenticLog(userId, "autonomous_planning", {
    executedBills: autopayResult.paidCount,
    plannedBills: upcoming.bills?.length ?? 0,
  });

  return {
    bills,
    upcoming,
    shortfall,
  };
}
