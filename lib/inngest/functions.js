import { sendEmail } from "@/actions/send-email";
import { db } from "../prisma";
import { inngest } from "./client";
import EmailTemplate from "@/emails/template";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { generateCashFlowForecast, isForecastCritical, clearForecastCache } from "@/lib/agents/predictive-agent";
import { sanitizeAIResponse } from "@/lib/security/sanitize-ai";
import { calculateNudgeImpact, NUDGE_TYPES } from "@/lib/nudge-engine";
import { calculateSafeToSave, checkEmiAtRisk } from "@/lib/predictions";
import { explainNudge } from "@/lib/services/explainability-service";
import { getPersonalizedNudgeSettings } from "@/lib/behavior-engine";

/**
 * Daily Predictive Financial Agent
 * Runs every day to forecast cash flow and alert users of upcoming crises
 */
export const predictiveCashFlowAgent = inngest.createFunction(
  { id: "predictive-cash-flow-agent" },
  { cron: "0 9 * * *" }, // Daily at 9 AM
  async ({ step }) => {
    const users = await step.run("fetch-users-with-transactions", async () => {
      return await db.user.findMany({
        include: {
          transactions: {
            orderBy: { date: "desc" },
            take: 100,
          },
          accounts: true,
          budgets: true,
        },
      });
    });

    for (const user of users) {
      if (!user.email || user.transactions.length === 0) continue;

      await step.run(`predict-for-user-${user.id}`, async () => {
        try {
          // Calculate financial metrics
          const totalBalance = user.accounts.reduce(
            (sum, acc) => sum + Number(acc.balance),
            0
          );

          const currentMonth = new Date();
          const daysIntoMonth = currentMonth.getDate();
          currentMonth.setDate(1);
          currentMonth.setHours(0, 0, 0, 0);

          const monthlyTransactions = user.transactions.filter(
            (tx) => new Date(tx.date) >= currentMonth
          );

          const monthlyIncome = monthlyTransactions
            .filter((tx) => tx.type === "INCOME")
            .reduce((sum, tx) => sum + Number(tx.amount), 0);

          const monthlyExpenses = monthlyTransactions
            .filter((tx) => tx.type === "EXPENSE")
            .reduce((sum, tx) => sum + Number(tx.amount), 0);

          const savingsRate =
            monthlyIncome > 0
              ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100
              : 0;

          const userFinancialData = {
            totalBalance,
            monthlyIncome,
            monthlyExpenses,
            savingsRate: savingsRate.toFixed(1),
            daysIntoMonth,
          };

          // Generate forecast
          const result = await generateCashFlowForecast(
            user.id,
            userFinancialData,
            user.transactions
          );

          if (!result.success) {
            console.warn(`Forecast failed for user ${user.id}:`, result.error);
            return;
          }

          const forecast = result.forecast;

          const shouldEmitShortfallEvent =
            forecast &&
            (forecast.risk_level && forecast.risk_level !== "low" || (forecast.critical_dates?.length ?? 0) > 0);

          if (shouldEmitShortfallEvent) {
            await inngest.send({
              name: "shortfall.forecasted",
              data: {
                userId: user.id,
                clerkUserId: user.clerkUserId,
                riskLevel: forecast.risk_level,
                predictedBalance: forecast.predicted_balance_day_30,
                criticalDates: forecast.critical_dates || [],
                recommendedActions: forecast.recommended_actions || [],
                summary: forecast.summary,
                confidence: forecast.confidence,
                generatedAt: new Date().toISOString(),
              },
            });
          }

          // If critical risk detected, create emergency nudge and send alert
          if (isForecastCritical(forecast)) {
            // Create emergency nudge
            await db.nudgeAction.create({
              data: {
                userId: user.id,
                type: "EMERGENCY",
                title: "⚠️ Financial Crisis Predicted",
                message: forecast.summary,
                detail: `${forecast.recommended_actions.join(" ")} Critical dates: ${forecast.critical_dates
                  .map((d) => `Day ${d.day}`)
                  .join(", ")}`,
                impact: "Will prevent unnecessary spending",
                status: "pending",
              },
            });

            // Send email alert
            const sanitizedSummary = sanitizeAIResponse(forecast.summary);
            const sanitizedActions = forecast.recommended_actions
              .slice(0, 3)
              .map(sanitizeAIResponse);

            await sendEmail({
              to: user.email,
              subject: "🚨 Financial Alert: Predicted Cash Flow Crisis",
              react: EmailTemplate({
                userName: user.name,
                type: "predictive-alert",
                data: {
                  riskLevel: forecast.risk_level,
                  summary: sanitizedSummary,
                  predictedBalance: forecast.predicted_balance_day_30,
                  criticalDates: forecast.critical_dates.slice(0, 3),
                  recommendedActions: sanitizedActions,
                  confidence: forecast.confidence,
                },
              }),
            });

            // Clear cache so next request gets fresh forecast
            clearForecastCache(user.id);
          }
        } catch (error) {
          console.error(`Error in predictive agent for user ${user.id}:`, error);
        }
      });
    }

    return { processedUsers: users.length };
  }
);

