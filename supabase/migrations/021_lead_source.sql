-- Add source field to leads to track where lead came from
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'website' CHECK (source IN ('website', 'phone_call', 'chat', 'referral', 'other'));

-- Index for filtering by source
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
