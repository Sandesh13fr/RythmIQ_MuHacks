import prisma from "@/lib/prisma";

/**
 * Feedback Service - Handles feedback collection and behavioral analytics
 */

/**
 * Collect feedback for a nudge action
 */
export async function collectFeedback(nudgeId, userId, feedbackData) {
    try {
        const { rating, comment, wasHelpful, dismissReason } = feedbackData;

        // Update the nudge action with feedback
        const updatedNudge = await prisma.nudgeAction.update({
            where: { id: nudgeId, userId }, // Ensure user owns this nudge
            data: {
                feedbackRating: rating,
                feedbackComment: comment,
                wasHelpful,
                dismissReason,
                feedbackAt: new Date(),
            },
        });

        // Trigger personalization update
        await updatePersonalizationFromFeedback(userId, updatedNudge);

        return {
            success: true,
            nudge: updatedNudge,
        };
    } catch (error) {
        console.error("Error collecting feedback:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Update user personalization based on feedback
 */
async function updatePersonalizationFromFeedback(userId, nudge) {
    try {
        // Get or create financial profile
        let profile = await prisma.financialProfile.findUnique({
            where: { userId },
        });

        if (!profile) {
            profile = await prisma.financialProfile.create({
                data: { userId },
            });
        }

        const nudgeType = nudge.nudgeType;
        const wasPositive = nudge.wasHelpful === true || (nudge.feedbackRating && nudge.feedbackRating >= 4);
        const wasNegative = nudge.wasHelpful === false || (nudge.feedbackRating && nudge.feedbackRating <= 2);

        let preferredTypes = [...(profile.preferredNudgeTypes || [])];
        let dislikedTypes = [...(profile.dislikedNudgeTypes || [])];

        // Update preferences based on feedback
        if (wasPositive) {
            // Add to preferred if not already there
            if (!preferredTypes.includes(nudgeType)) {
                preferredTypes.push(nudgeType);
            }
            // Remove from disliked if it's there
            dislikedTypes = dislikedTypes.filter(t => t !== nudgeType);
        } else if (wasNegative) {
            // Add to disliked if not already there
            if (!dislikedTypes.includes(nudgeType)) {
                dislikedTypes.push(nudgeType);
            }
            // Remove from preferred if it's there
            preferredTypes = preferredTypes.filter(t => t !== nudgeType);
        }

        // Calculate optimal nudge hour (hour when user most often responds positively)
        const optimalHour = await calculateOptimalNudgeHour(userId);

        // Update profile
        await prisma.financialProfile.update({
            where: { userId },
            data: {
                preferredNudgeTypes: preferredTypes,
                dislikedNudgeTypes: dislikedTypes,
                optimalNudgeHour: optimalHour,
                lastPersonalizationUpdate: new Date(),
            },
        });

        return { success: true };
    } catch (error) {
        console.error("Error updating personalization:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Calculate optimal hour for nudges based on user response patterns
 */
async function calculateOptimalNudgeHour(userId) {
    try {
        // Get all accepted/helpful nudges
        const positiveNudges = await prisma.nudgeAction.findMany({
            where: {
                userId,
                OR: [
                    { status: "accepted" },
                    { wasHelpful: true },
                    { feedbackRating: { gte: 4 } },
                ],
            },
            select: {
                respondedAt: true,
                feedbackAt: true,
            },
        });

        if (positiveNudges.length === 0) return null;

        // Count responses by hour
        const hourCounts = {};
        positiveNudges.forEach(nudge => {
            const responseTime = nudge.respondedAt || nudge.feedbackAt;
            if (responseTime) {
                const hour = new Date(responseTime).getHours();
                hourCounts[hour] = (hourCounts[hour] || 0) + 1;
            }
        });

        // Find hour with most positive responses
        let maxHour = null;
        let maxCount = 0;
        Object.entries(hourCounts).forEach(([hour, count]) => {
            if (count > maxCount) {
                maxCount = count;
                maxHour = parseInt(hour);
            }
        });

        return maxHour;
    } catch (error) {
        console.error("Error calculating optimal hour:", error);
        return null;
    }
}

/**
 * Calculate nudge effectiveness metrics
 */
export async function calculateNudgeEffectiveness(userId, days = 30) {
    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Get all nudges in the time period
        const nudges = await prisma.nudgeAction.findMany({
            where: {
                userId,
                createdAt: { gte: startDate },
            },
            orderBy: { createdAt: "asc" },
        });

        // Calculate metrics by type
        const metricsByType = {};
        const overallMetrics = {
            total: nudges.length,
            accepted: 0,
            rejected: 0,
            expired: 0,
            withFeedback: 0,
            avgRating: 0,
            helpfulCount: 0,
            notHelpfulCount: 0,
        };

        nudges.forEach(nudge => {
            const type = nudge.nudgeType;

            if (!metricsByType[type]) {
                metricsByType[type] = {
                    total: 0,
                    accepted: 0,
                    rejected: 0,
                    expired: 0,
                    acceptanceRate: 0,
                    avgRating: 0,
                    ratingCount: 0,
                    totalRating: 0,
                    helpfulCount: 0,
                    notHelpfulCount: 0,
                };
            }

            metricsByType[type].total++;

            // Status counts
            if (nudge.status === "accepted" || nudge.status === "executed") {
                metricsByType[type].accepted++;
                overallMetrics.accepted++;
            } else if (nudge.status === "rejected") {
                metricsByType[type].rejected++;
                overallMetrics.rejected++;
            } else if (nudge.status === "expired") {
                metricsByType[type].expired++;
                overallMetrics.expired++;
            }

            // Feedback metrics
            if (nudge.feedbackRating) {
                metricsByType[type].ratingCount++;
                metricsByType[type].totalRating += nudge.feedbackRating;
                overallMetrics.withFeedback++;
            }

            if (nudge.wasHelpful === true) {
                metricsByType[type].helpfulCount++;
                overallMetrics.helpfulCount++;
            } else if (nudge.wasHelpful === false) {
                metricsByType[type].notHelpfulCount++;
                overallMetrics.notHelpfulCount++;
            }
        });

        // Calculate rates and averages
        Object.keys(metricsByType).forEach(type => {
            const metrics = metricsByType[type];
            metrics.acceptanceRate = metrics.total > 0
                ? (metrics.accepted / metrics.total) * 100
                : 0;
            metrics.avgRating = metrics.ratingCount > 0
                ? metrics.totalRating / metrics.ratingCount
                : 0;
        });

        // Calculate overall acceptance rate
        overallMetrics.acceptanceRate = overallMetrics.total > 0
            ? (overallMetrics.accepted / overallMetrics.total) * 100
            : 0;

        // Calculate average rating across all nudges
        const allRatings = nudges.filter(n => n.feedbackRating).map(n => n.feedbackRating);
        overallMetrics.avgRating = allRatings.length > 0
            ? allRatings.reduce((sum, r) => sum + r, 0) / allRatings.length
            : 0;

        return {
            success: true,
            overall: overallMetrics,
            byType: metricsByType,
            period: { days, startDate, endDate: new Date() },
        };
    } catch (error) {
        console.error("Error calculating effectiveness:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Get behavioral insights for a user
 */
export async function getBehavioralInsights(userId) {
    try {
        const profile = await prisma.financialProfile.findUnique({
            where: { userId },
        });

        if (!profile) {
            return {
                success: true,
                insights: {
                    hasData: false,
                    message: "Not enough data yet. Keep using RythmIQ to build your profile!",
                },
            };
        }

        // Get recent effectiveness metrics
        const effectiveness = await calculateNudgeEffectiveness(userId, 30);

        // Build insights
        const insights = {
            hasData: true,
            preferredNudgeTypes: profile.preferredNudgeTypes || [],
            dislikedNudgeTypes: profile.dislikedNudgeTypes || [],
            optimalNudgeHour: profile.optimalNudgeHour,
            nudgeFrequencyPreference: profile.nudgeFrequencyPreference,
            acceptanceRate: effectiveness.success ? effectiveness.overall.acceptanceRate : 0,
            avgRating: effectiveness.success ? effectiveness.overall.avgRating : 0,
            totalNudges: effectiveness.success ? effectiveness.overall.total : 0,
            lastUpdate: profile.lastPersonalizationUpdate,
            rhythm: {
                income: profile.incomeRhythm || null,
                spending: profile.spendRhythm || null,
            },
            recommendations: generateRecommendations(profile, effectiveness),
        };

        return {
            success: true,
            insights,
        };
    } catch (error) {
        console.error("Error getting behavioral insights:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Generate personalized recommendations
 */
function generateRecommendations(profile, effectiveness) {
    const recommendations = [];

    // Check acceptance rate
    if (effectiveness.success && effectiveness.overall.acceptanceRate < 50) {
        recommendations.push({
            type: "low_acceptance",
            message: "Your nudge acceptance rate is low. We're learning your preferences to show more relevant suggestions.",
            action: "Keep providing feedback to help us improve!",
        });
    }

    // Check if user has preferred types
    if (profile.preferredNudgeTypes && profile.preferredNudgeTypes.length > 0) {
        recommendations.push({
            type: "preferences_learned",
            message: `You respond well to ${profile.preferredNudgeTypes.join(", ")} nudges.`,
            action: "We'll prioritize these types for you.",
        });
    }

    // Check optimal timing
    if (profile.optimalNudgeHour !== null) {
        const hour = profile.optimalNudgeHour;
        const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
        recommendations.push({
            type: "optimal_timing",
            message: `You're most responsive in the ${timeOfDay} (around ${hour}:00).`,
            action: "We'll send important nudges during this time.",
        });
    }

    return recommendations;
}

/**
 * Get effectiveness trends over time
 */
export async function getEffectivenessTrends(userId, weeks = 4) {
    try {
        const trends = [];
        const today = new Date();

        for (let i = weeks - 1; i >= 0; i--) {
            const endDate = new Date(today);
            endDate.setDate(endDate.getDate() - (i * 7));

            const startDate = new Date(endDate);
            startDate.setDate(startDate.getDate() - 7);

            const weekNudges = await prisma.nudgeAction.findMany({
                where: {
                    userId,
                    createdAt: {
                        gte: startDate,
                        lt: endDate,
                    },
                },
            });

            const accepted = weekNudges.filter(n => n.status === "accepted" || n.status === "executed").length;
            const total = weekNudges.length;
            const acceptanceRate = total > 0 ? (accepted / total) * 100 : 0;

            const ratings = weekNudges.filter(n => n.feedbackRating).map(n => n.feedbackRating);
            const avgRating = ratings.length > 0
                ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
                : 0;

            trends.push({
                week: `Week ${weeks - i}`,
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0],
                total,
                accepted,
                acceptanceRate: Math.round(acceptanceRate),
                avgRating: Math.round(avgRating * 10) / 10,
            });
        }

        return {
            success: true,
            trends,
        };
    } catch (error) {
        console.error("Error getting trends:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}
