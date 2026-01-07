-- Expanded Categories for better trailer/truck categorization
-- Based on TruckPaper's category structure

-- Get parent category IDs
DO $$
DECLARE
  trucks_id UUID;
  trailers_id UUID;
BEGIN
  SELECT id INTO trucks_id FROM categories WHERE slug = 'trucks' LIMIT 1;
  SELECT id INTO trailers_id FROM categories WHERE slug = 'trailers' LIMIT 1;

  -- ============================================
  -- Additional Truck Subcategories
  -- ============================================

  INSERT INTO categories (name, slug, parent_id, sort_order) VALUES
    ('Yard Spotter Trucks', 'yard-spotter-trucks', trucks_id, 15),
    ('RV Haulers / Toters', 'rv-hauler-trucks', trucks_id, 16),
    ('Hot Shot Trucks', 'hot-shot-trucks', trucks_id, 17),
    ('Rollback Trucks', 'rollback-trucks', trucks_id, 18),
    ('Wrecker Trucks', 'wrecker-trucks', trucks_id, 19),
    ('Service / Utility Trucks', 'service-trucks', trucks_id, 20),
    ('Bucket Trucks', 'bucket-trucks', trucks_id, 21),
    ('Boom Trucks', 'boom-trucks', trucks_id, 22),
    ('Vacuum Trucks', 'vacuum-trucks', trucks_id, 23),
    ('Water Trucks', 'water-trucks', trucks_id, 24),
    ('Fuel / Lube Trucks', 'fuel-trucks', trucks_id, 25),
    ('Winch / Oil Field Trucks', 'winch-trucks', trucks_id, 26),
    ('Cab & Chassis', 'cab-chassis', trucks_id, 27)
  ON CONFLICT (slug) DO NOTHING;

  -- ============================================
  -- Additional Trailer Subcategories
  -- ============================================

  INSERT INTO categories (name, slug, parent_id, sort_order) VALUES
    -- Step/Drop types
    ('Step Deck Trailers', 'step-deck-trailers', trailers_id, 14),
    ('Double Drop Trailers', 'double-drop-trailers', trailers_id, 15),

    -- Dump types
    ('End Dump Trailers', 'end-dump-trailers', trailers_id, 16),
    ('Side Dump Trailers', 'side-dump-trailers', trailers_id, 17),
    ('Bottom Dump Trailers', 'bottom-dump-trailers', trailers_id, 18),
    ('Belt Trailers', 'belt-trailers', trailers_id, 19),

    -- Specialized hauling
    ('Live Floor Trailers', 'live-floor-trailers', trailers_id, 20),
    ('Chip Trailers', 'chip-trailers', trailers_id, 21),
    ('Log Trailers', 'log-trailers', trailers_id, 22),
    ('Traveling Axle Trailers', 'traveling-axle-trailers', trailers_id, 23),
    ('Tag Trailers', 'tag-trailers', trailers_id, 24),
    ('Pole Trailers', 'pole-trailers', trailers_id, 25),

    -- Van types
    ('Curtain Side Trailers', 'curtain-side-trailers', trailers_id, 26),
    ('Drop Frame Van Trailers', 'drop-frame-trailers', trailers_id, 27),

    -- Tank types
    ('Pneumatic Trailers', 'pneumatic-trailers', trailers_id, 28),
    ('Fuel Tank Trailers', 'fuel-tank-trailers', trailers_id, 29),
    ('Food Grade Tank Trailers', 'food-tank-trailers', trailers_id, 30),
    ('Chemical Tank Trailers', 'chemical-tank-trailers', trailers_id, 31),
    ('Water Tank Trailers', 'water-tank-trailers', trailers_id, 32),
    ('Vacuum Tank Trailers', 'vacuum-tank-trailers', trailers_id, 33),

    -- Light/utility trailers
    ('Tilt Trailers', 'tilt-trailers', trailers_id, 34),
    ('Landscape Trailers', 'landscape-trailers', trailers_id, 35),
    ('Horse Trailers', 'horse-trailers', trailers_id, 36),
    ('Cargo Trailers', 'cargo-trailers', trailers_id, 37),
    ('ATV / Motorcycle Trailers', 'atv-trailers', trailers_id, 38),
    ('Boat Trailers', 'boat-trailers', trailers_id, 39),
    ('Gooseneck Trailers', 'gooseneck-trailers', trailers_id, 40),

    -- Other commercial
    ('Roll Off Trailers', 'roll-off-trailers', trailers_id, 41),
    ('Refuse Trailers', 'refuse-trailers', trailers_id, 42),
    ('Storage Trailers', 'storage-trailers', trailers_id, 43),
    ('Oil Field Trailers', 'oilfield-trailers', trailers_id, 44),
    ('Intermodal Containers', 'intermodal-containers', trailers_id, 45),

    -- Grain specific (alias for hopper)
    ('Grain Trailers', 'grain-trailers', trailers_id, 46),

    -- Catch-all
    ('Specialty Trailers', 'specialty-trailers', trailers_id, 99)
  ON CONFLICT (slug) DO NOTHING;

END $$;
