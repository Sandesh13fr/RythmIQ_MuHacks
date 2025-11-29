import { db } from "@/lib/prisma";

const RATE_LIMIT = 20;
const ANOMALY_THRESHOLD = 0.8;

export async function evaluateAgentOutput({ userId, summary, cost, tokens }) {
    const anomalies = [];

    if ((summary || "").includes("transfer all funds")) {
        anomalies.push("suspicious-transfer-language");
    }

    if (tokens && tokens > 2000) {
        anomalies.push("token-spike");
    }

    const riskScore = Math.min(1, anomalies.length * 0.4 + (cost || 0) / 10);
    const shouldLock = riskScore >= ANOMALY_THRESHOLD;

    if (shouldLock) {
        await db.agentSafetyState.upsert({
            where: { userId },
            update: {
                autopilotLocked: true,
                lockedAt: new Date(),
                reason: anomalies.join(","),
                lastAnomaly: { anomalies, summary, cost, tokens },
            },
            create: {
                userId,
                autopilotLocked: true,
                lockedAt: new Date(),
                reason: anomalies.join(","),
                lastAnomaly: { anomalies, summary, cost, tokens },
            },
        });
    }

    return { anomalies, riskScore, locked: shouldLock };
}

export async function resetAutopilot(userId, context = {}) {
    await db.agentSafetyState.upsert({
        where: { userId },
        update: {
            autopilotLocked: false,
            reason: null,
            lockedAt: null,
            lastAnomaly: context,
        },
        create: {
            userId,
            autopilotLocked: false,
            reason: null,
            lastAnomaly: context,
        },
    });
}

export async function getSafetyState(userId) {
    return db.agentSafetyState.findUnique({ where: { userId } });
}
