-- Migration: View count batching support
-- Adds function for batch incrementing view counts

-- Function to increment views by a specific count (for batch updates)
CREATE OR REPLACE FUNCTION increment_views_by(listing_id UUID, count INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE listings
  SET views_count = COALESCE(views_count, 0) + count
  WHERE id = listing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION increment_views_by(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_views_by(UUID, INTEGER) TO service_role;

-- Also ensure the single increment function exists
CREATE OR REPLACE FUNCTION increment_views(listing_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE listings
  SET views_count = COALESCE(views_count, 0) + 1
  WHERE id = listing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION increment_views(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_views(UUID) TO service_role;