const BUFFER_MIN = 200;
const BUFFER_MAX = 500;

export const emergencyBufferBuilder = inngest.createFunction(
  { id: "emergency-buffer-builder", name: "Emergency Buffer Builder" },
  { cron: "0 8 * * MON" },
  async ({ step }) => {
    const users = await step.run("buffer-fetch-users", async () => {
      return db.user.findMany({
        include: {
          accounts: true,
          budgets: true,
          transactions: {
            orderBy: { date: "desc" },
            take: 90,
          },
          financialProfile: true,
        },
      });
    });

    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    let created = 0;

    for (const user of users) {
      if (!user.accounts.length) continue;

      const safeAmount = calculateSafeToSave(user.transactions, user.accounts, user.budgets[0]);
      if (!safeAmount || safeAmount < BUFFER_MIN) continue;

      const amount = Math.min(BUFFER_MAX, Math.max(BUFFER_MIN, safeAmount));

      const existing = await db.nudgeAction.findFirst({
        where: {
          userId: user.id,
          nudgeType: NUDGE_TYPES.EMERGENCY_BUFFER,
          createdAt: { gte: weekStart },
        },
      });

      if (existing) continue;

      await db.nudgeAction.create({
        data: {
          userId: user.id,
          nudgeType: NUDGE_TYPES.EMERGENCY_BUFFER,
          amount,
          message: `Build a ₹${amount} safety buffer this week?`,
          reason: "Keeping ₹200-₹500 aside weekly prevents future shortfalls.",
          priority: 7,
          expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          metadata: {
            automation: "emergency-buffer-builder",
            suggestedAmount: amount,
          },
        },
      });

      created += 1;
    }

    return { created };
  }
);

