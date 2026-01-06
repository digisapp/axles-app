-- Add lead scoring columns
-- Run this in Supabase SQL Editor

-- Add score column (0-100)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS score INT DEFAULT 0;

-- Add score factors as JSONB for detailed breakdown
ALTER TABLE leads ADD COLUMN IF NOT EXISTS score_factors JSONB DEFAULT '{}';

-- Add buyer fingerprint for tracking repeat visitors
ALTER TABLE leads ADD COLUMN IF NOT EXISTS buyer_fingerprint TEXT;

-- Create index on score for sorting high-priority leads first
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score DESC);

-- Update existing leads with default score based on simple rules
UPDATE leads
SET
  score = CASE
    WHEN buyer_phone IS NOT NULL AND message IS NOT NULL AND LENGTH(message) > 100 THEN 50
    WHEN buyer_phone IS NOT NULL THEN 35
    WHEN message IS NOT NULL AND LENGTH(message) > 50 THEN 25
    ELSE 15
  END,
  score_factors = jsonb_build_object(
    'hasPhone', buyer_phone IS NOT NULL,
    'messageLength', CASE
      WHEN message IS NULL THEN 'none'
      WHEN LENGTH(message) > 200 THEN 'long'
      WHEN LENGTH(message) > 50 THEN 'medium'
      ELSE 'short'
    END
  )
WHERE score IS NULL OR score = 0;

-- Add comment explaining the scoring system
COMMENT ON COLUMN leads.score IS 'Lead quality score from 0-100. Higher = more likely to convert. Calculated from email domain, phone presence, message analysis, and AI sentiment.';
COMMENT ON COLUMN leads.score_factors IS 'JSON breakdown of scoring factors: companyEmail, hasPhone, phoneMatchesState, highIntentMessage, aiSentiment, aiIntent';
