-- Saved Searches for Alerts
CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  query TEXT, -- Search query text
  filters JSONB DEFAULT '{}', -- Category, price range, year, make, model, location, etc.
  notify_email BOOLEAN DEFAULT true,
  notify_frequency TEXT DEFAULT 'daily' CHECK (notify_frequency IN ('instant', 'daily', 'weekly')),
  last_notified_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  new_matches_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_notify ON saved_searches(notify_email, notify_frequency) WHERE notify_email = true;

-- RLS
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

-- Users can only see their own saved searches
CREATE POLICY "Users can view own saved searches" ON saved_searches
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create saved searches" ON saved_searches
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own saved searches" ON saved_searches
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved searches" ON saved_searches
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER trigger_saved_searches_updated_at
  BEFORE UPDATE ON saved_searches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Comments
COMMENT ON TABLE saved_searches IS 'User saved searches for email alerts when new listings match';
COMMENT ON COLUMN saved_searches.filters IS 'JSON with filter criteria: { category_id, min_price, max_price, min_year, max_year, make, model, state, condition }';
COMMENT ON COLUMN saved_searches.notify_frequency IS 'How often to send alerts: instant (per listing), daily (digest), weekly (digest)';