const RISK_SEVERITY = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export const shortfallGuardianOrchestrator = inngest.createFunction(
  { id: "shortfall-guardian-orchestrator", name: "Shortfall Guardian Orchestrator" },
  { event: "shortfall.forecasted" },
  async ({ event, step }) => {
    const payload = event.data || {};
    const {
      userId,
      riskLevel = "low",
      summary = "",
      criticalDates = [],
      recommendedActions = [],
      predictedBalance = 0,
      confidence = 0,
    } = payload;

    if (!userId) {
      return { skipped: "missing-user-id" };
    }

    const severity = RISK_SEVERITY[riskLevel] ?? 0;
    if (severity === 0 && criticalDates.length === 0) {
      return { skipped: "low-risk" };
    }

    const user = await step.run("guardian-fetch-user", async () => {
      return await db.user.findUnique({
        where: { id: userId },
        include: {
          transactions: {
            orderBy: { date: "desc" },
            take: 120,
          },
          accounts: true,
          bills: {
            where: {
              isActive: true,
              nextDueDate: {
                lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              },
            },
            orderBy: { nextDueDate: "asc" },
          },
        },
      });
    });

    if (!user) {
      return { skipped: "user-not-found" };
    }

    const emiRisk = checkEmiAtRisk(user.transactions, user.accounts, 7);
    const upcomingBills = user.bills || [];
    const nextBill = upcomingBills[0];
    const nextDueDate = nextBill?.nextDueDate ? new Date(nextBill.nextDueDate) : null;
    const expiresAt = nextDueDate || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    const emiShortfall = emiRisk.atRisk ? Math.max(0, Math.round(emiRisk.shortfall)) : 0;
    const projectedShortfall = Math.max(
      emiShortfall,
      nextBill ? Math.max(0, Math.round(Number(nextBill.amount) - (predictedBalance || 0))) : 0
    );
    const amountNeeded = projectedShortfall > 0 ? projectedShortfall : emiShortfall;

    const sanitizedSummary = sanitizeAIResponse(summary || "Balance trending down");
    const counterfactual = `Skip action and balance trends toward ₹${Math.round(predictedBalance || 0)} (${confidence || 0}% confidence).`;
    const earliestCritical = criticalDates[0];
    const criticalCopy = earliestCritical
      ? `First danger window: Day ${earliestCritical.day} (${earliestCritical.reason || "balance dip"}).`
      : "";

    const guardianMessage = emiRisk.atRisk
      ? `Rent/EMI at risk in < 7 days. Short by ₹${Math.max(emiShortfall, 100).toFixed(0)}.`
      : nextBill
      ? `${nextBill.name} of ₹${Number(nextBill.amount).toFixed(0)} is due soon. Buffer looks thin.`
      : `Cash buffer trending ${riskLevel}. Build protection today.`;

    const recommendationsPreview = recommendedActions.slice(0, 2).join(" · ");
    const reasonParts = [sanitizedSummary, counterfactual, criticalCopy, recommendationsPreview].filter(Boolean);
    if (emiRisk.atRisk) {
      reasonParts.push(
        `Forecast sees ${emiRisk.upcomingEmis} EMI(s) totaling ₹${emiRisk.totalEmi.toFixed(0)} but buffer covers only ₹${(emiRisk.totalEmi - emiRisk.shortfall).toFixed(0)}.`
      );
    } else if (nextBill) {
      reasonParts.push(
        `${nextBill.name} hits on ${nextDueDate?.toLocaleDateString("en-IN")}. Paying early avoids scramble.`
      );
    }

    const reason = reasonParts.join(" ");
    const severityPriority = { low: 4, medium: 6, high: 8, critical: 10 };
    const priority = severityPriority[riskLevel] ?? 5;

    const metadata = {
      forecast: payload,
      emiRisk,
      upcomingBills: upcomingBills.map((bill) => ({
        id: bill.id,
        name: bill.name,
        amount: Number(bill.amount),
        dueDate: bill.nextDueDate,
      })),
      automation: {
        trigger: "shortfall.forecasted",
        generatedAt: payload.generatedAt || new Date().toISOString(),
      },
    };

    const recentGuardian = await db.nudgeAction.findFirst({
      where: {
        userId,
        nudgeType: NUDGE_TYPES.GUARDIAN_ALERT,
        status: "pending",
        createdAt: {
          gte: new Date(Date.now() - 6 * 60 * 60 * 1000),
        },
      },
    });

    if (recentGuardian) {
      await db.nudgeAction.update({
        where: { id: recentGuardian.id },
        data: {
          amount: amountNeeded || recentGuardian.amount,
          message: guardianMessage,
          reason,
          priority,
          expiresAt,
          metadata,
        },
      });

      return { updated: recentGuardian.id, userId };
    }

    const guardianNudge = await db.nudgeAction.create({
      data: {
        userId,
        nudgeType: NUDGE_TYPES.GUARDIAN_ALERT,
        amount: amountNeeded || null,
        message: guardianMessage,
        reason,
        priority,
        expiresAt,
        metadata,
      },
    });

    return { created: guardianNudge.id, userId };
  }
);

const DAY_MS = 24 * 60 * 60 * 1000;
const DISCRETIONARY_CATEGORIES = [
  "Dining",
  "Food",
  "Food & Dining",
  "Restaurants",
  "Entertainment",
  "Shopping",
  "Travel",
  "Lifestyle",
];
const GUARDRAIL_MIN_WEEKLY = 1500;
const GUARDRAIL_THRESHOLD = 1.3;
const GOAL_LAG_TOLERANCE = 0.12;
const AUTO_MICRO_SAVE_CAPS = {
  LOW: { daily: 200, weekly: 800 },
  NORMAL: { daily: 400, weekly: 1500 },
  HIGH: { daily: 600, weekly: 2500 },
};

