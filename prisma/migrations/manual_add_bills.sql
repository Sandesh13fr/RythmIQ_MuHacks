-- Migration: Add Bills Table for Bill & EMI Guardian
-- Run this SQL in your database to add bill tracking functionality

-- Create bills table
CREATE TABLE IF NOT EXISTS "bills" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "amount" DECIMAL(65,30) NOT NULL,
  "dueDay" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isPaid" BOOLEAN NOT NULL DEFAULT false,
  "lastPaidDate" TIMESTAMP(3),
  "nextDueDate" TIMESTAMP(3) NOT NULL,
  "autoPayEnabled" BOOLEAN NOT NULL DEFAULT false,
  "reminderDays" INTEGER NOT NULL DEFAULT 3,
  "detectedFrom" TEXT,
  "confidence" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bills_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "bills_userId_idx" ON "bills"("userId");
CREATE INDEX IF NOT EXISTS "bills_nextDueDate_idx" ON "bills"("nextDueDate");
CREATE INDEX IF NOT EXISTS "bills_category_idx" ON "bills"("category");

-- Verify the table was created
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'bills'
ORDER BY ordinal_position;

-- Check if indexes were created
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'bills';
