-- Dealer AI Sales Assistant Migration
-- Adds personalized AI assistant configuration for dealers

-- Dealer AI Settings Table
CREATE TABLE IF NOT EXISTS dealer_ai_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,

  -- AI Assistant Identity
  assistant_name TEXT DEFAULT 'AI Sales Assistant',
  greeting_message TEXT DEFAULT 'Hi! I''m here to help you find the perfect equipment. What are you looking for today?',

  -- Dealer Information (for AI context)
  about_dealer TEXT,                -- Company description/history
  specialties TEXT[],               -- e.g., ['lowboy trailers', 'heavy haul', 'refrigerated trailers']
  value_propositions TEXT[],        -- e.g., ['Family owned since 1985', 'Largest lowboy inventory in TX']
  service_areas TEXT[],             -- e.g., ['Texas', 'Oklahoma', 'Louisiana']
  financing_info TEXT,              -- Financing options info
  warranty_info TEXT,               -- Warranty information

  -- Custom FAQs (AI will use these to answer questions)
  faqs JSONB DEFAULT '[]',          -- Array of {question, answer}

  -- AI Personality
  tone TEXT DEFAULT 'professional' CHECK (tone IN ('professional', 'friendly', 'casual')),
  language_style TEXT DEFAULT 'concise',

  -- Response Settings
  max_response_length INT DEFAULT 300,
  include_pricing BOOLEAN DEFAULT true,
  include_financing_cta BOOLEAN DEFAULT true,

  -- Lead Capture
  capture_leads BOOLEAN DEFAULT true,
  lead_capture_message TEXT DEFAULT 'I''d love to connect you with one of our team members. Could you share your contact info?',
  lead_notification_email TEXT,     -- Override for notifications

  -- Feature Flags
  is_enabled BOOLEAN DEFAULT false,
  show_on_listings BOOLEAN DEFAULT true,
  show_on_storefront BOOLEAN DEFAULT true,

  -- Analytics
  total_conversations INT DEFAULT 0,
  total_messages INT DEFAULT 0,
  total_leads_generated INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dealer_ai_settings_dealer ON dealer_ai_settings(dealer_id);
CREATE INDEX IF NOT EXISTS idx_dealer_ai_settings_enabled ON dealer_ai_settings(is_enabled) WHERE is_enabled = true;

-- Add AI-specific fields to chat_conversations
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS is_ai_conversation BOOLEAN DEFAULT false;
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS lead_captured BOOLEAN DEFAULT false;
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS visitor_intent TEXT; -- What they're looking for
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS sentiment_score DECIMAL(3,2); -- AI sentiment analysis

-- Add listing reference to chat_conversations (for listing-specific chats)
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS listing_id UUID REFERENCES listings(id) ON DELETE SET NULL;

-- Dealer AI Leads table (for leads captured via AI chat)
CREATE TABLE IF NOT EXISTS dealer_ai_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE SET NULL,
  dealer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,

  -- Visitor Info (captured during conversation)
  visitor_name TEXT,
  visitor_email TEXT,
  visitor_phone TEXT,

  -- Intent Information
  equipment_interest TEXT,           -- What they're looking for
  budget_range TEXT,                 -- If shared
  timeline TEXT,                     -- When they want to buy

  -- AI Analysis
  lead_score INT DEFAULT 50 CHECK (lead_score >= 0 AND lead_score <= 100),
  ai_summary TEXT,                   -- AI-generated conversation summary

  -- Status
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  contacted_at TIMESTAMPTZ
);

-- Indexes for leads
CREATE INDEX IF NOT EXISTS idx_dealer_ai_leads_dealer ON dealer_ai_leads(dealer_id);
CREATE INDEX IF NOT EXISTS idx_dealer_ai_leads_status ON dealer_ai_leads(status);
CREATE INDEX IF NOT EXISTS idx_dealer_ai_leads_created ON dealer_ai_leads(created_at DESC);

-- RLS for dealer_ai_settings
ALTER TABLE dealer_ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dealers can view own AI settings" ON dealer_ai_settings
  FOR SELECT USING (auth.uid() = dealer_id);

CREATE POLICY "Dealers can insert own AI settings" ON dealer_ai_settings
  FOR INSERT WITH CHECK (auth.uid() = dealer_id);

CREATE POLICY "Dealers can update own AI settings" ON dealer_ai_settings
  FOR UPDATE USING (auth.uid() = dealer_id);

-- Public read for enabled settings (needed for AI chat endpoint)
CREATE POLICY "Public can view enabled AI settings" ON dealer_ai_settings
  FOR SELECT USING (is_enabled = true);

-- RLS for dealer_ai_leads
ALTER TABLE dealer_ai_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dealers can view own leads" ON dealer_ai_leads
  FOR SELECT USING (auth.uid() = dealer_id);

CREATE POLICY "Anyone can create leads" ON dealer_ai_leads
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Dealers can update own leads" ON dealer_ai_leads
  FOR UPDATE USING (auth.uid() = dealer_id);

-- Update triggers
CREATE TRIGGER trigger_dealer_ai_settings_updated_at
  BEFORE UPDATE ON dealer_ai_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_dealer_ai_leads_updated_at
  BEFORE UPDATE ON dealer_ai_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Function to increment conversation/message counts
CREATE OR REPLACE FUNCTION increment_dealer_ai_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_ai_conversation = true THEN
    UPDATE dealer_ai_settings
    SET total_conversations = total_conversations + 1
    WHERE dealer_id = NEW.dealer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_ai_conversations
  AFTER INSERT ON chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION increment_dealer_ai_stats();

-- Function to increment dealer AI message count
CREATE OR REPLACE FUNCTION increment_dealer_ai_messages(p_dealer_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE dealer_ai_settings
  SET total_messages = total_messages + 1
  WHERE dealer_id = p_dealer_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment dealer AI lead count
CREATE OR REPLACE FUNCTION increment_dealer_ai_leads(p_dealer_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE dealer_ai_settings
  SET total_leads_generated = total_leads_generated + 1
  WHERE dealer_id = p_dealer_id;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE dealer_ai_settings IS 'Configuration for dealer-specific AI sales assistants';
COMMENT ON COLUMN dealer_ai_settings.faqs IS 'JSON array of {question: string, answer: string} for AI to use';
COMMENT ON COLUMN dealer_ai_settings.specialties IS 'Equipment types the dealer specializes in';
COMMENT ON TABLE dealer_ai_leads IS 'Leads captured through dealer AI chat conversations';
