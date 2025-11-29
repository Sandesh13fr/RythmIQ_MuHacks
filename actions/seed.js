"use server";

import { db } from "@/lib/prisma";
import { subDays } from "date-fns";

const ACCOUNT_ID = "5fe5e422-16a6-40b8-9ce8-e83033e30811";
const USER_ID = "fe1a338e-b774-49e0-b2c1-bcfb3a463219";

// Categories with their typical amount ranges
const CATEGORIES = {
  INCOME: [
    { name: "salary", range: [5000, 8000] },
    { name: "freelance", range: [1000, 3000] },
    { name: "investments", range: [500, 2000] },
    { name: "other-income", range: [100, 1000] },
    { name: "gig-work", range: [200, 1500] }, // New: Irregular income
  ],
  EXPENSE: [
    { name: "housing", range: [1000, 2000] },
    { name: "transportation", range: [100, 500] },
    { name: "groceries", range: [200, 600] },
    { name: "utilities", range: [100, 300] },
    { name: "entertainment", range: [50, 200] },
    { name: "food", range: [50, 150] },
    { name: "shopping", range: [100, 500] },
    { name: "healthcare", range: [100, 1000] },
    { name: "education", range: [200, 1000] },
    { name: "travel", range: [500, 2000] },
  ],
};

// Helper to generate random amount within a range
function getRandomAmount(min, max) {
  return Number((Math.random() * (max - min) + min).toFixed(2));
}

// Helper to get random category with amount
function getRandomCategory(type, isFestival = false) {
  let categories = CATEGORIES[type];

  // Festival Logic: Increase shopping/food expenses
  if (isFestival && type === "EXPENSE") {
    categories = categories.filter(c => ["shopping", "food", "entertainment", "travel"].includes(c.name));
  }

  const category = categories[Math.floor(Math.random() * categories.length)];
  let amount = getRandomAmount(category.range[0], category.range[1]);

  // Festival Logic: Boost amount by 30-50%
  if (isFestival && type === "EXPENSE") {
    amount = amount * (1 + Math.random() * 0.5);
  }

  return { category: category.name, amount };
}

export async function seedTransactions() {
  try {
    // Generate 180 days (6 months) of transactions
    const transactions = [];
    let totalBalance = 0;

    for (let i = 180; i >= 0; i--) {
      const date = subDays(new Date(), i);

      // Festival Simulation (e.g., every ~90 days for 5 days)
      const isFestival = (i % 90) < 5;

      // Gig Work Simulation (Random spikes every ~10 days)
      const isGigDay = Math.random() < 0.15;

      // Generate 1-3 transactions per day, more during festivals
      const transactionsPerDay = isFestival ? Math.floor(Math.random() * 3) + 2 : Math.floor(Math.random() * 3) + 1;

      for (let j = 0; j < transactionsPerDay; j++) {
        let type = Math.random() < 0.4 ? "INCOME" : "EXPENSE";

        // Force Gig Income on Gig Days
        if (isGigDay && j === 0) {
          type = "INCOME";
        }

        let { category, amount } = getRandomCategory(type, isFestival);

        // Override for Gig Work
        if (isGigDay && j === 0 && type === "INCOME") {
          category = "gig-work";
          amount = getRandomAmount(500, 2500); // Higher spike
        }

        const transaction = {
          id: crypto.randomUUID(),
          type,
          amount,
          description: `${type === "INCOME" ? "Received" : "Paid for"
            } ${category} ${isFestival ? "(Festival)" : ""} ${category === "gig-work" ? "(Gig)" : ""}`,
          date,
          category,
          status: "COMPLETED",
          userId: USER_ID,
          accountId: ACCOUNT_ID,
          createdAt: date,
          updatedAt: date,
        };

        totalBalance += type === "INCOME" ? amount : -amount;
        transactions.push(transaction);
      }
    }

    // Insert transactions in batches and update account balance
    await db.$transaction(async (tx) => {
      // Clear existing transactions
      await tx.transaction.deleteMany({
        where: { accountId: ACCOUNT_ID },
      });

      // Insert new transactions
      await tx.transaction.createMany({
        data: transactions,
      });

      // Update account balance
      await tx.account.update({
        where: { id: ACCOUNT_ID },
        data: { balance: totalBalance },
      });
    });

    return {
      success: true,
      message: `Created ${transactions.length} transactions (6 months history)`,
    };
  } catch (error) {
    console.error("Error seeding transactions:", error);
    return { success: false, error: error.message };
  }
}