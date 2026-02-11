-- Manufacturer Product Catalog
-- Stores manufacturer product lines (specs, images, model info) separate from user/dealer listings

-- Product type enum
DO $$ BEGIN
  CREATE TYPE product_type AS ENUM (
    'lowboy', 'step-deck', 'flatbed', 'rgn', 'double-drop',
    'extendable', 'modular', 'traveling-axle', 'tag-along', 'other'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Gooseneck type enum
DO $$ BEGIN
  CREATE TYPE gooseneck_type AS ENUM (
    'fixed', 'detachable', 'hydraulic-detachable', 'mechanical-detachable',
    'folding', 'non-ground-bearing', 'sliding', 'other'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Main products table
CREATE TABLE IF NOT EXISTS manufacturer_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_id UUID NOT NULL REFERENCES manufacturers(id) ON DELETE CASCADE,

  -- Identity
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  series TEXT,
  model_number TEXT,
  tagline TEXT,
  description TEXT,
  short_description TEXT,

  -- Classification
  product_type product_type DEFAULT 'lowboy',

  -- Key specs (denormalized for filtering)
  tonnage_min INT,
  tonnage_max INT,
  deck_height_inches NUMERIC(5,1),
  deck_length_feet NUMERIC(5,1),
  overall_length_feet NUMERIC(5,1),
  axle_count INT,
  gooseneck_type gooseneck_type,
  empty_weight_lbs INT,
  gvwr_lbs INT,
  concentrated_capacity_lbs INT,

  -- Pricing
  msrp_low INT,
  msrp_high INT,

  -- Scraping metadata
  source_url TEXT,
  last_scraped_at TIMESTAMPTZ,

  -- Full-text search
  search_vector TSVECTOR,

  -- Display
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(manufacturer_id, slug)
);

-- Product images
CREATE TABLE IF NOT EXISTS manufacturer_product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES manufacturer_products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt_text TEXT,
  sort_order INT DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  source_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product specifications (key-value pairs grouped by category)
CREATE TABLE IF NOT EXISTS manufacturer_product_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES manufacturer_products(id) ON DELETE CASCADE,
  spec_category TEXT NOT NULL,
  spec_key TEXT NOT NULL,
  spec_value TEXT NOT NULL,
  spec_unit TEXT,
  sort_order INT DEFAULT 0,

  UNIQUE(product_id, spec_category, spec_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mfr_products_manufacturer ON manufacturer_products(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_mfr_products_slug ON manufacturer_products(slug);
CREATE INDEX IF NOT EXISTS idx_mfr_products_type ON manufacturer_products(product_type);
CREATE INDEX IF NOT EXISTS idx_mfr_products_tonnage ON manufacturer_products(tonnage_min, tonnage_max);
CREATE INDEX IF NOT EXISTS idx_mfr_products_deck_height ON manufacturer_products(deck_height_inches);
CREATE INDEX IF NOT EXISTS idx_mfr_products_axle_count ON manufacturer_products(axle_count);
CREATE INDEX IF NOT EXISTS idx_mfr_products_gooseneck ON manufacturer_products(gooseneck_type);
CREATE INDEX IF NOT EXISTS idx_mfr_products_active ON manufacturer_products(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_mfr_products_search ON manufacturer_products USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_mfr_product_images_product ON manufacturer_product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_mfr_product_specs_product ON manufacturer_product_specs(product_id);

-- RLS
ALTER TABLE manufacturer_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE manufacturer_product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE manufacturer_product_specs ENABLE ROW LEVEL SECURITY;

-- Public read for active products
CREATE POLICY "Active products are viewable by everyone" ON manufacturer_products
  FOR SELECT USING (is_active = true);

CREATE POLICY "Product images are viewable by everyone" ON manufacturer_product_images
  FOR SELECT USING (true);

CREATE POLICY "Product specs are viewable by everyone" ON manufacturer_product_specs
  FOR SELECT USING (true);

-- Service role full access
CREATE POLICY "Service role has full access to products" ON manufacturer_products
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to product images" ON manufacturer_product_images
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to product specs" ON manufacturer_product_specs
  FOR ALL USING (true) WITH CHECK (true);

-- Full-text search trigger
CREATE OR REPLACE FUNCTION update_manufacturer_product_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.series, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.model_number, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C');
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_manufacturer_product_search_vector
  BEFORE INSERT OR UPDATE OF name, series, model_number, description
  ON manufacturer_products
  FOR EACH ROW
  EXECUTE FUNCTION update_manufacturer_product_search_vector();

-- Add product_count column to manufacturers table
ALTER TABLE manufacturers ADD COLUMN IF NOT EXISTS product_count INT DEFAULT 0;

-- Seed missing lowboy/heavy-haul manufacturers
INSERT INTO manufacturers (name, slug, canonical_name, name_variations, equipment_types, country, headquarters, founded_year, short_description, website) VALUES
('Talbert Manufacturing', 'talbert', 'Talbert', ARRAY['talbert mfg', 'talbert trailers'], ARRAY['trailers'], 'USA', 'Rensselaer, Indiana', 1938, 'Inventor of the hydraulic detachable gooseneck trailer. Manufacturer of heavy-capacity lowboy and specialized trailers.', 'https://talbertmfg.com'),
('XL Specialized Trailers', 'xl-specialized', 'XL Specialized', ARRAY['xl specialized', 'xl trailers', 'xl specialized trailers'], ARRAY['trailers'], 'USA', 'Manchester, Iowa', 1978, 'Manufacturer of heavy-haul lowboy trailers featuring ultra-low deck heights and extendable models.', 'https://xlspecializedtrailer.com'),
('Pitts Trailers', 'pitts', 'Pitts', ARRAY['pitts trailers', 'pitts industries'], ARRAY['trailers'], 'USA', 'Pittsview, Alabama', 1988, 'Manufacturer of lowboy trailers with fabricated I-beam construction and PPG automotive-grade paint.', 'https://pittstrailers.com'),
('Eager Beaver Trailers', 'eager-beaver', 'Eager Beaver', ARRAY['eager beaver', 'eagerbeavertrailers'], ARRAY['trailers'], 'USA', 'Parsons, Kansas', 1946, 'Manufacturer of lowboy trailers featuring pierced crossmember design and Cush Air Ride suspension.', 'https://eagerbeavertrailers.com'),
('Kaufman Trailers', 'kaufman', 'Kaufman', ARRAY['kaufman trailers'], ARRAY['trailers'], 'USA', 'Lexington, South Carolina', 1987, 'Factory-direct manufacturer of lowboy and detachable gooseneck trailers with self-aligning V-trough design.', 'https://kaufmantrailers.com'),
('Witzco Challenger', 'witzco', 'Witzco', ARRAY['witzco', 'witzco challenger', 'challenger trailers'], ARRAY['trailers'], 'USA', 'Sanford, Florida', 1977, 'Manufacturer of removable gooseneck and non-ground-bearing lowboy trailers.', 'https://witzco.com'),
('Globe Trailers', 'globe', 'Globe', ARRAY['globe trailers'], ARRAY['trailers'], 'USA', 'Bradenton, Florida', 1958, 'Manufacturer of lowboy trailers with T-1 100K PSI steel construction and patented hydraulic flip axle.', 'https://globetrailers.com'),
('Etnyre Trailers', 'etnyre', 'Etnyre', ARRAY['etnyre', 'blackhawk trailers', 'ed etnyre'], ARRAY['trailers'], 'USA', 'Oregon, Illinois', 1898, 'Manufacturer of Blackhawk lowboy trailers with mechanical and hydraulic gooseneck options up to 110 tons.', 'https://etnyre.com'),
('Landoll Trailers', 'landoll', 'Landoll', ARRAY['landoll', 'landoll trailers'], ARRAY['trailers'], 'USA', 'Marysville, Kansas', 1963, 'Manufacturer of traveling axle trailers and extendable detachable gooseneck lowboys.', 'https://landoll.com'),
('Faymonville', 'faymonville', 'Faymonville', ARRAY['faymonville', 'max trailer', 'faymonville group'], ARRAY['trailers'], 'Belgium', 'Lentzweiler, Belgium', 1958, 'Global leader in special transport vehicles with modular heavy-haul systems up to 5,000 tonnes.', 'https://www.maxtrailer.us'),
('Loadstar Trailers', 'loadstar', 'Loadstar', ARRAY['loadstar', 'loadstar trailers'], ARRAY['trailers'], 'Canada', 'Cobourg, Ontario', 1985, 'Custom heavy-haul lowboy and step deck trailer manufacturer with 100 ksi single-piece steel rails.', 'https://loadstartrailers.com')
ON CONFLICT (slug) DO NOTHING;
