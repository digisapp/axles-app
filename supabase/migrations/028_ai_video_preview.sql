-- AI Video Preview Generation
-- Stores xAI grok-imagine-video generation state per listing

ALTER TABLE listings ADD COLUMN IF NOT EXISTS ai_video_preview_url TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS ai_video_request_id TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS ai_video_status TEXT DEFAULT NULL;
-- status values: 'generating', 'completed', 'failed'
