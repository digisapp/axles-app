-- Seed Categories for AxlonAI

-- Parent Categories
INSERT INTO categories (id, name, slug, icon, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Trucks', 'trucks', 'truck', 1),
  ('22222222-2222-2222-2222-222222222222', 'Trailers', 'trailers', 'container', 2),
  ('33333333-3333-3333-3333-333333333333', 'Heavy Equipment', 'heavy-equipment', 'hard-hat', 3),
  ('44444444-4444-4444-4444-444444444444', 'Components & Parts', 'components', 'wrench', 4);

-- Truck Subcategories
INSERT INTO categories (name, slug, parent_id, sort_order) VALUES
  ('Heavy Duty Trucks (Class 8)', 'heavy-duty-trucks', '11111111-1111-1111-1111-111111111111', 1),
  ('Medium Duty Trucks (Class 4-7)', 'medium-duty-trucks', '11111111-1111-1111-1111-111111111111', 2),
  ('Light Duty Trucks (Class 1-3)', 'light-duty-trucks', '11111111-1111-1111-1111-111111111111', 3),
  ('Day Cab Trucks', 'day-cab-trucks', '11111111-1111-1111-1111-111111111111', 4),
  ('Sleeper Trucks', 'sleeper-trucks', '11111111-1111-1111-1111-111111111111', 5),
  ('Dump Trucks', 'dump-trucks', '11111111-1111-1111-1111-111111111111', 6),
  ('Box Trucks / Straight Trucks', 'box-trucks', '11111111-1111-1111-1111-111111111111', 7),
  ('Flatbed Trucks', 'flatbed-trucks', '11111111-1111-1111-1111-111111111111', 8),
  ('Tow Trucks / Wreckers', 'tow-trucks', '11111111-1111-1111-1111-111111111111', 9),
  ('Tanker Trucks', 'tanker-trucks', '11111111-1111-1111-1111-111111111111', 10),
  ('Garbage Trucks', 'garbage-trucks', '11111111-1111-1111-1111-111111111111', 11),
  ('Fire Trucks', 'fire-trucks', '11111111-1111-1111-1111-111111111111', 12),
  ('Concrete / Mixer Trucks', 'concrete-trucks', '11111111-1111-1111-1111-111111111111', 13),
  ('Logging Trucks', 'logging-trucks', '11111111-1111-1111-1111-111111111111', 14);

-- Trailer Subcategories
INSERT INTO categories (name, slug, parent_id, sort_order) VALUES
  ('Dry Van Trailers', 'dry-van-trailers', '22222222-2222-2222-2222-222222222222', 1),
  ('Reefer / Refrigerated Trailers', 'reefer-trailers', '22222222-2222-2222-2222-222222222222', 2),
  ('Flatbed Trailers', 'flatbed-trailers', '22222222-2222-2222-2222-222222222222', 3),
  ('Lowboy Trailers', 'lowboy-trailers', '22222222-2222-2222-2222-222222222222', 4),
  ('Drop Deck Trailers', 'drop-deck-trailers', '22222222-2222-2222-2222-222222222222', 5),
  ('Tank Trailers', 'tank-trailers', '22222222-2222-2222-2222-222222222222', 6),
  ('Dump Trailers', 'dump-trailers', '22222222-2222-2222-2222-222222222222', 7),
  ('Livestock Trailers', 'livestock-trailers', '22222222-2222-2222-2222-222222222222', 8),
  ('Car Hauler Trailers', 'car-hauler-trailers', '22222222-2222-2222-2222-222222222222', 9),
  ('Utility Trailers', 'utility-trailers', '22222222-2222-2222-2222-222222222222', 10),
  ('Enclosed Trailers', 'enclosed-trailers', '22222222-2222-2222-2222-222222222222', 11),
  ('Hopper / Grain Trailers', 'hopper-trailers', '22222222-2222-2222-2222-222222222222', 12),
  ('Container Chassis', 'container-chassis', '22222222-2222-2222-2222-222222222222', 13);

-- Heavy Equipment Subcategories
INSERT INTO categories (name, slug, parent_id, sort_order) VALUES
  ('Excavators', 'excavators', '33333333-3333-3333-3333-333333333333', 1),
  ('Bulldozers', 'bulldozers', '33333333-3333-3333-3333-333333333333', 2),
  ('Wheel Loaders', 'wheel-loaders', '33333333-3333-3333-3333-333333333333', 3),
  ('Skid Steer Loaders', 'skid-steer-loaders', '33333333-3333-3333-3333-333333333333', 4),
  ('Cranes', 'cranes', '33333333-3333-3333-3333-333333333333', 5),
  ('Forklifts', 'forklifts', '33333333-3333-3333-3333-333333333333', 6),
  ('Backhoes', 'backhoes', '33333333-3333-3333-3333-333333333333', 7),
  ('Graders', 'graders', '33333333-3333-3333-3333-333333333333', 8),
  ('Compactors / Rollers', 'compactors', '33333333-3333-3333-3333-333333333333', 9),
  ('Boom Lifts', 'boom-lifts', '33333333-3333-3333-3333-333333333333', 10),
  ('Scissor Lifts', 'scissor-lifts', '33333333-3333-3333-3333-333333333333', 11),
  ('Generators', 'generators', '33333333-3333-3333-3333-333333333333', 12),
  ('Air Compressors', 'air-compressors', '33333333-3333-3333-3333-333333333333', 13);

-- Components Subcategories
INSERT INTO categories (name, slug, parent_id, sort_order) VALUES
  ('Engines', 'engines', '44444444-4444-4444-4444-444444444444', 1),
  ('Transmissions', 'transmissions', '44444444-4444-4444-4444-444444444444', 2),
  ('Axles', 'axles', '44444444-4444-4444-4444-444444444444', 3),
  ('Tires & Wheels', 'tires-wheels', '44444444-4444-4444-4444-444444444444', 4),
  ('Differentials', 'differentials', '44444444-4444-4444-4444-444444444444', 5),
  ('Cabs', 'cabs', '44444444-4444-4444-4444-444444444444', 6),
  ('Hoods', 'hoods', '44444444-4444-4444-4444-444444444444', 7),
  ('Bumpers', 'bumpers', '44444444-4444-4444-4444-444444444444', 8),
  ('Sleeper Parts', 'sleeper-parts', '44444444-4444-4444-4444-444444444444', 9),
  ('Fifth Wheels', 'fifth-wheels', '44444444-4444-4444-4444-444444444444', 10),
  ('Radiators', 'radiators', '44444444-4444-4444-4444-444444444444', 11),
  ('Starters & Alternators', 'starters-alternators', '44444444-4444-4444-4444-444444444444', 12);
