-- Hale Trailer Features Migration
-- Adds additional categories found on haletrailer.com

-- ============================================
-- 1. ADD MISSING CATEGORIES FROM HALE TRAILER
-- ============================================

DO $$
DECLARE
  trucks_id UUID;
  trailers_id UUID;
  equipment_id UUID;
BEGIN
  -- Get parent category IDs by slug
  SELECT id INTO trucks_id FROM categories WHERE slug = 'trucks' LIMIT 1;
  SELECT id INTO trailers_id FROM categories WHERE slug = 'trailers' LIMIT 1;
  SELECT id INTO equipment_id FROM categories WHERE slug = 'heavy-equipment' LIMIT 1;

  -- Insert Yard Tractors under Trucks (terminal tractors/spotter trucks)
  IF trucks_id IS NOT NULL THEN
    INSERT INTO categories (name, slug, parent_id, sort_order) VALUES
      ('Yard Tractors', 'yard-tractors', trucks_id, 13),
      ('Terminal Tractors', 'terminal-tractors', trucks_id, 14)
    ON CONFLICT (slug) DO NOTHING;
  END IF;

  -- Insert additional trailer categories
  IF trailers_id IS NOT NULL THEN
    INSERT INTO categories (name, slug, parent_id, sort_order) VALUES
      ('Office Trailers', 'office-trailers', trailers_id, 28),
      ('Storage Containers', 'storage-containers', trailers_id, 29),
      ('Steerable Trailers', 'steerable-trailers', trailers_id, 30),
      ('Tipper Trailers', 'tipper-trailers', trailers_id, 31),
      ('Intermodal Chassis', 'intermodal-chassis', trailers_id, 32),
      ('Container Chassis', 'container-chassis', trailers_id, 33),
      ('Extendable Chassis', 'extendable-chassis', trailers_id, 34),
      ('Gooseneck Trailers', 'gooseneck-trailers', trailers_id, 35)
    ON CONFLICT (slug) DO NOTHING;
  END IF;

  -- Insert additional equipment categories
  IF equipment_id IS NOT NULL THEN
    INSERT INTO categories (name, slug, parent_id, sort_order) VALUES
      ('Yard Spotters', 'yard-spotters', equipment_id, 23),
      ('Container Handlers', 'container-handlers', equipment_id, 24),
      ('Reach Stackers', 'reach-stackers', equipment_id, 25)
    ON CONFLICT (slug) DO NOTHING;
  END IF;
END $$;


-- ============================================
-- 2. ADD AXLE CONFIGURATION FIELDS TO LISTINGS
-- ============================================

-- Add axle-related fields for weight distribution calculations
ALTER TABLE listings ADD COLUMN IF NOT EXISTS axle_count INT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS axle_configuration TEXT; -- e.g., "6x4", "8x6", "tandem", "tridem"
ALTER TABLE listings ADD COLUMN IF NOT EXISTS gvwr DECIMAL(10,2); -- Gross Vehicle Weight Rating
ALTER TABLE listings ADD COLUMN IF NOT EXISTS gawr_front DECIMAL(10,2); -- Gross Axle Weight Rating - Front
ALTER TABLE listings ADD COLUMN IF NOT EXISTS gawr_rear DECIMAL(10,2); -- Gross Axle Weight Rating - Rear
ALTER TABLE listings ADD COLUMN IF NOT EXISTS payload_capacity DECIMAL(10,2);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS kingpin_weight DECIMAL(10,2);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS wheelbase INT; -- in inches

-- Add comments for documentation
COMMENT ON COLUMN listings.axle_count IS 'Number of axles on the unit';
COMMENT ON COLUMN listings.axle_configuration IS 'Axle configuration like 6x4, 8x6, tandem, tridem';
COMMENT ON COLUMN listings.gvwr IS 'Gross Vehicle Weight Rating in lbs';
COMMENT ON COLUMN listings.gawr_front IS 'Gross Axle Weight Rating for front axle(s) in lbs';
COMMENT ON COLUMN listings.gawr_rear IS 'Gross Axle Weight Rating for rear axle(s) in lbs';
COMMENT ON COLUMN listings.payload_capacity IS 'Maximum payload capacity in lbs';
COMMENT ON COLUMN listings.kingpin_weight IS 'Weight at kingpin for trailers in lbs';
COMMENT ON COLUMN listings.wheelbase IS 'Wheelbase measurement in inches';

-- Add index for filtering by axle configuration
CREATE INDEX IF NOT EXISTS idx_listings_axle_config ON listings(axle_configuration);
CREATE INDEX IF NOT EXISTS idx_listings_payload ON listings(payload_capacity);


