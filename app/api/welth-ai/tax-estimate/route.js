import { NextResponse } from "next/server";
import { checkUser } from "@/lib/checkUser";
import { db } from "@/lib/prisma";
import {
    generateTaxEstimate,
    getCachedTaxEstimate,
    setCachedTaxEstimate,
} from "@/lib/agents/tax-agent";

/**
 * Tax Estimation Endpoint for Gig Workers
 * GET /api/RythmIQ-ai/tax-estimate
 *
 * Returns:
 * - GST liability
 * - Income tax liability
 * - Total tax liability
 * - Suggested monthly savings
 * - AI-powered tax-saving recommendations
 */
export async function GET(req) {
    try {
        const user = await checkUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check cache first (24-hour TTL)
        const cachedEstimate = getCachedTaxEstimate(user.id);
        if (cachedEstimate) {
            return NextResponse.json({
                success: true,
                ...cachedEstimate,
                cached: true,
            });
        }

        // Fetch user's income transactions
        const transactions = await db.transaction.findMany({
            where: {
                userId: user.id,
                type: "INCOME",
            },
            orderBy: { date: "desc" },
            take: 100,
        });

        if (transactions.length === 0) {
            return NextResponse.json({
                success: false,
                error: "No income data found. Add income transactions to get tax estimates.",
                gst: { gstAmount: 0, gstRequired: false },
                incomeTax: { taxAmount: 0 },
                totalTaxLiability: 0,
            });
        }

        // Calculate quarterly and annual income
        const now = new Date();
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

        const quarterlyIncome = transactions
            .filter((tx) => new Date(tx.date) >= threeMonthsAgo)
            .reduce((sum, tx) => sum + Number(tx.amount), 0);

        const annualIncome = transactions
            .filter((tx) => new Date(tx.date) >= oneYearAgo)
            .reduce((sum, tx) => sum + Number(tx.amount), 0);

        // If no recent income, project from available data
        const effectiveQuarterlyIncome = quarterlyIncome > 0
            ? quarterlyIncome
            : Math.round(annualIncome / 4);

        const effectiveAnnualIncome = annualIncome > 0
            ? annualIncome
            : quarterlyIncome * 4;

        // Determine primary income category
        const categoryCount = {};
        transactions.forEach((tx) => {
            const cat = tx.category || "Other";
            categoryCount[cat] = (categoryCount[cat] || 0) + 1;
        });
        const primaryCategory = Object.keys(categoryCount).sort(
            (a, b) => categoryCount[b] - categoryCount[a]
        )[0] || "services";

        // Generate tax estimate
        const estimate = await generateTaxEstimate(user.id, {
            quarterlyIncome: effectiveQuarterlyIncome,
            annualIncome: effectiveAnnualIncome,
            category: primaryCategory,
            transactions,
        });

        if (estimate.success) {
            // Cache the result
            setCachedTaxEstimate(user.id, estimate);
        }

        return NextResponse.json({
            success: estimate.success,
            gst: estimate.gst,
            incomeTax: estimate.incomeTax,
            totalTaxLiability: estimate.totalTaxLiability,
            quarterlyTaxLiability: estimate.quarterlyTaxLiability,
            suggestedMonthlySavings: estimate.suggestedMonthlySavings,
            aiRecommendations: estimate.aiRecommendations,
            error: estimate.error || null,
            generatedAt: estimate.generatedAt,
            dataSource: {
                quarterlyIncome: effectiveQuarterlyIncome,
                annualIncome: effectiveAnnualIncome,
                transactionCount: transactions.length,
            },
        });
    } catch (error) {
        console.error("Error in tax estimate endpoint:", error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || "Failed to generate tax estimate",
            },
            { status: 500 }
        );
    }
}
