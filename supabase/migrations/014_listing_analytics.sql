-- Migration: Add analytics tracking tables
-- This enables real-time view tracking and analytics

-- Listing views table - tracks individual page views
CREATE TABLE IF NOT EXISTS listing_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id TEXT, -- For anonymous user tracking
  ip_hash TEXT, -- Hashed IP for deduplication (privacy-safe)
  user_agent TEXT,
  referrer TEXT,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent duplicate views from same session on same day (unique index with expression)
CREATE UNIQUE INDEX idx_unique_view_session
  ON listing_views(listing_id, session_id, (viewed_at::date))
  WHERE session_id IS NOT NULL;

-- Indexes for efficient queries
CREATE INDEX idx_listing_views_listing_id ON listing_views(listing_id);
CREATE INDEX idx_listing_views_viewed_at ON listing_views(viewed_at);
CREATE INDEX idx_listing_views_listing_date ON listing_views(listing_id, viewed_at);

-- RLS policies
ALTER TABLE listing_views ENABLE ROW LEVEL SECURITY;

-- Anyone can insert views (for tracking)
CREATE POLICY "Anyone can log views" ON listing_views
  FOR INSERT TO authenticated, anon
  WITH CHECK (true);

-- Users can only read views for their own listings
CREATE POLICY "Users can read views for their listings" ON listing_views
  FOR SELECT TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings WHERE user_id = auth.uid()
    )
  );

-- Lead events table - tracks lead funnel events
CREATE TABLE IF NOT EXISTS lead_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'created', 'contacted', 'qualified', 'won', 'lost'
  previous_status TEXT,
  new_status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX idx_lead_events_lead_id ON lead_events(lead_id);
CREATE INDEX idx_lead_events_created_at ON lead_events(created_at);

ALTER TABLE lead_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their lead events" ON lead_events
  FOR ALL TO authenticated
  USING (
    lead_id IN (
      SELECT id FROM leads WHERE user_id = auth.uid()
    )
  );

-- Function to get daily view counts for a user's listings
CREATE OR REPLACE FUNCTION get_user_daily_views(
  p_user_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  view_date DATE,
  view_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(lv.viewed_at) as view_date,
    COUNT(*) as view_count
  FROM listing_views lv
  JOIN listings l ON l.id = lv.listing_id
  WHERE l.user_id = p_user_id
    AND lv.viewed_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY DATE(lv.viewed_at)
  ORDER BY view_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get daily lead counts for a user
CREATE OR REPLACE FUNCTION get_user_daily_leads(
  p_user_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  lead_date DATE,
  lead_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(created_at) as lead_date,
    COUNT(*) as lead_count
  FROM leads
  WHERE user_id = p_user_id
    AND created_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY DATE(created_at)
  ORDER BY lead_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get view stats with period comparison
CREATE OR REPLACE FUNCTION get_user_view_stats(
  p_user_id UUID,
  p_period_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  current_period_views BIGINT,
  previous_period_views BIGINT,
  trend_percentage NUMERIC
) AS $$
DECLARE
  current_views BIGINT;
  previous_views BIGINT;
BEGIN
  -- Current period views
  SELECT COUNT(*) INTO current_views
  FROM listing_views lv
  JOIN listings l ON l.id = lv.listing_id
  WHERE l.user_id = p_user_id
    AND lv.viewed_at >= NOW() - (p_period_days || ' days')::INTERVAL;

  -- Previous period views
  SELECT COUNT(*) INTO previous_views
  FROM listing_views lv
  JOIN listings l ON l.id = lv.listing_id
  WHERE l.user_id = p_user_id
    AND lv.viewed_at >= NOW() - (p_period_days * 2 || ' days')::INTERVAL
    AND lv.viewed_at < NOW() - (p_period_days || ' days')::INTERVAL;

  RETURN QUERY SELECT
    current_views,
    previous_views,
    CASE
      WHEN previous_views > 0 THEN
        ROUND(((current_views - previous_views)::NUMERIC / previous_views) * 100, 1)
      ELSE 0
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get lead stats with period comparison
CREATE OR REPLACE FUNCTION get_user_lead_stats(
  p_user_id UUID,
  p_period_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  current_period_leads BIGINT,
  previous_period_leads BIGINT,
  trend_percentage NUMERIC
) AS $$
DECLARE
  current_leads BIGINT;
  previous_leads BIGINT;
BEGIN
  -- Current period leads
  SELECT COUNT(*) INTO current_leads
  FROM leads
  WHERE user_id = p_user_id
    AND created_at >= NOW() - (p_period_days || ' days')::INTERVAL;

  -- Previous period leads
  SELECT COUNT(*) INTO previous_leads
  FROM leads
  WHERE user_id = p_user_id
    AND created_at >= NOW() - (p_period_days * 2 || ' days')::INTERVAL
    AND created_at < NOW() - (p_period_days || ' days')::INTERVAL;

  RETURN QUERY SELECT
    current_leads,
    previous_leads,
    CASE
      WHEN previous_leads > 0 THEN
        ROUND(((current_leads - previous_leads)::NUMERIC / previous_leads) * 100, 1)
      ELSE 0
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