-- ============================================
-- 3. CREATE SAVED WEIGHT CALCULATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS weight_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT,

  -- Truck/Tractor specs
  truck_make TEXT,
  truck_model TEXT,
  truck_empty_weight DECIMAL(10,2),
  truck_steer_axle_weight DECIMAL(10,2),
  truck_drive_axle_weight DECIMAL(10,2),
  truck_wheelbase INT,

  -- Trailer specs
  trailer_type TEXT,
  trailer_empty_weight DECIMAL(10,2),
  trailer_length INT,
  trailer_axle_spread INT,

  -- Load specs
  cargo_weight DECIMAL(10,2),
  cargo_position DECIMAL(5,2), -- percentage from front of trailer

  -- Calculated results
  calculated_steer_axle DECIMAL(10,2),
  calculated_drive_axle DECIMAL(10,2),
  calculated_trailer_axle DECIMAL(10,2),
  total_weight DECIMAL(10,2),
  is_legal BOOLEAN,
  violations JSONB DEFAULT '[]', -- array of weight limit violations

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_weight_calc_user ON weight_calculations(user_id);


-- ============================================
-- 4. ADD POPULAR MANUFACTURER DATA
-- ============================================

-- Create manufacturers table for autocomplete and filtering
CREATE TABLE IF NOT EXISTS manufacturers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  category_type TEXT NOT NULL, -- 'truck', 'trailer', 'equipment'
  logo_url TEXT,
  website TEXT,
  sort_order INT DEFAULT 0,
  is_popular BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed popular truck manufacturers
INSERT INTO manufacturers (name, slug, category_type, is_popular, sort_order) VALUES
  ('Peterbilt', 'peterbilt', 'truck', true, 1),
  ('Kenworth', 'kenworth', 'truck', true, 2),
  ('Freightliner', 'freightliner', 'truck', true, 3),
  ('Volvo', 'volvo', 'truck', true, 4),
  ('International', 'international', 'truck', true, 5),
  ('Mack', 'mack', 'truck', true, 6),
  ('Western Star', 'western-star', 'truck', true, 7),
  ('Navistar', 'navistar', 'truck', false, 8),
  ('Hino', 'hino', 'truck', false, 9),
  ('Isuzu', 'isuzu', 'truck', false, 10)
ON CONFLICT (slug) DO NOTHING;

-- Seed popular trailer manufacturers (from Hale Trailer)
INSERT INTO manufacturers (name, slug, category_type, is_popular, sort_order) VALUES
  ('Great Dane', 'great-dane', 'trailer', true, 1),
  ('Wabash', 'wabash', 'trailer', true, 2),
  ('Utility', 'utility', 'trailer', true, 3),
  ('Vanguard', 'vanguard', 'trailer', true, 4),
  ('Hyundai Translead', 'hyundai-translead', 'trailer', true, 5),
  ('Stoughton', 'stoughton', 'trailer', true, 6),
  ('Fontaine', 'fontaine', 'trailer', true, 7),
  ('MAC Trailer', 'mac-trailer', 'trailer', true, 8),
  ('Travis', 'travis', 'trailer', false, 9),
  ('East Manufacturing', 'east', 'trailer', false, 10),
  ('Dorsey', 'dorsey', 'trailer', false, 11),
  ('CIMC', 'cimc', 'trailer', false, 12),
  ('Talbert', 'talbert', 'trailer', false, 13),
  ('Trail King', 'trail-king', 'trailer', false, 14),
  ('XL Specialized', 'xl-specialized', 'trailer', false, 15),
  ('Manac', 'manac', 'trailer', false, 16),
  ('Kentucky', 'kentucky', 'trailer', false, 17),
  ('Polar Tank', 'polar-tank', 'trailer', false, 18),
  ('Wilson', 'wilson', 'trailer', false, 19),
  ('Benson', 'benson', 'trailer', false, 20)
ON CONFLICT (slug) DO NOTHING;

-- Seed popular equipment manufacturers
INSERT INTO manufacturers (name, slug, category_type, is_popular, sort_order) VALUES
  ('Caterpillar', 'caterpillar', 'equipment', true, 1),
  ('John Deere', 'john-deere', 'equipment', true, 2),
  ('Komatsu', 'komatsu', 'equipment', true, 3),
  ('Hitachi', 'hitachi', 'equipment', true, 4),
  ('Bobcat', 'bobcat', 'equipment', true, 5),
  ('Case', 'case', 'equipment', true, 6),
  ('JCB', 'jcb', 'equipment', true, 7),
  ('Kubota', 'kubota', 'equipment', false, 8),
  ('Liebherr', 'liebherr', 'equipment', false, 9),
  ('Volvo CE', 'volvo-ce', 'equipment', false, 10)
ON CONFLICT (slug) DO NOTHING;

-- Seed yard tractor manufacturers
INSERT INTO manufacturers (name, slug, category_type, is_popular, sort_order) VALUES
  ('Capacity', 'capacity', 'yard_tractor', true, 1),
  ('Kalmar', 'kalmar', 'yard_tractor', true, 2),
  ('Ottawa', 'ottawa', 'yard_tractor', true, 3),
  ('Autocar', 'autocar', 'yard_tractor', false, 4),
  ('TICO', 'tico', 'yard_tractor', false, 5)
ON CONFLICT (slug) DO NOTHING;

-- Add index for manufacturer lookups
CREATE INDEX IF NOT EXISTS idx_manufacturers_category ON manufacturers(category_type);
CREATE INDEX IF NOT EXISTS idx_manufacturers_popular ON manufacturers(is_popular) WHERE is_popular = true;
