-- Pinnacle Features Migration
-- Adds missing trailer categories, industry tags, rental support, and trade-in requests

-- ============================================
-- 1. ADD MISSING TRAILER CATEGORIES
-- ============================================

-- Use DO block to look up actual parent category IDs
DO $$
DECLARE
  trailers_id UUID;
  equipment_id UUID;
BEGIN
  -- Get the actual Trailers parent category ID
  SELECT id INTO trailers_id FROM categories WHERE slug = 'trailers' LIMIT 1;

  -- Get the actual Heavy Equipment parent category ID
  SELECT id INTO equipment_id FROM categories WHERE slug = 'heavy-equipment' LIMIT 1;

  -- Insert trailer subcategories if parent exists
  IF trailers_id IS NOT NULL THEN
    INSERT INTO categories (name, slug, parent_id, sort_order) VALUES
      ('End Dump Trailers', 'end-dump-trailers', trailers_id, 14),
      ('Side Dump Trailers', 'side-dump-trailers', trailers_id, 15),
      ('Pneumatic / Bulk Trailers', 'pneumatic-trailers', trailers_id, 16),
      ('Chip / Chipper Trailers', 'chip-trailers', trailers_id, 17),
      ('Live Floor / Walking Floor Trailers', 'live-floor-trailers', trailers_id, 18),
      ('Belt Trailers', 'belt-trailers', trailers_id, 19),
      ('Log Trailers', 'log-trailers', trailers_id, 20),
      ('Open Top Trailers', 'open-top-trailers', trailers_id, 21),
      ('Refuse / Trash Trailers', 'refuse-trailers', trailers_id, 22),
      ('Traveling Axle Trailers', 'traveling-axle-trailers', trailers_id, 23),
      ('Curtainside / Tautliner Trailers', 'curtainside-trailers', trailers_id, 24),
      ('Double Drop Trailers', 'double-drop-trailers', trailers_id, 25),
      ('Step Deck Trailers', 'step-deck-trailers', trailers_id, 26),
      ('Extendable Trailers', 'extendable-trailers', trailers_id, 27),
      ('Specialty / Other Trailers', 'specialty-trailers', trailers_id, 99)
    ON CONFLICT (slug) DO NOTHING;
  END IF;

  -- Insert equipment subcategories if parent exists
  IF equipment_id IS NOT NULL THEN
    INSERT INTO categories (name, slug, parent_id, sort_order) VALUES
      ('Telehandlers', 'telehandlers', equipment_id, 14),
      ('Trenchers', 'trenchers', equipment_id, 15),
      ('Pavers', 'pavers', equipment_id, 16),
      ('Crushers', 'crushers', equipment_id, 17),
      ('Screeners', 'screeners', equipment_id, 18),
      ('Conveyors', 'conveyors', equipment_id, 19),
      ('Dozers', 'dozers', equipment_id, 20),
      ('Track Loaders', 'track-loaders', equipment_id, 21),
      ('Mini Excavators', 'mini-excavators', equipment_id, 22),
      ('Specialty Equipment', 'specialty-equipment', equipment_id, 99)
    ON CONFLICT (slug) DO NOTHING;
  END IF;
END $$;


-- ============================================
-- 2. ADD INDUSTRY TAGS SYSTEM
-- ============================================

-- Create industries table
CREATE TABLE IF NOT EXISTS industries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  description TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed industries
INSERT INTO industries (name, slug, icon, description, sort_order) VALUES
  ('Agriculture', 'agriculture', 'wheat', 'Farming, ranching, and agricultural operations', 1),
  ('Construction', 'construction', 'building', 'Building, roadwork, and site development', 2),
  ('Forestry & Logging', 'forestry', 'trees', 'Timber harvesting and forest management', 3),
  ('Heavy Haul', 'heavy-haul', 'container', 'Oversized and overweight freight transport', 4),
  ('Waste & Recycling', 'waste-recycling', 'recycle', 'Trash collection and recycling operations', 5),
  ('Intermodal', 'intermodal', 'ship', 'Container shipping and port operations', 6),
  ('Oil & Gas', 'oil-gas', 'fuel', 'Energy sector and oilfield services', 7),
  ('Mining', 'mining', 'pickaxe', 'Mineral extraction and quarry operations', 8),
  ('Food & Beverage', 'food-beverage', 'utensils', 'Food transport and cold chain logistics', 9),
  ('General Freight', 'general-freight', 'truck', 'Standard commercial hauling', 10),
  ('Landscaping', 'landscaping', 'flower', 'Lawn care and landscape services', 11),
  ('Utilities', 'utilities', 'zap', 'Power, water, and infrastructure services', 12)
