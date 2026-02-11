-- Migration 030: Schema fixes from audit
-- Adds missing RLS policies, foreign keys, indexes, and constraints

-- 1. Add RLS policies to search_history
CREATE POLICY "Users can view own search history" ON search_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own search history" ON search_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own search history" ON search_history
  FOR DELETE USING (auth.uid() = user_id);

-- 2. Add missing foreign key constraint
DO $$ BEGIN
  ALTER TABLE search_history
    ADD CONSTRAINT fk_search_history_listing
    FOREIGN KEY (clicked_listing_id)
    REFERENCES listings(id)
    ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 3. Add missing indexes on foreign keys
CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_listing ON favorites(listing_id);
CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_search_history_listing ON search_history(clicked_listing_id);
CREATE INDEX IF NOT EXISTS idx_messages_listing ON messages(listing_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);

-- 4. Add sorting/filtering indexes for manufacturer products
CREATE INDEX IF NOT EXISTS idx_mfr_products_name ON manufacturer_products(name);
CREATE INDEX IF NOT EXISTS idx_mfr_products_created_at ON manufacturer_products(created_at DESC);

-- 5. Add CHECK constraints for numeric ranges
DO $$ BEGIN
  ALTER TABLE listings ADD CONSTRAINT check_price CHECK (price >= 0);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE listings ADD CONSTRAINT check_mileage CHECK (mileage >= 0);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE listings ADD CONSTRAINT check_hours CHECK (hours >= 0);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE listings ADD CONSTRAINT check_year CHECK (year > 1900 AND year <= 2028);
EXCEPTION WHEN duplicate_object THEN null;
END $$;
