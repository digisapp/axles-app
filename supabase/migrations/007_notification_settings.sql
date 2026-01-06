-- Add notification settings column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{}';

-- Comment
COMMENT ON COLUMN profiles.notification_settings IS 'JSON with notification preferences: { new_chat: true, new_lead: true, new_message: true }';