export const microSaveAutopilot = inngest.createFunction(
  { id: "micro-save-autopilot", name: "Micro-Save Autopilot" },
  { event: "shortfall.forecasted" },
  async ({ event, step }) => {
    const payload = event.data || {};
    const { userId, riskLevel = "low", predictedBalance = 0 } = payload;

    if (!userId || riskLevel === "low") {
      return { skipped: "low-risk-or-missing-user" };
    }

    const user = await step.run("microsave-fetch-user", async () => {
      return await db.user.findUnique({
        where: { id: userId },
        include: {
          accounts: true,
          budgets: true,
          transactions: {
            orderBy: { date: "desc" },
            take: 120,
          },
          financialProfile: true,
        },
      });
    });

    if (!user) {
      return { skipped: "user-not-found" };
    }

    const safetyState = await db.agentSafetyState.findUnique({ where: { userId } });
    if (safetyState?.autopilotLocked) {
      return { skipped: "autopilot-locked" };
    }

    const profile = user.financialProfile;
    if (!profile?.autoNudgeEnabled) {
      return { skipped: "auto-nudge-disabled" };
    }

    const defaultAccount = user.accounts.find((acc) => acc.isDefault) || user.accounts[0];
    if (!defaultAccount) {
      return { skipped: "no-account" };
    }

    const safeAmount = calculateSafeToSave(user.transactions, user.accounts, user.budgets[0]);
    if (!safeAmount || safeAmount < 50) {
      return { skipped: "no-safe-amount" };
    }

    const preference = profile.nudgeFrequencyPreference || "NORMAL";
    const caps = AUTO_MICRO_SAVE_CAPS[preference] || AUTO_MICRO_SAVE_CAPS.NORMAL;

    const weekWindowStart = new Date(Date.now() - 7 * DAY_MS);
    const dayWindowStart = new Date(Date.now() - DAY_MS);

    const executedSaves = await db.nudgeAction.findMany({
      where: {
        userId,
        nudgeType: NUDGE_TYPES.MICRO_SAVE,
        status: "executed",
        executedAt: { gte: weekWindowStart },
      },
      select: {
        amount: true,
        executedAt: true,
      },
    });

    const weeklyUsed = executedSaves.reduce((sum, n) => sum + Number(n.amount || 0), 0);
    const dailyUsed = executedSaves
      .filter((n) => n.executedAt && n.executedAt >= dayWindowStart)
      .reduce((sum, n) => sum + Number(n.amount || 0), 0);

    const remainingDaily = Math.max(0, caps.daily - dailyUsed);
    const remainingWeekly = Math.max(0, caps.weekly - weeklyUsed);
    const allocatable = Math.min(safeAmount, remainingDaily, remainingWeekly);

    if (!allocatable || allocatable < 50) {
      return { skipped: "guardrail-cap-hit" };
    }

    const amount = Math.round(allocatable);

    const metadata = {
      automation: {
        trigger: "shortfall.forecasted",
        mode: "auto",
      },
      guardrails: {
        dailyCap: caps.daily,
        weeklyCap: caps.weekly,
        usedToday: dailyUsed,
        usedWeek: weeklyUsed,
      },
      forecast: {
        riskLevel,
        predictedBalance,
      },
    };

    const microNudge = await db.nudgeAction.create({
      data: {
        userId,
        nudgeType: NUDGE_TYPES.MICRO_SAVE,
        amount,
        message: `Auto-saved ₹${amount} to your safety buffer`,
        reason: `Risk ${riskLevel} triggered an automatic micro-save to keep essentials safe.`,
        priority: 7,
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
        metadata,
      },
    });

    const transaction = await db.transaction.create({
      data: {
        userId,
        accountId: defaultAccount.id,
        type: "EXPENSE",
        amount,
        description: "Micro-Save (Auto Buffer)",
        category: "Savings",
        date: new Date(),
        status: "COMPLETED",
      },
    });

    const impact = calculateNudgeImpact(NUDGE_TYPES.MICRO_SAVE, amount);
    await db.nudgeAction.update({
      where: { id: microNudge.id },
      data: {
        status: "executed",
        executedAt: new Date(),
        respondedAt: new Date(),
        impact,
        metadata: {
          ...metadata,
          transactionId: transaction.id,
        },
      },
    });

    return { executed: microNudge.id, amount };
  }
);

