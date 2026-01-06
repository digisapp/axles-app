-- Admin System Migration
-- Adds admin role and dealer verification workflow

-- Add admin role to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Add dealer verification fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dealer_status TEXT DEFAULT 'none'
  CHECK (dealer_status IN ('none', 'pending', 'approved', 'rejected'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dealer_applied_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dealer_reviewed_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dealer_reviewed_by UUID REFERENCES profiles(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dealer_rejection_reason TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_license TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tax_id TEXT;

-- Index for admin queries
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = true;
CREATE INDEX IF NOT EXISTS idx_profiles_dealer_status ON profiles(dealer_status) WHERE dealer_status = 'pending';

-- Admin activity log
CREATE TABLE IF NOT EXISTS admin_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES profiles(id) NOT NULL,
  action TEXT NOT NULL, -- 'approve_dealer', 'reject_dealer', 'suspend_user', etc.
  target_type TEXT NOT NULL, -- 'user', 'listing', 'lead'
  target_id UUID NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for activity log
CREATE INDEX IF NOT EXISTS idx_admin_activity_admin ON admin_activity_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_target ON admin_activity_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_created ON admin_activity_log(created_at DESC);

-- RLS for admin activity log
ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view activity log
CREATE POLICY "Admins can view activity log" ON admin_activity_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Only admins can insert activity log
CREATE POLICY "Admins can insert activity log" ON admin_activity_log
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Platform stats table for caching analytics
CREATE TABLE IF NOT EXISTS platform_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stat_date DATE NOT NULL UNIQUE,
  total_users INT DEFAULT 0,
  new_users INT DEFAULT 0,
  total_dealers INT DEFAULT 0,
  new_dealers INT DEFAULT 0,
  total_listings INT DEFAULT 0,
  new_listings INT DEFAULT 0,
  active_listings INT DEFAULT 0,
  total_views INT DEFAULT 0,
  total_leads INT DEFAULT 0,
  new_leads INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for stats queries
CREATE INDEX IF NOT EXISTS idx_platform_stats_date ON platform_stats(stat_date DESC);

-- RLS for platform stats
ALTER TABLE platform_stats ENABLE ROW LEVEL SECURITY;

-- Only admins can view stats
CREATE POLICY "Admins can view platform stats" ON platform_stats
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Only admins can manage stats
CREATE POLICY "Admins can manage platform stats" ON platform_stats
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Add suspended status to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

-- Comments
COMMENT ON COLUMN profiles.is_admin IS 'Whether user has admin privileges';
COMMENT ON COLUMN profiles.dealer_status IS 'Dealer verification status: none, pending, approved, rejected';
COMMENT ON COLUMN profiles.is_suspended IS 'Whether user account is suspended';
COMMENT ON TABLE admin_activity_log IS 'Audit log of all admin actions';
COMMENT ON TABLE platform_stats IS 'Daily cached platform statistics for admin dashboard';
