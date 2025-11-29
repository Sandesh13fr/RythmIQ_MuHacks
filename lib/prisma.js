import { PrismaClient } from "@prisma/client";

// Enhanced Prisma client with connection retry logic
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    errorFormat: "pretty",
  });
};

export const db = globalThis.prisma || prismaClientSingleton();

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = db;
}

// Connection health check
export async function checkDatabaseConnection() {
  try {
    await db.$queryRaw`SELECT 1`;
    return { connected: true, error: null };
  } catch (error) {
    console.error("Database connection error:", error.message);
    return {
      connected: false,
      error: error.message,
      hint: "Check if Supabase project is paused or database URL is correct"
    };
  }
}

// Graceful disconnect on app shutdown
process.on('beforeExit', async () => {
  await db.$disconnect();
});