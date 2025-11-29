import prisma from "@/lib/prisma";

/**
 * Personalization Engine - Adapts nudges based on user behavior and preferences
 */

/**
 * Personalize a nudge before sending it to the user
 */
export async function personalizeNudge(userId, nudge) {
    try {
        const profile = await prisma.financialProfile.findUnique({
            where: { userId },
        });

        if (!profile) {
            // No personalization data yet, return nudge as-is
            return { ...nudge, personalized: false };
        }

        // Apply personalization
        let personalizedNudge = { ...nudge };

        // Adjust priority based on user preferences
        if (profile.preferredNudgeTypes?.includes(nudge.nudgeType)) {
            personalizedNudge.priority = (personalizedNudge.priority || 0) + 10;
            personalizedNudge.personalizationReason = "You respond well to this type of nudge";
        }

        // Adjust message tone based on spending style
        if (profile.spendingStyle === "CAUTIOUS") {
            personalizedNudge.message = makeMessageReassuring(personalizedNudge.message);
        } else if (profile.spendingStyle === "IMPULSIVE") {
            personalizedNudge.message = makeMessageUrgent(personalizedNudge.message);
        }

        personalizedNudge.personalized = true;
        return personalizedNudge;
    } catch (error) {
        console.error("Error personalizing nudge:", error);
        return { ...nudge, personalized: false };
    }
}

/**
 * Filter nudges based on user preferences
 */
export async function filterNudgesByPreference(userId, nudges) {
    try {
        const profile = await prisma.financialProfile.findUnique({
            where: { userId },
        });

        if (!profile) {
            return nudges; // No filtering if no profile
        }

        // Filter out disliked nudge types
        let filtered = nudges.filter(nudge => {
            return !profile.dislikedNudgeTypes?.includes(nudge.nudgeType);
        });

        // Apply frequency preference
        if (profile.nudgeFrequencyPreference === "LOW") {
            // Only keep high-priority nudges
            filtered = filtered.filter(n => (n.priority || 0) >= 5);
        } else if (profile.nudgeFrequencyPreference === "HIGH") {
            // Keep all nudges
            filtered = nudges;
        }

        // Sort by preference (preferred types first)
        filtered.sort((a, b) => {
            const aPreferred = profile.preferredNudgeTypes?.includes(a.nudgeType) ? 1 : 0;
            const bPreferred = profile.preferredNudgeTypes?.includes(b.nudgeType) ? 1 : 0;

            if (aPreferred !== bPreferred) {
                return bPreferred - aPreferred; // Preferred first
            }

            return (b.priority || 0) - (a.priority || 0); // Then by priority
        });

        return filtered;
    } catch (error) {
        console.error("Error filtering nudges:", error);
        return nudges;
    }
}

/**
 * Predict likelihood of nudge acceptance
 */
export async function predictNudgeSuccess(userId, nudgeType) {
    try {
        // Get historical data for this nudge type
        const historicalNudges = await prisma.nudgeAction.findMany({
            where: {
                userId,
                nudgeType,
            },
            take: 20, // Last 20 nudges of this type
            orderBy: { createdAt: "desc" },
        });

        if (historicalNudges.length === 0) {
            return {
                probability: 0.5, // 50% default for new nudge types
                confidence: "low",
                reason: "No historical data for this nudge type",
            };
        }

        // Calculate acceptance rate
        const accepted = historicalNudges.filter(
            n => n.status === "accepted" || n.status === "executed"
        ).length;
        const probability = accepted / historicalNudges.length;

        // Calculate confidence based on sample size
        let confidence = "low";
        if (historicalNudges.length >= 10) confidence = "medium";
        if (historicalNudges.length >= 20) confidence = "high";

        return {
            probability,
            confidence,
            sampleSize: historicalNudges.length,
            reason: `Based on ${historicalNudges.length} previous ${nudgeType} nudges`,
        };
    } catch (error) {
        console.error("Error predicting nudge success:", error);
        return {
            probability: 0.5,
            confidence: "low",
            reason: "Error calculating probability",
        };
    }
}

