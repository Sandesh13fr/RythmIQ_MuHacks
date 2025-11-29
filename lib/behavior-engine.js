import { db } from "@/lib/prisma";
import { updateRhythmProfile } from "@/lib/income-rhythm";

/**
 * Behavior-Aware Nudge Engine
 * Learns from user actions (accepts, ignores, rejects) to adjust nudge aggressiveness and personalization
 */

const BEHAVIOR_THRESHOLDS = {
    HIGH_ACCEPTANCE: 0.7, // >70% acceptance = aggressive nudges
    LOW_ACCEPTANCE: 0.3,  // <30% acceptance = reduce frequency
    IGNORE_THRESHOLD: 3,   // >3 ignores in a row = switch to summaries
    REJECT_THRESHOLD: 0.5, // >50% rejects = cautious style
};

/**
 * Analyze user's nudge behavior from recent history
 * @param {string} userId - User ID
 * @param {number} days - Lookback period in days
 * @returns {Object} Behavior metrics
 */
export async function analyzeNudgeBehavior(userId, days = 30) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const nudges = await db.nudgeAction.findMany({
        where: {
            userId,
            createdAt: { gte: startDate },
        },
        orderBy: { createdAt: "desc" },
    });

    if (nudges.length === 0) {
        return {
            total: 0,
            accepted: 0,
            rejected: 0,
            expired: 0,
            pending: 0,
            acceptanceRate: 0,
            rejectionRate: 0,
            ignoreRate: 0,
            recentIgnores: 0,
            aggressiveness: "neutral",
            recommendations: ["Not enough data yet"],
        };
    }

    const accepted = nudges.filter(n => n.status === "executed").length;
    const rejected = nudges.filter(n => n.status === "rejected").length;
    const expired = nudges.filter(n => n.status === "expired").length;
    const pending = nudges.filter(n => n.status === "pending").length;

    const acceptanceRate = accepted / nudges.length;
    const rejectionRate = rejected / nudges.length;
    const ignoreRate = expired / nudges.length;

    // Check recent ignores (last 5 nudges)
    const recentNudges = nudges.slice(0, 5);
    const recentIgnores = recentNudges.filter(n => n.status === "expired").length;

    // Determine aggressiveness
    let aggressiveness = "neutral";
    const recommendations = [];

    if (acceptanceRate > BEHAVIOR_THRESHOLDS.HIGH_ACCEPTANCE) {
        aggressiveness = "aggressive";
        recommendations.push("Increase nudge frequency and priority");
    } else if (acceptanceRate < BEHAVIOR_THRESHOLDS.LOW_ACCEPTANCE) {
        aggressiveness = "conservative";
        recommendations.push("Reduce nudge frequency, prefer summaries");
    }

    if (recentIgnores > BEHAVIOR_THRESHOLDS.IGNORE_THRESHOLD) {
        recommendations.push("Switch to nightly summary instead of real-time pushes");
    }

    if (rejectionRate > BEHAVIOR_THRESHOLDS.REJECT_THRESHOLD) {
        recommendations.push("Adjust nudge types to match user preferences");
    }

    return {
        total: nudges.length,
        accepted,
        rejected,
        expired,
        pending,
        acceptanceRate,
        rejectionRate,
        ignoreRate,
        recentIgnores,
        aggressiveness,
        recommendations,
    };
}

/**
 * Adjust user's financial profile based on behavior analysis
 * @param {string} userId - User ID
 */
export async function adjustProfileFromBehavior(userId) {
    const behavior = await analyzeNudgeBehavior(userId);

    let profile = await db.financialProfile.findUnique({
        where: { userId },
    });

    if (!profile) {
        profile = await db.financialProfile.create({ data: { userId } });
    }

    let updates = {};

    // Adjust risk tolerance based on acceptance
    if (behavior.acceptanceRate > BEHAVIOR_THRESHOLDS.HIGH_ACCEPTANCE) {
        updates.riskTolerance = "HIGH";
    } else if (behavior.acceptanceRate < BEHAVIOR_THRESHOLDS.LOW_ACCEPTANCE) {
        updates.riskTolerance = "LOW";
    } else {
        updates.riskTolerance = "MODERATE";
    }

    // Adjust spending style based on rejections
    if (behavior.rejectionRate > BEHAVIOR_THRESHOLDS.REJECT_THRESHOLD) {
        updates.spendingStyle = "CAUTIOUS";
    } else if (behavior.acceptanceRate > BEHAVIOR_THRESHOLDS.HIGH_ACCEPTANCE) {
        updates.spendingStyle = "BALANCED";
    } else {
        updates.spendingStyle = "IMPULSIVE";
    }

    // Auto-nudge enabled based on overall engagement
    const engagementRate = behavior.acceptanceRate + (behavior.pending / behavior.total);
    updates.autoNudgeEnabled = engagementRate > 0.5;

    await db.financialProfile.update({
        where: { userId },
        data: updates,
    });

    await updateRhythmProfile(userId);

    return { behavior, updates };
}

/**
 * Get personalized nudge settings based on behavior
 * @param {string} userId - User ID
 * @returns {Object} Nudge settings
 */
export async function getPersonalizedNudgeSettings(userId) {
    const behavior = await analyzeNudgeBehavior(userId);

    return {
        maxNudgesPerDay: behavior.aggressiveness === "aggressive" ? 5 :
                         behavior.aggressiveness === "conservative" ? 1 : 3,
        preferSummaries: behavior.recentIgnores > BEHAVIOR_THRESHOLDS.IGNORE_THRESHOLD,
        priorityThreshold: behavior.aggressiveness === "aggressive" ? 2 :
                           behavior.aggressiveness === "conservative" ? 8 : 5,
        timing: behavior.aggressiveness === "aggressive" ? "immediate" :
                behavior.aggressiveness === "conservative" ? "evening" : "morning",
    };
}