export const spendingGuardrailAgent = inngest.createFunction(
  { id: "spending-guardrail-agent", name: "Spending Guardrail Agent" },
  { cron: "5 */4 * * *" },
  async ({ step }) => {
    const lookbackStart = new Date(Date.now() - 35 * DAY_MS);
    const guardrailUsers = await step.run("guardrail-fetch-users", async () => {
      return await db.user.findMany({
        where: {
          transactions: {
            some: {
              type: "EXPENSE",
              date: { gte: lookbackStart },
            },
          },
        },
        include: {
          transactions: {
            where: { type: "EXPENSE", date: { gte: lookbackStart } },
            orderBy: { date: "desc" },
            take: 200,
          },
          financialProfile: true,
          budgets: true,
        },
      });
    });

    let nudgesCreated = 0;
    const suppressionWindow = new Date(Date.now() - 2 * DAY_MS);

    for (const user of guardrailUsers) {
      if (!user.transactions?.length) continue;

      const weeklyWindow = new Date(Date.now() - 7 * DAY_MS);
      const categoryStats = new Map();

      for (const tx of user.transactions) {
        const amount = Number(tx.amount || 0);
        if (!amount || amount <= 0) continue;
        const bucketDate = new Date(tx.date);
        const category = tx.category || "Other";
        if (!categoryStats.has(category)) {
          categoryStats.set(category, { week: 0, trailing: 0 });
        }
        const bucket = categoryStats.get(category);
        if (bucketDate >= weeklyWindow) {
          bucket.week += amount;
        } else {
          bucket.trailing += amount;
        }
      }

      if (categoryStats.size === 0) continue;

      const recentGuardrails = await db.nudgeAction.findMany({
        where: {
          userId: user.id,
          nudgeType: NUDGE_TYPES.SPENDING_GUARDRAIL,
          createdAt: { gte: suppressionWindow },
        },
        select: { metadata: true },
      });

      const suppressedCategories = new Set(
        recentGuardrails
          .map((n) => (n.metadata?.category ? n.metadata.category : null))
          .filter(Boolean)
      );

      let perUser = 0;
      for (const [category, stats] of categoryStats.entries()) {
        if (perUser >= 2) break;
        if (suppressedCategories.has(category)) continue;

        const baselineWeekly = stats.trailing > 0 ? stats.trailing / 4 : 0;
        const weeklySpend = stats.week;
        if (!baselineWeekly || weeklySpend < GUARDRAIL_MIN_WEEKLY) continue;

        const acceleration = weeklySpend / baselineWeekly;
        if (acceleration < GUARDRAIL_THRESHOLD) continue;

        const overshoot = weeklySpend - baselineWeekly;
        const clampPlan = Math.max(500, Math.round(overshoot * 0.6));
        const variancePct = Math.round((acceleration - 1) * 100);

        const profile = user.financialProfile;
        const autoMode = profile?.autoNudgeEnabled ? "auto" : "manual";
        const primaryBudget = user.budgets?.[0];
        let lockApplied = false;

        if (
          autoMode === "auto" &&
          primaryBudget &&
          !primaryBudget.isLocked &&
          DISCRETIONARY_CATEGORIES.includes(category)
        ) {
          await db.budget.update({
            where: { id: primaryBudget.id },
            data: { isLocked: true },
          });
          lockApplied = true;
        }

        await db.nudgeAction.create({
          data: {
            userId: user.id,
            nudgeType: NUDGE_TYPES.SPENDING_GUARDRAIL,
            amount: weeklySpend,
            message: `Guardrail: ${category} spend up ${variancePct}% this week`,
            reason: `₹${weeklySpend.toFixed(0)} spent in 7 days vs ₹${baselineWeekly.toFixed(
              0
            )} baseline. Dial back ₹${clampPlan.toFixed(0)} over the next 72h to stay on plan.`,
            priority: 6,
            expiresAt: new Date(Date.now() + 3 * DAY_MS),
            metadata: {
              category,
              weeklySpend,
              baselineWeekly,
              overshoot,
              guardrail: {
                clampPlan,
                recommendedCap: Math.round(baselineWeekly * 1.1),
              },
              automation: {
                trigger: "spending-guardrail-agent",
                mode: autoMode,
                lockApplied,
              },
            },
          },
        });

        perUser += 1;
        nudgesCreated += 1;
      }
    }

    return { nudgesCreated };
  }
);

export const goalBackstopAgent = inngest.createFunction(
  { id: "goal-backstop-agent", name: "Goal Backstop Agent" },
  { cron: "45 7 * * *" },
  async ({ step }) => {
    const users = await step.run("goal-backstop-users", async () => {
      return await db.user.findMany({
        where: {
          goals: {
            some: { status: "active" },
          },
        },
        include: {
          goals: { where: { status: "active" } },
          financialProfile: true,
        },
      });
    });

    let nudgesCreated = 0;
    const suppressionWindow = new Date(Date.now() - DAY_MS);

    for (const user of users) {
      if (!user.goals?.length) continue;

      const recentBackstops = await db.nudgeAction.findMany({
        where: {
          userId: user.id,
          nudgeType: NUDGE_TYPES.GOAL_BACKSTOP,
          createdAt: { gte: suppressionWindow },
        },
        select: { metadata: true },
      });

      const coveredGoals = new Set(
        recentBackstops
          .map((n) => (n.metadata?.goalId ? n.metadata.goalId : null))
          .filter(Boolean)
      );

      const profile = user.financialProfile;
      const autoMode = profile?.autoNudgeEnabled ? "auto" : "manual";
      const now = new Date();

      for (const goal of user.goals) {
        if (coveredGoals.has(goal.id)) continue;

        const targetAmount = Number(goal.targetAmount || 0);
        const savedAmount = Number(goal.savedAmount || 0);
        if (!targetAmount || targetAmount <= 0 || savedAmount >= targetAmount) continue;

        if (!goal.targetDate) continue;
        const targetDate = new Date(goal.targetDate);
        if (targetDate <= now) continue;

        const createdAt = goal.createdAt ? new Date(goal.createdAt) : new Date(now.getTime() - 30 * DAY_MS);
        const totalDuration = targetDate.getTime() - createdAt.getTime();
        if (totalDuration <= 0) continue;

        const elapsed = now.getTime() - createdAt.getTime();
        const scheduleProgress = Math.min(1, elapsed / totalDuration);
        const goalProgress = savedAmount / targetAmount;
        const lag = scheduleProgress - goalProgress;

        if (lag <= GOAL_LAG_TOLERANCE) continue;

        const remaining = targetAmount - savedAmount;
        const daysLeft = Math.max(7, Math.ceil((targetDate.getTime() - now.getTime()) / DAY_MS));
        const weeksLeft = Math.max(1, Math.round(daysLeft / 7));
        const neededWeekly = Math.round(remaining / weeksLeft);
        const deficit = Math.min(20000, Math.round(Math.max(500, lag * targetAmount)));
        const suggestedTopUp = Math.min(remaining, deficit);

        await db.nudgeAction.create({
          data: {
            userId: user.id,
            nudgeType: NUDGE_TYPES.GOAL_BACKSTOP,
            amount: suggestedTopUp,
            message: `${goal.name} is ${Math.round(lag * 100)}% behind pace. Top up ₹${suggestedTopUp} this week?`,
            reason: `Saved ₹${savedAmount.toFixed(0)} of ₹${targetAmount.toFixed(0)} with ${daysLeft} days left. Need about ₹${neededWeekly.toFixed(
              0
            )}/week to finish on time.`,
            priority: 7,
            expiresAt: new Date(Date.now() + 2 * DAY_MS),
            metadata: {
              goalId: goal.id,
              goalName: goal.name,
              targetAmount,
              savedAmount,
              remaining,
              lagPercent: Math.round(lag * 100),
              weeksLeft,
              neededWeekly,
              suggestedTopUp,
              automation: {
                trigger: "goal-backstop-agent",
                mode: autoMode,
                plan: "schedule-sweep",
              },
            },
          },
        });

        coveredGoals.add(goal.id);
        nudgesCreated += 1;
      }
    }

    return { nudgesCreated };
  }
);

