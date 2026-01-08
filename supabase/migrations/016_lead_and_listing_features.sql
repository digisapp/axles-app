-- Migration: Lead management improvements and listing scheduling

-- Add follow-up reminder fields to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS follow_up_date TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS follow_up_note TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Add scheduled publishing to listings
ALTER TABLE listings ADD COLUMN IF NOT EXISTS publish_at TIMESTAMPTZ;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS unpublish_at TIMESTAMPTZ;

-- Index for finding leads that need follow-up
CREATE INDEX IF NOT EXISTS idx_leads_follow_up
  ON leads (user_id, follow_up_date)
  WHERE follow_up_date IS NOT NULL AND status NOT IN ('won', 'lost');

-- Index for finding scheduled listings
CREATE INDEX IF NOT EXISTS idx_listings_publish_at
  ON listings (publish_at)
  WHERE publish_at IS NOT NULL AND status = 'draft';

CREATE INDEX IF NOT EXISTS idx_listings_unpublish_at
  ON listings (unpublish_at)
  WHERE unpublish_at IS NOT NULL AND status = 'active';

-- Function to get overdue follow-ups count
CREATE OR REPLACE FUNCTION get_overdue_followups_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM leads
    WHERE user_id = p_user_id
      AND follow_up_date IS NOT NULL
      AND follow_up_date < NOW()
      AND status NOT IN ('won', 'lost')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_overdue_followups_count(UUID) TO authenticated;

-- Function to publish scheduled listings (called by cron)
CREATE OR REPLACE FUNCTION publish_scheduled_listings()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  WITH updated AS (
    UPDATE listings
    SET status = 'active', publish_at = NULL
    WHERE status = 'draft'
      AND publish_at IS NOT NULL
      AND publish_at <= NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO updated_count FROM updated;

  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION publish_scheduled_listings() TO service_role;

-- Function to unpublish expired listings (called by cron)
CREATE OR REPLACE FUNCTION unpublish_expired_listings()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  WITH updated AS (
    UPDATE listings
    SET status = 'expired', unpublish_at = NULL
    WHERE status = 'active'
      AND unpublish_at IS NOT NULL
      AND unpublish_at <= NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO updated_count FROM updated;

  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION unpublish_expired_listings() TO service_role;
