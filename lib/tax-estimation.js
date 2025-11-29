/**
 * Tax Estimation for Gig Workers (India)
 * Simplified tax calculation based on income tax slabs and GST
 */

// Income Tax Slabs for FY 2024-25 (New Tax Regime)
const TAX_SLABS = [
    { min: 0, max: 300000, rate: 0 },
    { min: 300000, max: 700000, rate: 5 },
    { min: 700000, max: 1000000, rate: 10 },
    { min: 1000000, max: 1200000, rate: 15 },
    { min: 1200000, max: 1500000, rate: 20 },
    { min: 1500000, max: Infinity, rate: 30 }
];

export function calculateIncomeTax(annualIncome) {
    let tax = 0;

    for (const slab of TAX_SLABS) {
        if (annualIncome > slab.min) {
            const taxableInSlab = Math.min(annualIncome, slab.max) - slab.min;
            tax += (taxableInSlab * slab.rate) / 100;
        }
    }

    return Math.round(tax);
}

export function calculateGST(quarterlyIncome) {
    // GST applicable if annual turnover > ₹20 lakhs (₹5 lakhs per quarter)
    const GST_THRESHOLD = 500000;
    const GST_RATE = 18; // Standard GST rate

    if (quarterlyIncome * 4 < 2000000) {
        return 0; // Below threshold
    }

    // Simplified: GST on services
    return Math.round((quarterlyIncome * GST_RATE) / 100);
}

export function estimateTaxLiability(transactions) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Calculate financial year (April to March)
    const fyStart = currentMonth >= 3
        ? new Date(currentYear, 3, 1) // April 1st this year
        : new Date(currentYear - 1, 3, 1); // April 1st last year

    const fyEnd = new Date(fyStart.getFullYear() + 1, 2, 31); // March 31st next year

    // Filter income transactions in current FY
    const fyIncome = transactions.filter(t => {
        const tDate = new Date(t.date);
        return t.type === "INCOME" && tDate >= fyStart && tDate <= fyEnd;
    });

    const totalIncome = fyIncome.reduce((sum, t) => sum + Number(t.amount), 0);

    // Calculate quarterly income for GST
    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const quarterIncome = transactions
        .filter(t => {
            const tDate = new Date(t.date);
            return t.type === "INCOME" && tDate >= quarterStart;
        })
        .reduce((sum, t) => sum + Number(t.amount), 0);

    // Calculate taxes
    const incomeTax = calculateIncomeTax(totalIncome);
    const gst = calculateGST(quarterIncome);

    // Calculate monthly savings needed
    const monthsRemaining = Math.max(1, 12 - (now.getMonth() - fyStart.getMonth()));
    const monthlySavings = Math.round((incomeTax + gst) / monthsRemaining);

    return {
        totalIncome,
        incomeTax,
        gst,
        totalTax: incomeTax + gst,
        monthlySavings,
        fyStart: fyStart.toISOString().split('T')[0],
        fyEnd: fyEnd.toISOString().split('T')[0],
        quarterIncome,
        projectedAnnualIncome: totalIncome * (12 / Math.max(1, now.getMonth() - fyStart.getMonth()))
    };
}

export function getTaxAdvice(taxData) {
    const { totalIncome, incomeTax, gst, monthlySavings } = taxData;

    if (totalIncome < 300000) {
        return {
            status: "safe",
            message: "You're below the tax threshold. No income tax liability.",
            action: "Keep tracking your income to stay informed."
        };
    }

    if (monthlySavings > 0) {
        return {
            status: "action_needed",
            message: `You need to save ₹${monthlySavings.toLocaleString()}/month for taxes.`,
            action: `Set aside ₹${monthlySavings.toLocaleString()} this month to avoid a tax crunch.`
        };
    }

    return {
        status: "info",
        message: "Tax estimation in progress.",
        action: "Add more income transactions for accurate estimates."
    };
}