/**
 * Determine optimal time to send a nudge
 */
export async function getOptimalNudgeTime(userId) {
    try {
        const profile = await prisma.financialProfile.findUnique({
            where: { userId },
        });

        if (!profile || profile.optimalNudgeHour === null) {
            // Default to 9 AM if no data
            return {
                hour: 9,
                reason: "Default morning time (no personalization data yet)",
            };
        }

        return {
            hour: profile.optimalNudgeHour,
            reason: `You typically respond well at this time`,
        };
    } catch (error) {
        console.error("Error getting optimal time:", error);
        return {
            hour: 9,
            reason: "Default morning time",
        };
    }
}

/**
 * Check if user should receive a nudge now based on frequency preference
 */
export async function shouldSendNudgeNow(userId) {
    try {
        const profile = await prisma.financialProfile.findUnique({
            where: { userId },
        });

        if (!profile) {
            return { shouldSend: true, reason: "No frequency preference set" };
        }

        // Get recent nudges (last 24 hours)
        const oneDayAgo = new Date();
        oneDayAgo.setHours(oneDayAgo.getHours() - 24);

        const recentNudges = await prisma.nudgeAction.findMany({
            where: {
                userId,
                createdAt: { gte: oneDayAgo },
            },
        });

        const nudgeCount = recentNudges.length;

        // Apply frequency limits
        if (profile.nudgeFrequencyPreference === "LOW" && nudgeCount >= 2) {
            return {
                shouldSend: false,
                reason: "User prefers low frequency (max 2 per day)",
            };
        } else if (profile.nudgeFrequencyPreference === "NORMAL" && nudgeCount >= 5) {
            return {
                shouldSend: false,
                reason: "User prefers normal frequency (max 5 per day)",
            };
        } else if (profile.nudgeFrequencyPreference === "HIGH" && nudgeCount >= 10) {
            return {
                shouldSend: false,
                reason: "Even high frequency has limits (max 10 per day)",
            };
        }

        return {
            shouldSend: true,
            reason: `Within frequency limit (${nudgeCount} nudges today)`,
        };
    } catch (error) {
        console.error("Error checking nudge frequency:", error);
        return { shouldSend: true, reason: "Error checking frequency" };
    }
}

/**
 * Helper: Make message more reassuring for cautious users
 */
function makeMessageReassuring(message) {
    // Add reassuring phrases
    if (message.includes("save")) {
        return message + " This is a safe amount that won't affect your daily needs.";
    }
    if (message.includes("spend")) {
        return message + " You have enough buffer for emergencies.";
    }
    return message;
}

/**
 * Helper: Make message more urgent for impulsive users
 */
function makeMessageUrgent(message) {
    // Add urgency
    if (message.includes("save")) {
        return "⚡ " + message + " Act now to secure your future!";
    }
    if (message.includes("budget")) {
        return "⚠️ " + message + " Take action before it's too late.";
    }
    return message;
}

/**
 * Get personalization summary for user
 */
export async function getPersonalizationSummary(userId) {
    try {
        const profile = await prisma.financialProfile.findUnique({
            where: { userId },
        });

        if (!profile) {
            return {
                success: true,
                isPersonalized: false,
                message: "Start providing feedback to personalize your experience!",
            };
        }

        const hasPreferences =
            (profile.preferredNudgeTypes?.length > 0) ||
            (profile.dislikedNudgeTypes?.length > 0) ||
            (profile.optimalNudgeHour !== null);

        return {
            success: true,
            isPersonalized: hasPreferences,
            preferredTypes: profile.preferredNudgeTypes || [],
            dislikedTypes: profile.dislikedNudgeTypes || [],
            optimalHour: profile.optimalNudgeHour,
            frequencyPreference: profile.nudgeFrequencyPreference,
            lastUpdate: profile.lastPersonalizationUpdate,
            message: hasPreferences
                ? "Your nudges are personalized based on your behavior"
                : "Keep using RythmIQ to build your personalization profile",
        };
    } catch (error) {
        console.error("Error getting personalization summary:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}
