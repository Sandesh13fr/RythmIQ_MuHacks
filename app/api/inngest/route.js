import { inngest } from "@/lib/inngest/client";
import {
  checkBudgetAlert,
  generateMonthlyReports,
  microSaveAutopilot,
  emergencyBufferBuilder,
  processRecurringTransaction,
  predictiveCashFlowAgent,
  precomputeNudgeExplanations,
  spendingGuardrailAgent,
  goalBackstopAgent,
  nightlyAutomationDigest,
  shortfallGuardianOrchestrator,
  triggerRecurringTransactions,
} from "@/lib/inngest/functions";
import { runFinancialAgent } from "@/lib/inngest/Rhythmic-os";
import { serve } from "inngest/next";


// Create an API that serves zero functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [checkBudgetAlert,
    predictiveCashFlowAgent,
    shortfallGuardianOrchestrator,
    microSaveAutopilot,
    emergencyBufferBuilder,
    precomputeNudgeExplanations,
    spendingGuardrailAgent,
    goalBackstopAgent,
    nightlyAutomationDigest,
    triggerRecurringTransactions,
    processRecurringTransaction,
    generateMonthlyReports,
    runFinancialAgent,
  ],
});
