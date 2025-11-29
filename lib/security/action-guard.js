import crypto from "crypto";
import { db } from "@/lib/prisma";
import { sendEmail } from "@/actions/send-email";
import EmailTemplate from "@/emails/template";

const AES_ALGO = "aes-256-gcm";
const OTP_EXPIRY_MIN = 5;
const OTP_THRESHOLD = Number(process.env.OTP_THRESHOLD || 500);
const OTP_ENFORCED = process.env.ENFORCE_OTP === "true";
const EXPOSE_OTP_CODES = process.env.EXPOSE_OTP_CODES === "true" || process.env.NODE_ENV !== "production";

const hashOtp = (otp) => crypto.createHash("sha256").update(String(otp)).digest("hex");

export async function enforceHighValueGuard({ clerkUserId, action, amount = 0, otpCode }) {
    const numericAmount = Number(amount) || 0;
    const requiresOtp = OTP_ENFORCED && numericAmount >= OTP_THRESHOLD;

    if (!requiresOtp) {
        await logSecurityEvent({ clerkUserId, action, amount: numericAmount, otpVerified: true });
        return { verified: true, requiresOtp: false };
    }

    if (!otpCode) {
        const challenge = await createOtpChallenge({ clerkUserId, action, amount: numericAmount });
        return {
            verified: false,
            requiresOtp: true,
            expiresAt: challenge.expiresAt,
            devOtp: challenge.devOtp,
        };
    }

    await verifyOtpChallenge({ clerkUserId, otpCode });
    await logSecurityEvent({ clerkUserId, action, amount: numericAmount, otpVerified: true });
    return { verified: true, requiresOtp: false };
}

async function createOtpChallenge({ clerkUserId, action, amount }) {
    const user = await db.user.findUnique({ where: { clerkUserId } });
    if (!user) throw new Error("User not found");

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MIN * 60 * 1000);

    const challenge = await db.otpChallenge.create({
        data: {
            userId: user.id,
            action,
            amount,
            otpHash: hashOtp(otp),
            expiresAt,
        },
    });

    if (user.email) {
        await sendEmail({
            to: user.email,
            subject: "RythmIQ verification code",
            react: EmailTemplate({
                userName: user.name || user.firstName || "there",
                type: "otp",
                data: {
                    otp,
                    action,
                    expiresIn: OTP_EXPIRY_MIN,
                    amount,
                },
            }),
        });
    }

    return { expiresAt, devOtp: EXPOSE_OTP_CODES ? otp : undefined };
}

async function verifyOtpChallenge({ clerkUserId, otpCode }) {
    const user = await db.user.findUnique({ where: { clerkUserId } });
    if (!user) throw new Error("User not found");

    const challenge = await db.otpChallenge.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
    });

    if (!challenge) {
        throw new Error("No OTP challenge found");
    }

    if (challenge.expiresAt < new Date()) {
        await db.otpChallenge.delete({ where: { id: challenge.id } });
        throw new Error("OTP expired");
    }

    if (challenge.otpHash !== hashOtp(otpCode)) {
        throw new Error("Invalid OTP");
    }

    await db.otpChallenge.delete({ where: { id: challenge.id } });
    return challenge;
}

export function encryptField(value, secret = process.env.SECRET_ENCRYPTION_KEY || "") {
    if (!secret) return value;
    const iv = crypto.randomBytes(12);
    const key = crypto.createHash("sha256").update(secret).digest();
    const cipher = crypto.createCipheriv(AES_ALGO, key, iv);
    let encrypted = cipher.update(value, "utf8", "hex");
    encrypted += cipher.final("hex");
    const tag = cipher.getAuthTag();
    return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

export function decryptField(value, secret = process.env.SECRET_ENCRYPTION_KEY || "") {
    if (!secret || !value) return value;
    const [ivHex, tagHex, data] = value.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const key = crypto.createHash("sha256").update(secret).digest();
    const decipher = crypto.createDecipheriv(AES_ALGO, key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(data, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}

export async function logSecurityEvent({ clerkUserId, actorType = "user", action, amount, context, otpVerified = false }) {
    const user = clerkUserId
        ? await db.user.findUnique({ where: { clerkUserId }, select: { id: true } })
        : null;

    await db.securityAuditLog.create({
        data: {
            userId: user?.id,
            actorType,
            action,
            amount,
            context,
            otpVerified,
        },
    });
}
