-- Add autoNudgeEnabled to financial_profiles
ALTER TABLE "financial_profiles" ADD COLUMN "autoNudgeEnabled" BOOLEAN DEFAULT FALSE;

-- Create goals table
CREATE TABLE IF NOT EXISTS "goals" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "targetAmount" NUMERIC NOT NULL,
  "savedAmount" NUMERIC DEFAULT 0,
  "targetDate" TIMESTAMP NULL,
  "priority" INT DEFAULT 0,
  "status" TEXT DEFAULT 'active',
  "createdAt" TIMESTAMP DEFAULT now(),
  "updatedAt" TIMESTAMP DEFAULT now()
);

CREATE INDEX "goals_userId_idx" ON "goals"("userId");
ALTER TABLE "goals" ADD CONSTRAINT "goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
