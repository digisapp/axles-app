-- Manufacturers Directory
-- Curated manufacturer information with monetization tiers

CREATE TABLE IF NOT EXISTS manufacturers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic Info
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  description TEXT,
  short_description TEXT,
  website TEXT,

  -- Business Details
  country TEXT DEFAULT 'USA',
  headquarters TEXT,
  founded_year INT,

  -- Equipment Types (array of what they manufacture)
  equipment_types TEXT[] DEFAULT '{}',

  -- Monetization
  is_featured BOOLEAN DEFAULT false,
  feature_tier TEXT DEFAULT 'free' CHECK (feature_tier IN ('free', 'featured', 'premium')),
  feature_expires_at TIMESTAMPTZ,

  -- Linking to listings
  canonical_name TEXT NOT NULL,
  name_variations TEXT[] DEFAULT '{}',

  -- Cached stats (updated via cron or trigger)
  listing_count INT DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_manufacturers_slug ON manufacturers(slug);
CREATE INDEX IF NOT EXISTS idx_manufacturers_canonical_name ON manufacturers(canonical_name);
CREATE INDEX IF NOT EXISTS idx_manufacturers_featured ON manufacturers(is_featured, feature_tier);
CREATE INDEX IF NOT EXISTS idx_manufacturers_equipment_types ON manufacturers USING GIN(equipment_types);
CREATE INDEX IF NOT EXISTS idx_manufacturers_active ON manufacturers(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE manufacturers ENABLE ROW LEVEL SECURITY;

-- Anyone can read active manufacturers
CREATE POLICY "Active manufacturers are viewable by everyone" ON manufacturers
  FOR SELECT USING (is_active = true);

-- Service role can do everything (for admin operations)
CREATE POLICY "Service role has full access" ON manufacturers
  FOR ALL USING (true) WITH CHECK (true);

-- Seed initial manufacturers
INSERT INTO manufacturers (name, slug, canonical_name, name_variations, equipment_types, country, headquarters, founded_year, short_description, website) VALUES
-- Truck Manufacturers
('Peterbilt', 'peterbilt', 'Peterbilt', ARRAY['pete', 'peterbuilt', 'peter bilt'], ARRAY['trucks'], 'USA', 'Denton, Texas', 1939, 'American manufacturer of medium and heavy-duty Class 5 through Class 8 trucks.', 'https://www.peterbilt.com'),
('Freightliner', 'freightliner', 'Freightliner', ARRAY['freight liner', 'freight-liner'], ARRAY['trucks'], 'USA', 'Portland, Oregon', 1942, 'Leading manufacturer of heavy-duty diesel trucks in North America.', 'https://freightliner.com'),
('Kenworth', 'kenworth', 'Kenworth', ARRAY['kw', 'ken worth'], ARRAY['trucks'], 'USA', 'Kirkland, Washington', 1923, 'American manufacturer of medium and heavy-duty Class 8 trucks.', 'https://www.kenworth.com'),
('Volvo Trucks', 'volvo', 'Volvo', ARRAY['volvo trucks'], ARRAY['trucks'], 'Sweden', 'Gothenburg, Sweden', 1928, 'Global manufacturer of trucks, buses, and construction equipment.', 'https://www.volvotrucks.com'),
('Mack Trucks', 'mack', 'Mack', ARRAY['mack trucks'], ARRAY['trucks'], 'USA', 'Greensboro, North Carolina', 1900, 'American truck manufacturing company known for heavy-duty vehicles.', 'https://www.macktrucks.com'),
('International', 'international', 'International', ARRAY['international trucks', 'navistar'], ARRAY['trucks'], 'USA', 'Lisle, Illinois', 1902, 'American manufacturer of commercial trucks and buses.', 'https://www.internationaltrucks.com'),
('Western Star', 'western-star', 'Western Star', ARRAY['westernstar', 'western-star trucks'], ARRAY['trucks'], 'USA', 'Portland, Oregon', 1967, 'American truck manufacturer specializing in heavy-duty trucks.', 'https://www.westernstartrucks.com'),

-- Trailer Manufacturers
('Great Dane', 'great-dane', 'Great Dane', ARRAY['greatdane', 'great dane trailers'], ARRAY['trailers'], 'USA', 'Savannah, Georgia', 1900, 'Leading manufacturer of truck trailers for transportation and logistics.', 'https://www.greatdane.com'),
('Wabash National', 'wabash', 'Wabash', ARRAY['wabash national', 'wabash trailers'], ARRAY['trailers'], 'USA', 'Lafayette, Indiana', 1985, 'Diversified industrial company and one of America''s largest trailer manufacturers.', 'https://www.wabashnational.com'),
('Utility Trailer', 'utility', 'Utility', ARRAY['utility trailers', 'utility trailer manufacturing'], ARRAY['trailers'], 'USA', 'City of Industry, California', 1914, 'Leading manufacturer of refrigerated trailers and dry freight vans.', 'https://www.utilitytrailer.com'),
('Vanguard National', 'vanguard', 'Vanguard', ARRAY['vanguard trailers', 'vanguard national trailer'], ARRAY['trailers'], 'USA', 'Monon, Indiana', 1988, 'Manufacturer of dry van and refrigerated trailers.', 'https://www.vanguardnational.com'),
('Fontaine Trailer', 'fontaine', 'Fontaine', ARRAY['fontaine trailers'], ARRAY['trailers'], 'USA', 'Jasper, Alabama', 1945, 'Leading manufacturer of flatbed and specialized trailers.', 'https://www.fontainetrailer.com'),
('Trail King', 'trail-king', 'Trail King', ARRAY['trailking', 'trail king trailers'], ARRAY['trailers'], 'USA', 'Mitchell, South Dakota', 1974, 'Manufacturer of construction, commercial, and specialized trailers.', 'https://www.trailking.com'),
('Wilson Trailer', 'wilson', 'Wilson', ARRAY['wilson trailers'], ARRAY['trailers'], 'USA', 'Sioux City, Iowa', 1890, 'Manufacturer of livestock, grain, and flatbed trailers.', 'https://www.wilsontrailer.com'),
('MAC Trailer', 'mac-trailer', 'MAC', ARRAY['mac trailers', 'mac trailer manufacturing'], ARRAY['trailers'], 'USA', 'Alliance, Ohio', 1990, 'Manufacturer of dump trailers, flatbeds, and dry bulk trailers.', 'https://www.mactrailer.com'),

-- Heavy Equipment Manufacturers
('Caterpillar', 'caterpillar', 'Caterpillar', ARRAY['cat', 'caterpiller'], ARRAY['heavy-equipment'], 'USA', 'Deerfield, Illinois', 1925, 'World''s largest construction equipment manufacturer.', 'https://www.caterpillar.com'),
('John Deere', 'john-deere', 'John Deere', ARRAY['deere', 'johndeere'], ARRAY['heavy-equipment'], 'USA', 'Moline, Illinois', 1837, 'American manufacturer of agricultural and construction machinery.', 'https://www.deere.com'),
('Komatsu', 'komatsu', 'Komatsu', ARRAY['komatsu equipment'], ARRAY['heavy-equipment'], 'Japan', 'Tokyo, Japan', 1921, 'Japanese multinational heavy equipment manufacturer.', 'https://www.komatsu.com'),
('Volvo CE', 'volvo-ce', 'Volvo CE', ARRAY['volvo construction', 'volvo equipment'], ARRAY['heavy-equipment'], 'Sweden', 'Gothenburg, Sweden', 1832, 'Global manufacturer of construction equipment and services.', 'https://www.volvoce.com'),
('Hitachi', 'hitachi', 'Hitachi', ARRAY['hitachi construction'], ARRAY['heavy-equipment'], 'Japan', 'Tokyo, Japan', 1910, 'Japanese multinational manufacturer of construction machinery.', 'https://www.hitachicm.com')
ON CONFLICT (slug) DO NOTHING;
