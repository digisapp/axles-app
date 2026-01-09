-- Dealer Staff Voice PINs
-- Allows dealer staff to authenticate via voice PIN for internal AI access

CREATE TABLE dealer_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to dealer
  dealer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Staff Info
  name TEXT NOT NULL,
  role TEXT DEFAULT 'sales', -- sales, manager, admin, service
  phone_number TEXT, -- Optional: for caller ID recognition
  email TEXT,

  -- Voice Authentication
  voice_pin TEXT NOT NULL, -- 4-6 digit PIN
  pin_hash TEXT, -- For secure storage (future enhancement)

  -- Access Control
  access_level TEXT DEFAULT 'standard' CHECK (access_level IN ('standard', 'manager', 'admin')),
  can_view_costs BOOLEAN DEFAULT false, -- See acquisition costs
  can_view_margins BOOLEAN DEFAULT false, -- See profit margins
  can_view_all_leads BOOLEAN DEFAULT true, -- See all leads or just own
  can_modify_inventory BOOLEAN DEFAULT false, -- Add/edit listings via voice

  -- Usage Tracking
  last_access_at TIMESTAMPTZ,
  access_count INT DEFAULT 0,
  failed_attempts INT DEFAULT 0,
  locked_until TIMESTAMPTZ, -- Lockout after failed attempts

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_dealer_staff_dealer ON dealer_staff(dealer_id);
CREATE INDEX idx_dealer_staff_pin ON dealer_staff(dealer_id, voice_pin) WHERE is_active = true;
CREATE INDEX idx_dealer_staff_phone ON dealer_staff(phone_number) WHERE phone_number IS NOT NULL;

-- RLS
ALTER TABLE dealer_staff ENABLE ROW LEVEL SECURITY;

-- Dealers can manage their own staff
CREATE POLICY "Dealers can view their own staff" ON dealer_staff
  FOR SELECT USING (auth.uid() = dealer_id);

CREATE POLICY "Dealers can insert their own staff" ON dealer_staff
  FOR INSERT WITH CHECK (auth.uid() = dealer_id);

CREATE POLICY "Dealers can update their own staff" ON dealer_staff
  FOR UPDATE USING (auth.uid() = dealer_id);

CREATE POLICY "Dealers can delete their own staff" ON dealer_staff
  FOR DELETE USING (auth.uid() = dealer_id);

-- Staff access logs - track internal AI usage
CREATE TABLE dealer_staff_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  dealer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES dealer_staff(id) ON DELETE SET NULL,

  -- Access Details
  access_type TEXT DEFAULT 'voice' CHECK (access_type IN ('voice', 'app', 'web')),
  caller_phone TEXT,
  session_id TEXT, -- Call/session ID for linking to call logs

  -- What was accessed
  query TEXT, -- What they asked
  query_type TEXT, -- inventory, lead, crm, pricing, etc.
  response_summary TEXT, -- Brief summary of what was returned

  -- Auth Result
  auth_success BOOLEAN DEFAULT true,
  auth_method TEXT DEFAULT 'pin', -- pin, caller_id, both

  -- Timestamps
  accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_staff_access_logs_dealer ON dealer_staff_access_logs(dealer_id);
CREATE INDEX idx_staff_access_logs_staff ON dealer_staff_access_logs(staff_id);
CREATE INDEX idx_staff_access_logs_date ON dealer_staff_access_logs(accessed_at);

-- RLS
ALTER TABLE dealer_staff_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dealers can view their own access logs" ON dealer_staff_access_logs
  FOR SELECT USING (auth.uid() = dealer_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_dealer_staff_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_dealer_staff_updated_at
  BEFORE UPDATE ON dealer_staff
  FOR EACH ROW
  EXECUTE FUNCTION update_dealer_staff_updated_at();

-- Function to verify staff PIN and handle lockouts
CREATE OR REPLACE FUNCTION verify_staff_pin(
  p_dealer_id UUID,
  p_pin TEXT,
  p_staff_name TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  staff_id UUID,
  staff_name TEXT,
  access_level TEXT,
  message TEXT
) AS $$
DECLARE
  v_staff RECORD;
  v_max_attempts INT := 5;
  v_lockout_minutes INT := 15;
BEGIN
  -- Find staff by PIN (and optionally name)
  SELECT * INTO v_staff
  FROM dealer_staff ds
  WHERE ds.dealer_id = p_dealer_id
    AND ds.voice_pin = p_pin
    AND ds.is_active = true
    AND (p_staff_name IS NULL OR LOWER(ds.name) = LOWER(p_staff_name))
    AND (ds.locked_until IS NULL OR ds.locked_until < NOW())
  LIMIT 1;

  IF v_staff.id IS NOT NULL THEN
    -- Success - update access tracking
    UPDATE dealer_staff
    SET last_access_at = NOW(),
        access_count = access_count + 1,
        failed_attempts = 0
    WHERE id = v_staff.id;

    RETURN QUERY SELECT
      true,
      v_staff.id,
      v_staff.name,
      v_staff.access_level,
      'Access granted'::TEXT;
  ELSE
    -- Failed attempt - check if we need to lock
    -- (In a real implementation, track by caller phone or session)
    RETURN QUERY SELECT
      false,
      NULL::UUID,
      NULL::TEXT,
      NULL::TEXT,
      'Invalid PIN or access denied'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