export const precomputeNudgeExplanations = inngest.createFunction(
  { id: "precompute-nudge-explanations" },
  { cron: "*/10 * * * *" },
  async ({ step }) => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const nudges = await step.run("fetch-unexplained-nudges", async () => {
      return await db.nudgeAction.findMany({
        where: {
          createdAt: { gte: since },
          status: "pending",
        },
        orderBy: { createdAt: "desc" },
        take: 25,
      });
    });

    let processed = 0;
    for (const nudge of nudges) {
      await step.run(`explain-${nudge.id}`, async () => {
        const currentMetadata = nudge.metadata
          ? JSON.parse(JSON.stringify(nudge.metadata))
          : {};

        if (currentMetadata.explanation?.ready) {
          return;
        }

        const explanationResult = await explainNudge(nudge.id, nudge.userId);
        if (!explanationResult?.success || !explanationResult.explanation) {
          return;
        }

        const explanation = explanationResult.explanation;
        const counterfactual = explanation.counterfactual
          ? explanation.counterfactual
          : `If you skip this ${nudge.nudgeType} action, your risk may stay ${explanation.summary?.includes("risk") ? "high" : "elevated"}.`;

        await db.nudgeAction.update({
          where: { id: nudge.id },
          data: {
            metadata: {
              ...currentMetadata,
              explanation: {
                ...explanation,
                ready: true,
                cachedAt: new Date().toISOString(),
              },
              counterfactual,
            },
          },
        });
        processed += 1;
      });
    }

    return { processed };
  }
);

export const nightlyAutomationDigest = inngest.createFunction(
  { id: "nightly-automation-digest" },
  { cron: "30 20 * * *" }, // 8:30 PM daily
  async ({ step }) => {
    const users = await step.run("fetch-digest-users", async () => {
      return await db.user.findMany({
        where: { email: { not: "" } },
        select: {
          id: true,
          email: true,
          name: true,
          clerkUserId: true,
          financialProfile: true,
        },
      });
    });

    let sent = 0;
    for (const user of users) {
      await step.run(`digest-${user.id}`, async () => {
        const settings = await getPersonalizedNudgeSettings(user.clerkUserId);
        const since = new Date(Date.now() - DAY_MS);
        const recentActions = await db.nudgeAction.findMany({
          where: {
            userId: user.id,
            createdAt: { gte: since },
            nudgeType: {
              in: [NUDGE_TYPES.MICRO_SAVE, NUDGE_TYPES.GUARDIAN_ALERT],
            },
          },
          orderBy: { createdAt: "asc" },
        });

        const autoActions = recentActions.filter(
          (action) => action.metadata?.automation?.mode === "auto"
        );

        const shouldSend =
          user.financialProfile?.autoNudgeEnabled ||
          settings.preferSummaries ||
          autoActions.length > 0;

        if (!shouldSend || recentActions.length === 0 || !user.email) {
          return;
        }

        const lines = recentActions.map((action) => {
          const amount = action.amount ? `₹${Number(action.amount).toFixed(0)}` : "";
          const timestamp = action.createdAt.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          });
          const status = action.status === "executed" ? "done" : action.status;
          const counterfactual = action.metadata?.counterfactual
            ? ` | ${action.metadata.counterfactual}`
            : "";
          const label =
            action.nudgeType === NUDGE_TYPES.MICRO_SAVE
              ? "Micro-save"
              : "Guardian";
          const mode = action.metadata?.automation?.mode === "auto" ? "auto" : "manual";
          return `${timestamp} · ${label} ${amount} (${mode}, ${status})${counterfactual}`;
        });

        const message = lines.map((line) => `• ${line}`).join("\n");

        await sendEmail({
          to: user.email,
          subject: "🌙 RythmIQ nightly digest",
          react: EmailTemplate({
            userName: user.name,
            type: "guardian-alert",
            data: {
              action: "Daily Automation Summary",
              reason: `${lines.length} proactive moves in the last 24h`,
              message,
            },
          }),
        });

        sent += 1;
      });
    }

    return { sent };
  }
);

