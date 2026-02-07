-- AI Agent Settings
-- Stores configuration for the voice AI phone agent

CREATE TABLE IF NOT EXISTS ai_agent_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Voice settings
    voice TEXT NOT NULL DEFAULT 'Sal',  -- Ara, Eve, Mika, Leo, Rex, Sal

    -- Agent personality
    agent_name TEXT NOT NULL DEFAULT 'Axlon AI',
    greeting_message TEXT NOT NULL DEFAULT 'Hello! Thanks for calling Axlon AI, your marketplace for trucks, trailers, and heavy equipment. How can I help you find what you''re looking for today?',

    -- Instructions for the AI
    instructions TEXT NOT NULL DEFAULT 'You are a helpful AI assistant for AxlonAI, a marketplace for trucks, trailers, and heavy equipment.

Your role is to:
1. Answer questions about available inventory (trucks, trailers, heavy equipment)
2. Help callers find equipment that matches their needs
3. Provide pricing and specification information
4. Capture lead information for follow-up by dealers
5. Transfer calls to dealers when requested

Guidelines:
- Be friendly, professional, and knowledgeable about commercial trucks and trailers
- Ask clarifying questions to understand what the caller is looking for
- When discussing equipment, mention key specs like year, make, model, price, and condition
- If a caller is interested in a specific unit, offer to capture their information for a callback
- Keep responses concise for phone conversation (2-3 sentences max)
- If you don''t have information, offer to connect them with a dealer

Common equipment types:
- Trailers: flatbed, dry van, reefer, lowboy, drop deck, dump, tanker
- Trucks: semi trucks, day cabs, sleeper cabs, box trucks, dump trucks
- Heavy equipment: excavators, loaders, bulldozers, cranes',

    -- Model settings
    model TEXT NOT NULL DEFAULT 'grok-2-public',
    temperature DECIMAL(2,1) NOT NULL DEFAULT 0.7,

    -- Phone number
    phone_number TEXT,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create trigger for updated_at
CREATE TRIGGER update_ai_agent_settings_updated_at
    BEFORE UPDATE ON ai_agent_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default settings
INSERT INTO ai_agent_settings (id, phone_number)
VALUES ('00000000-0000-0000-0000-000000000001', '+14694213536')
ON CONFLICT (id) DO NOTHING;

-- RLS policies
ALTER TABLE ai_agent_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can view/edit
CREATE POLICY "Admins can manage AI agent settings"
    ON ai_agent_settings FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- Service role can access for the agent
CREATE POLICY "Service role can read AI agent settings"
    ON ai_agent_settings FOR SELECT
    USING (true);
