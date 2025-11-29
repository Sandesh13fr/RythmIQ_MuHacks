-- Migration: Add Feedback Loop Fields
-- Run this SQL manually in your database to add feedback fields without losing data

-- Add feedback fields to nudge_actions table
ALTER TABLE "nudge_actions" 
ADD COLUMN IF NOT EXISTS "feedbackRating" INTEGER,
ADD COLUMN IF NOT EXISTS "feedbackComment" TEXT,
ADD COLUMN IF NOT EXISTS "wasHelpful" BOOLEAN,
ADD COLUMN IF NOT EXISTS "dismissReason" TEXT,
ADD COLUMN IF NOT EXISTS "feedbackAt" TIMESTAMP(3);

-- Add index for analytics queries
CREATE INDEX IF NOT EXISTS "nudge_actions_nudgeType_idx" ON "nudge_actions"("nudgeType");

-- Add personalization fields to financial_profiles table
ALTER TABLE "financial_profiles"
ADD COLUMN IF NOT EXISTS "preferredNudgeTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "dislikedNudgeTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "optimalNudgeHour" INTEGER,
ADD COLUMN IF NOT EXISTS "nudgeFrequencyPreference" TEXT DEFAULT 'NORMAL',
ADD COLUMN IF NOT EXISTS "lastPersonalizationUpdate" TIMESTAMP(3);

-- Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'nudge_actions' 
AND column_name IN ('feedbackRating', 'feedbackComment', 'wasHelpful', 'dismissReason', 'feedbackAt')
ORDER BY column_name;

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'financial_profiles' 
AND column_name IN ('preferredNudgeTypes', 'dislikedNudgeTypes', 'optimalNudgeHour', 'nudgeFrequencyPreference', 'lastPersonalizationUpdate')
ORDER BY column_name;