export const checkBudgetAlert = inngest.createFunction(
  { id: "check Budget Alerts" },
  { cron: "0 */6 * * *" },
  async ({ step }) => {
    const budgets = await step.run("fetch-budget", async () => {
      return await db.budget.findMany({
        include: {
          user: {
            include: {
              accounts: {
                where: {
                  isDefault: true,
                },
              },
            },
          },
        },
      });
    });
    for (const budget of budgets) {
      const defaultAccount = budget.user.accounts[0];
      if (!defaultAccount) continue; // Skip if no default account

      await step.run(`check-budget-${budget.id}`, async () => {
        const currentDate = new Date();
        const startOfMonth = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          1
        );

        const endOfMonth = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() + 1,
          0
        );

        // Calculate total expenses for the default account only
        const expenses = await db.transaction.aggregate({
          where: {
            userId: budget.userId,
            accountId: defaultAccount.id, // Only consider default account
            type: "EXPENSE",
            date: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
          },
          _sum: {
            amount: true,
          },
        });

        const totalExpenses = expenses._sum.amount?.toNumber() || 0;
        const budgetAmount = budget.amount;
        const percentageUsed = (totalExpenses / budgetAmount) * 100;

        if (
          percentageUsed >= 80 && // Default threshold of 80%
          (!budget.lastAlertSent ||
            isNewMonth(new Date(budget.lastAlertSent), new Date()))
        ) {
          //send email
          await sendEmail({
            to: budget.user.email,
            subject: `Budget Alert for - ${defaultAccount.name}`,
            react: EmailTemplate({
              userName: budget.user.name,
              type: "budget-alert",
              data: {
                percentageUsed,
                budgetAmount: parseInt(budgetAmount).toFixed(1),
                totalExpenses: parseInt(totalExpenses).toFixed(1),
                accountName: defaultAccount.name,
              },
            }),
          });

          // update lastAlertSent
          await db.budget.update({
            where: { id: budget.id },
            data: { lastAlertSent: new Date() },
          });
        }
      });
    }
  }
);

function isNewMonth(lastAlertDate, currentDate) {
  return (
    lastAlertDate.getMonth() !== currentDate.getMonth() ||
    lastAlertDate.getFullYear() !== currentDate.getFullYear()
  );
}

// Trigger recurring transactions with batching
export const triggerRecurringTransactions = inngest.createFunction(
  {
    id: "trigger-recurring-transactions", // Unique ID,
    name: "Trigger Recurring Transactions",
  },
  { cron: "0 0 * * *" }, // Daily at midnight
  async ({ step }) => {
    const recurringTransactions = await step.run(
      "fetch-recurring-transactions",
      async () => {
        return await db.transaction.findMany({
          where: {
            isRecurring: true,
            status: "COMPLETED",
            OR: [
              { lastProcessed: null },
              {
                nextRecurringDate: {
                  lte: new Date(),
                },
              },
            ],
          },
        });
      }
    );

    // Send event for each recurring transaction in batches
    if (recurringTransactions.length > 0) {
      const events = recurringTransactions.map((transaction) => ({
        name: "transaction.recurring.process",
        data: {
          transactionId: transaction.id,
          userId: transaction.userId,
        },
      }));

      // Send events directly using inngest.send()
      await inngest.send(events);
    }

    return { triggered: recurringTransactions.length };
  }
);

