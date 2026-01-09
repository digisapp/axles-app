-- Call Logs table - stores ALL incoming calls regardless of lead capture
CREATE TABLE IF NOT EXISTS call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Caller info (from caller ID)
    caller_phone TEXT NOT NULL,
    caller_name TEXT,  -- If AI captures it during conversation

    -- Call details
    call_sid TEXT,  -- LiveKit room name
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,

    -- Recording
    recording_url TEXT,

    -- What they were looking for (AI summary)
    interest TEXT,
    equipment_type TEXT,
    intent TEXT CHECK (intent IN ('buy', 'lease', 'rent', 'browsing', 'unknown')),

    -- Link to lead if one was created
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,

    -- AI conversation summary
    summary TEXT,

    -- Status
    status TEXT DEFAULT 'completed' CHECK (status IN ('in_progress', 'completed', 'missed', 'failed')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_call_logs_caller_phone ON call_logs(caller_phone);
CREATE INDEX IF NOT EXISTS idx_call_logs_started_at ON call_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_lead_id ON call_logs(lead_id) WHERE lead_id IS NOT NULL;

-- RLS
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all call logs
CREATE POLICY "Admins can view call logs"
ON call_logs FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
);

-- Service role can insert/update (for the agent)
CREATE POLICY "Service role can manage call logs"
ON call_logs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
