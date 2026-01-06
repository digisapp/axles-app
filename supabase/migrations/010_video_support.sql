-- Video Support Migration
-- Adds video_url field to listings for walkaround videos

-- Add video_url column to listings
ALTER TABLE listings ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Add index for listings with videos (for filtering)
CREATE INDEX IF NOT EXISTS idx_listings_has_video ON listings(video_url) WHERE video_url IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN listings.video_url IS 'YouTube or Vimeo URL for walkaround video';
