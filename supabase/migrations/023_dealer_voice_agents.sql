-- Dealer Voice Agents - Multi-tenant AI phone system
-- Each dealer can have their own AI receptionist with dedicated phone number

CREATE TABLE dealer_voice_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to dealer
  dealer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Phone Number (from LiveKit)
  phone_number TEXT UNIQUE,  -- +1-XXX-XXX-XXXX format
  phone_number_id TEXT,      -- LiveKit phone number ID for management

  -- Agent Personality
  agent_name TEXT DEFAULT 'AI Assistant',
  voice TEXT DEFAULT 'Sal' CHECK (voice IN ('Ash', 'Ballad', 'Coral', 'Sage', 'Verse', 'Alloy', 'Echo', 'Fable', 'Nova', 'Onyx', 'Shimmer', 'Sal')),
  greeting TEXT DEFAULT 'Thanks for calling! How can I help you today?',
  instructions TEXT,  -- Custom personality/behavior instructions

  -- Business Info (injected into AI context)
  business_name TEXT,
  business_description TEXT,
  business_hours JSONB DEFAULT '{"timezone": "America/Chicago", "hours": {"mon": "8:00-18:00", "tue": "8:00-18:00", "wed": "8:00-18:00", "thu": "8:00-18:00", "fri": "8:00-18:00", "sat": "9:00-14:00", "sun": "closed"}}',
  after_hours_message TEXT DEFAULT 'We are currently closed. Please leave your name and number and we will call you back.',

  -- Features
  can_search_inventory BOOLEAN DEFAULT true,
  can_capture_leads BOOLEAN DEFAULT true,
  can_transfer_calls BOOLEAN DEFAULT false,
  transfer_phone_number TEXT,  -- Number to transfer to if requested

  -- Billing & Usage
  plan_tier TEXT DEFAULT 'starter' CHECK (plan_tier IN ('starter', 'pro', 'unlimited', 'trial')),
  minutes_included INT DEFAULT 100,
  minutes_used INT DEFAULT 0,
  billing_cycle_start DATE DEFAULT CURRENT_DATE,
  stripe_subscription_id TEXT,

  -- Status
  is_active BOOLEAN DEFAULT false,  -- Must be activated after setup
  is_provisioned BOOLEAN DEFAULT false,  -- Phone number assigned

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_dealer_voice_agents_dealer ON dealer_voice_agents(dealer_id);
CREATE INDEX idx_dealer_voice_agents_phone ON dealer_voice_agents(phone_number) WHERE phone_number IS NOT NULL;
CREATE INDEX idx_dealer_voice_agents_active ON dealer_voice_agents(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE dealer_voice_agents ENABLE ROW LEVEL SECURITY;

-- Dealers can view/edit their own agent
CREATE POLICY "Dealers can view their own voice agent" ON dealer_voice_agents
  FOR SELECT USING (auth.uid() = dealer_id);

CREATE POLICY "Dealers can update their own voice agent" ON dealer_voice_agents
  FOR UPDATE USING (auth.uid() = dealer_id);

-- Service role can do everything (for admin and agent operations)
CREATE POLICY "Service role has full access to voice agents" ON dealer_voice_agents
  FOR ALL USING (true) WITH CHECK (true);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_dealer_voice_agent_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_dealer_voice_agents_updated_at
  BEFORE UPDATE ON dealer_voice_agents
  FOR EACH ROW
  EXECUTE FUNCTION update_dealer_voice_agent_updated_at();

-- Call logs need dealer_id to track which dealer the call was for
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS dealer_id UUID REFERENCES profiles(id);
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS dealer_voice_agent_id UUID REFERENCES dealer_voice_agents(id);
CREATE INDEX IF NOT EXISTS idx_call_logs_dealer ON call_logs(dealer_id) WHERE dealer_id IS NOT NULL;