ON CONFLICT (slug) DO NOTHING;

-- Create junction table for listing industries (many-to-many)
CREATE TABLE IF NOT EXISTS listing_industries (
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  industry_id UUID REFERENCES industries(id) ON DELETE CASCADE,
  PRIMARY KEY (listing_id, industry_id)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_listing_industries_listing ON listing_industries(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_industries_industry ON listing_industries(industry_id);


-- ============================================
-- 3. ADD RENTAL SUPPORT
-- ============================================

-- Add listing_type column to support sales vs rentals
ALTER TABLE listings ADD COLUMN IF NOT EXISTS listing_type TEXT DEFAULT 'sale';

-- Add constraint for valid listing types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'listings_listing_type_check'
  ) THEN
    ALTER TABLE listings ADD CONSTRAINT listings_listing_type_check
      CHECK (listing_type IN ('sale', 'rent', 'sale_or_rent'));
  END IF;
END $$;

-- Add rental-specific fields
ALTER TABLE listings ADD COLUMN IF NOT EXISTS rental_rate_daily DECIMAL(10,2);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS rental_rate_weekly DECIMAL(10,2);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS rental_rate_monthly DECIMAL(10,2);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS rental_minimum_days INT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS rental_deposit DECIMAL(10,2);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS rental_available_from DATE;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS rental_available_to DATE;

-- Add index for rental listings
CREATE INDEX IF NOT EXISTS idx_listings_listing_type ON listings(listing_type);
CREATE INDEX IF NOT EXISTS idx_listings_rentals ON listings(listing_type, rental_rate_daily)
  WHERE listing_type IN ('rent', 'sale_or_rent');

-- Add comments
COMMENT ON COLUMN listings.listing_type IS 'Type of listing: sale, rent, or sale_or_rent';
COMMENT ON COLUMN listings.rental_rate_daily IS 'Daily rental rate in USD';
COMMENT ON COLUMN listings.rental_rate_weekly IS 'Weekly rental rate in USD';
COMMENT ON COLUMN listings.rental_rate_monthly IS 'Monthly rental rate in USD';


-- ============================================
-- 4. CREATE TRADE-IN REQUESTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS trade_in_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User info (can be anonymous or logged in)
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,

  -- Equipment being traded in
  equipment_year INT,
  equipment_make TEXT NOT NULL,
  equipment_model TEXT NOT NULL,
  equipment_vin TEXT,
  equipment_mileage INT,
  equipment_hours INT,
  equipment_condition TEXT, -- excellent, good, fair, poor
  equipment_description TEXT,

  -- Photos (stored as JSON array of URLs)
  photos JSONB DEFAULT '[]',

  -- What they're interested in (optional)
  interested_listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  interested_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  purchase_timeline TEXT, -- immediate, 1-2_weeks, 1_month, just_browsing

  -- Dealer assignment
  assigned_dealer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Valuation (filled by dealer)
  estimated_value DECIMAL(12,2),
  valuation_notes TEXT,

  -- Status tracking
  status TEXT DEFAULT 'pending', -- pending, reviewing, valued, accepted, rejected, expired

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  valued_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ
);

-- Indexes for trade-in requests
CREATE INDEX IF NOT EXISTS idx_trade_in_status ON trade_in_requests(status);
CREATE INDEX IF NOT EXISTS idx_trade_in_user ON trade_in_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_trade_in_dealer ON trade_in_requests(assigned_dealer_id);
CREATE INDEX IF NOT EXISTS idx_trade_in_created ON trade_in_requests(created_at DESC);

-- Add RLS policies for trade-in requests
ALTER TABLE trade_in_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own trade-in requests
CREATE POLICY "Users can view own trade-ins" ON trade_in_requests
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create trade-in requests
CREATE POLICY "Users can create trade-ins" ON trade_in_requests
  FOR INSERT WITH CHECK (true);

-- Dealers can view trade-ins assigned to them
CREATE POLICY "Dealers can view assigned trade-ins" ON trade_in_requests
  FOR SELECT USING (auth.uid() = assigned_dealer_id);

-- Dealers can update trade-ins assigned to them
CREATE POLICY "Dealers can update assigned trade-ins" ON trade_in_requests
  FOR UPDATE USING (auth.uid() = assigned_dealer_id);

-- Admins can do everything (using service role)

-- Add comments
COMMENT ON TABLE trade_in_requests IS 'Trade-in/buyback requests from customers';
COMMENT ON COLUMN trade_in_requests.status IS 'pending, reviewing, valued, accepted, rejected, expired';
COMMENT ON COLUMN trade_in_requests.purchase_timeline IS 'immediate, 1-2_weeks, 1_month, just_browsing';
