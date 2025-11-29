-- Add recurrencePaused to transactions
ALTER TABLE "transactions" ADD COLUMN "recurrencePaused" BOOLEAN DEFAULT FALSE;
