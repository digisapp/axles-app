-- Dealer Storefronts Migration
-- Adds storefront capabilities for dealers at axles.ai/[slug]

-- Add storefront columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tagline TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS about TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS zip_code TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS storefront_settings JSONB DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chat_enabled BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chat_settings JSONB DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS storefront_views INT DEFAULT 0;

-- Index for slug lookups
CREATE INDEX IF NOT EXISTS idx_profiles_slug ON profiles(slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_is_dealer ON profiles(is_dealer) WHERE is_dealer = true;

-- AI Chat Conversations table
CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  visitor_name TEXT,
  visitor_email TEXT,
  visitor_phone TEXT,
  visitor_fingerprint TEXT, -- For tracking anonymous visitors
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'converted')),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL, -- Link to lead if converted
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat Messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}', -- For storing listing references, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for chat tables
CREATE INDEX IF NOT EXISTS idx_chat_conversations_dealer ON chat_conversations(dealer_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_status ON chat_conversations(status);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id);

-- RLS for chat tables
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Dealers can view their own conversations
CREATE POLICY "Dealers can view own conversations" ON chat_conversations
  FOR SELECT USING (auth.uid() = dealer_id);

-- Anyone can create a conversation (visitor starting chat)
CREATE POLICY "Anyone can start a conversation" ON chat_conversations
  FOR INSERT WITH CHECK (true);

-- Dealers can update their conversations
CREATE POLICY "Dealers can update own conversations" ON chat_conversations
  FOR UPDATE USING (auth.uid() = dealer_id);

-- Messages follow conversation access
CREATE POLICY "Users can view messages in accessible conversations" ON chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_conversations
      WHERE chat_conversations.id = chat_messages.conversation_id
      AND (chat_conversations.dealer_id = auth.uid() OR chat_conversations.visitor_fingerprint IS NOT NULL)
    )
  );

-- Anyone can add messages to conversations
CREATE POLICY "Anyone can add messages" ON chat_messages
  FOR INSERT WITH CHECK (true);

-- Trigger for updated_at on conversations
CREATE TRIGGER trigger_chat_conversations_updated_at
  BEFORE UPDATE ON chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Function to generate unique slug from company name
CREATE OR REPLACE FUNCTION generate_dealer_slug(company TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INT := 0;
BEGIN
  -- Convert to lowercase, replace spaces with hyphens, remove special chars
  base_slug := lower(regexp_replace(company, '[^a-zA-Z0-9\s]', '', 'g'));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := trim(both '-' from base_slug);

  -- Check if slug exists and add number if needed
  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM profiles WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON COLUMN profiles.slug IS 'Unique URL slug for dealer storefront (axles.ai/[slug])';
COMMENT ON COLUMN profiles.storefront_settings IS 'JSON with theme colors, layout preferences, etc.';
COMMENT ON COLUMN profiles.chat_settings IS 'JSON with AI chat personality, greeting message, etc.';
COMMENT ON COLUMN profiles.subscription_tier IS 'free, pro, enterprise';
COMMENT ON TABLE chat_conversations IS 'AI chatbot conversations with visitors on dealer storefronts';
COMMENT ON TABLE chat_messages IS 'Individual messages within chat conversations';