export const processRecurringTransaction = inngest.createFunction(
  {
    id: "process-recurring-transaction",
    name: "Process Recurring Transaction",
    throttle: {
      limit: 10, // Process 10 transactions
      period: "1m", // per minute
      key: "event.data.userId", // Throttle per user
    },
  },
  { event: "transaction.recurring.process" },
  async ({ event, step }) => {
    // Validate event data
    if (!event?.data?.transactionId || !event?.data?.userId) {
      console.error("Invalid event data:", event);
      return { error: "Missing required event data" };
    }
    await step.run("process-transaction", async () => {
      const transaction = await db.transaction.findUnique({
        where: {
          id: event.data.transactionId,
          userId: event.data.userId,
        },
        include: {
          account: true,
        },
      });
      if (!transaction || !isTransactionDue(transaction)) return;

      await db.$transaction(async (tx) => {
        // Create new transaction
        await tx.transaction.create({
          data: {
            type: transaction.type,
            amount: transaction.amount,
            description: `${transaction.description} (Recurring)`,
            date: new Date(),
            category: transaction.category,
            userId: transaction.userId,
            accountId: transaction.accountId,
            isRecurring: false,
          },
        });

        // Update account balance
        const balanceChange =
          transaction.type === "EXPENSE"
            ? -transaction.amount.toNumber()
            : transaction.amount.toNumber();

        await tx.account.update({
          where: { id: transaction.accountId },
          data: { balance: { increment: balanceChange } },
        });

        // Update last processed date and next recurring date
        await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            lastProcessed: new Date(),
            nextRecurringDate: calculateNextRecurringDate(
              new Date(),
              transaction.recurringInterval
            ),
          },
        });
      });
    });
  }
);

function isTransactionDue(transaction) {
  // If no lastProcessed date, transaction is due
  if (!transaction.lastProcessed) return true;

  const today = new Date();
  const nextDue = new Date(transaction.nextRecurringDate);

  // Compare with nextDue date
  return nextDue <= today;
}

function calculateNextRecurringDate(date, interval) {
  const next = new Date(date);
  switch (interval) {
    case "DAILY":
      next.setDate(next.getDate() + 1);
      break;
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      break;
    case "YEARLY":
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}

export const generateMonthlyReports = inngest.createFunction({
  id: "generate-monthly-reports",
  name: "Generate Monthly Reports",
},
{ cron: "0 0 1 * *" }, // First day of each month
async ({ step }) => {
  const users = await step.run("fetch-users", async () => {
    return await db.user.findMany({
      include: { accounts: true },
    });
  });

  for (const user of users) {
    await step.run(`generate-report-${user.id}`, async () => {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      const stats = await getMonthlyStats(user.id, lastMonth);
      const monthName = lastMonth.toLocaleString("default", {
        month: "long",
      });

      const insights = await generateFinancialInsights(stats, monthName); 

      await sendEmail({
        to: user.email,
        subject: `Your Monthly Financial Report - ${monthName}`,
        react: EmailTemplate({
          userName: user.name,
          type: "monthly-report",
          data: {
            stats,
            month: monthName,
            insights,
          },
        }),
      });
    });
  }

  return { processed: users.length };
}
);

async function generateFinancialInsights(stats, month) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
  Analyze this financial data and provide 3 concise, actionable insights.
  Focus on spending patterns and practical advice.
  Keep it friendly and conversational.

  Financial Data for ${month}:
  - Total Income: $${stats.totalIncome}
  - Total Expenses: $${stats.totalExpenses}
  - Net Income: $${stats.totalIncome - stats.totalExpenses}
  - Expense Categories: ${Object.entries(stats.byCategory)
    .map(([category, amount]) => `${category}: $${amount}`)
    .join(", ")}

  Format the response as a JSON array of strings, like this:
  ["insight 1", "insight 2", "insight 3"]
`;
try {
  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();
  const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

  return JSON.parse(cleanedText);
} catch (error) {
  console.error("Error generating insights:", error);
  return [
    "Your highest expense category this month might need attention.",
    "Consider setting up a budget for better financial management.",
    "Track your recurring expenses to identify potential savings.",
  ];
}
}



const getMonthlyStats = async (userId, month)=>{
  const startDate = new Date(month.getFullYear(), month.getMonth(), 1);
  const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0);

  const transactions = await db.transaction.findMany({
    where: {
      userId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
  });


return transactions.reduce(
  (stats, t) => {
    const amount = t.amount.toNumber();
    if (t.type === "EXPENSE") {
      stats.totalExpenses += amount;
      stats.byCategory[t.category] =
        (stats.byCategory[t.category] || 0) + amount;
    } else {
      stats.totalIncome += amount;
    }
    return stats;
  },
  {
    totalExpenses: 0,
    totalIncome: 0,
    byCategory: {},
    transactionCount: transactions.length,
  }
);
};