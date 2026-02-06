-- Floor Plan Management System
-- Tracks inventory financing, curtailment schedules, and interest accrual

-- ============================================
-- 1. FLOOR PLAN PROVIDERS (Lenders)
-- ============================================
CREATE TABLE floor_plan_providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website TEXT,

  -- Default Terms
  default_interest_rate DECIMAL(5,3) DEFAULT 8.500,
  default_curtailment_days INT DEFAULT 90,
  default_curtailment_percent DECIMAL(5,2) DEFAULT 10.00,

  notes TEXT,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed common floor plan providers
INSERT INTO floor_plan_providers (name, default_interest_rate, default_curtailment_days) VALUES
  ('NextGear Capital', 8.25, 90),
  ('Dealer Track', 8.50, 90),
  ('AFC (Automotive Finance Corporation)', 8.00, 90),
  ('Ally Commercial Finance', 7.75, 90),
  ('Wells Fargo Dealer Services', 8.00, 90),
  ('Bank of America Dealer Financial', 7.50, 90),
  ('Floor Plan Xpress', 9.00, 90),
  ('Kinetic Advantage', 8.50, 90),
  ('Other', 8.50, 90);

-- ============================================
-- 2. FLOOR PLAN ACCOUNTS (Dealer's credit lines)
-- ============================================
CREATE TABLE floor_plan_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  provider_id UUID REFERENCES floor_plan_providers(id) ON DELETE RESTRICT NOT NULL,

  account_number TEXT,
  account_name TEXT,

  -- Credit Line
  credit_limit DECIMAL(14,2) NOT NULL,
  available_credit DECIMAL(14,2) NOT NULL,

  -- Interest Terms
  interest_rate DECIMAL(5,3) NOT NULL,
  interest_type TEXT DEFAULT 'daily' CHECK (interest_type IN ('daily', 'monthly')),
  interest_calculation TEXT DEFAULT 'simple' CHECK (interest_calculation IN ('simple', 'compound')),

  -- Curtailment Terms
  curtailment_days INT DEFAULT 90,
  curtailment_percent DECIMAL(5,2) DEFAULT 10.00,
  subsequent_curtailment_days INT DEFAULT 30,

  -- Fees
  floor_fee_percent DECIMAL(5,3) DEFAULT 0,
  payoff_fee DECIMAL(8,2) DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  opened_date DATE,
  closed_date DATE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(dealer_id, provider_id, account_number)
);

-- ============================================
-- 3. LISTING FLOOR PLANS (Per-unit tracking)
-- ============================================
CREATE TABLE listing_floor_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES floor_plan_accounts(id) ON DELETE RESTRICT NOT NULL,

  -- Floor Plan Details
  floor_amount DECIMAL(12,2) NOT NULL,
  floor_date DATE NOT NULL,
  floor_reference TEXT,

  -- Balance Tracking
  current_balance DECIMAL(12,2) NOT NULL,
  total_interest_accrued DECIMAL(10,2) DEFAULT 0,
  total_interest_paid DECIMAL(10,2) DEFAULT 0,

  -- Curtailment Tracking
  first_curtailment_date DATE,
  next_curtailment_date DATE,
  curtailments_paid INT DEFAULT 0,

  -- Payoff Information
  payoff_date DATE,
  payoff_amount DECIMAL(12,2),
  payoff_reference TEXT,

  -- Calculated/Status Fields
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paid_off', 'transferred')),
  is_past_due BOOLEAN DEFAULT false,
  days_floored INT DEFAULT 0,

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(listing_id, status) -- Only one active floor plan per listing
);

-- ============================================
-- 4. FLOOR PLAN PAYMENTS (History)
-- ============================================
CREATE TABLE floor_plan_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  floor_plan_id UUID REFERENCES listing_floor_plans(id) ON DELETE CASCADE NOT NULL,

  payment_type TEXT NOT NULL CHECK (payment_type IN ('curtailment', 'interest', 'payoff', 'adjustment')),
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  reference_number TEXT,

  balance_after DECIMAL(12,2) NOT NULL,

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. FLOOR PLAN ALERTS
-- ============================================
CREATE TABLE floor_plan_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  floor_plan_id UUID REFERENCES listing_floor_plans(id) ON DELETE CASCADE,

  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'curtailment_upcoming',
    'curtailment_due',
    'curtailment_past_due',
    'high_interest',
    'credit_limit_warning',
    'aging_inventory'
  )),
  severity TEXT DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),

  title TEXT NOT NULL,
  message TEXT NOT NULL,

  is_read BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  action_taken BOOLEAN DEFAULT false,

  -- Quick access data
  listing_title TEXT,
  due_date DATE,
  amount_due DECIMAL(12,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,

  -- Prevent duplicate alerts
  UNIQUE(dealer_id, floor_plan_id, alert_type, due_date)
);

-- ============================================
-- 6. INDEXES
-- ============================================
CREATE INDEX idx_floor_plan_accounts_dealer ON floor_plan_accounts(dealer_id);
CREATE INDEX idx_floor_plan_accounts_status ON floor_plan_accounts(status) WHERE status = 'active';

CREATE INDEX idx_listing_floor_plans_listing ON listing_floor_plans(listing_id);
CREATE INDEX idx_listing_floor_plans_account ON listing_floor_plans(account_id);
CREATE INDEX idx_listing_floor_plans_status ON listing_floor_plans(status);
CREATE INDEX idx_listing_floor_plans_next_curtailment ON listing_floor_plans(next_curtailment_date)
  WHERE status = 'active';
CREATE INDEX idx_listing_floor_plans_past_due ON listing_floor_plans(is_past_due)
  WHERE is_past_due = true AND status = 'active';

CREATE INDEX idx_floor_plan_payments_floor_plan ON floor_plan_payments(floor_plan_id);
CREATE INDEX idx_floor_plan_payments_date ON floor_plan_payments(payment_date DESC);

CREATE INDEX idx_floor_plan_alerts_dealer ON floor_plan_alerts(dealer_id);
CREATE INDEX idx_floor_plan_alerts_unread ON floor_plan_alerts(dealer_id, is_read) WHERE is_read = false;

-- ============================================
-- 7. DATABASE FUNCTIONS
-- ============================================

-- Calculate days floored
CREATE OR REPLACE FUNCTION calculate_days_floored(floor_date DATE)
RETURNS INT AS $$
BEGIN
  RETURN GREATEST(0, CURRENT_DATE - floor_date);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Calculate accrued interest
CREATE OR REPLACE FUNCTION calculate_accrued_interest(
  p_current_balance DECIMAL,
  p_annual_rate DECIMAL,
  p_days INT,
  p_interest_type TEXT DEFAULT 'simple'
)
RETURNS DECIMAL AS $$
DECLARE
  v_daily_rate DECIMAL;
  v_interest DECIMAL;
BEGIN
  v_daily_rate := p_annual_rate / 100.0 / 365.0;

  IF p_interest_type = 'simple' THEN
    v_interest := p_current_balance * v_daily_rate * p_days;
  ELSE
    -- Compound interest (daily)
    v_interest := p_current_balance * (POWER(1 + v_daily_rate, p_days) - 1);
  END IF;

  RETURN ROUND(v_interest, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update available credit for an account
CREATE OR REPLACE FUNCTION update_account_available_credit(p_account_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total_floored DECIMAL;
  v_credit_limit DECIMAL;
BEGIN
  SELECT COALESCE(SUM(current_balance), 0)
  INTO v_total_floored
  FROM listing_floor_plans
  WHERE account_id = p_account_id AND status = 'active';

  SELECT credit_limit INTO v_credit_limit
  FROM floor_plan_accounts WHERE id = p_account_id;

  UPDATE floor_plan_accounts
  SET
    available_credit = GREATEST(0, v_credit_limit - v_total_floored),
    updated_at = NOW()
  WHERE id = p_account_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. TRIGGERS
-- ============================================

-- Trigger function to update available credit
CREATE OR REPLACE FUNCTION trigger_update_available_credit()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM update_account_available_credit(OLD.account_id);
    RETURN OLD;
  ELSE
    PERFORM update_account_available_credit(NEW.account_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_floor_plan_credit_update
  AFTER INSERT OR UPDATE OF current_balance, status OR DELETE ON listing_floor_plans
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_available_credit();

-- Trigger function to update floor plan calculated fields
CREATE OR REPLACE FUNCTION trigger_update_floor_plan_fields()
RETURNS TRIGGER AS $$
DECLARE
  v_curtailment_days INT;
BEGIN
  -- Calculate days floored
  NEW.days_floored := calculate_days_floored(NEW.floor_date);

  -- Check if past due
  IF NEW.next_curtailment_date IS NOT NULL AND NEW.status = 'active' THEN
    NEW.is_past_due := NEW.next_curtailment_date < CURRENT_DATE;
  ELSE
    NEW.is_past_due := false;
  END IF;

  -- Set first curtailment date if not set
  IF NEW.first_curtailment_date IS NULL THEN
    SELECT curtailment_days INTO v_curtailment_days
    FROM floor_plan_accounts WHERE id = NEW.account_id;

    NEW.first_curtailment_date := NEW.floor_date + v_curtailment_days;
    NEW.next_curtailment_date := NEW.first_curtailment_date;
  END IF;

  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_floor_plan_fields_update
  BEFORE INSERT OR UPDATE ON listing_floor_plans
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_floor_plan_fields();

-- Trigger for updated_at on accounts
CREATE OR REPLACE FUNCTION trigger_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_floor_plan_accounts_updated
  BEFORE UPDATE ON floor_plan_accounts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

CREATE TRIGGER trigger_floor_plan_providers_updated
  BEFORE UPDATE ON floor_plan_providers
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

-- ============================================
-- 9. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE floor_plan_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE floor_plan_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_floor_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE floor_plan_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE floor_plan_alerts ENABLE ROW LEVEL SECURITY;

-- Providers: Public read for active, admin manage
CREATE POLICY "Anyone can view active providers" ON floor_plan_providers
  FOR SELECT USING (is_active = true);

-- Accounts: Dealer-owned
CREATE POLICY "Dealers can view own accounts" ON floor_plan_accounts
  FOR SELECT USING (auth.uid() = dealer_id);

CREATE POLICY "Dealers can create own accounts" ON floor_plan_accounts
  FOR INSERT WITH CHECK (auth.uid() = dealer_id);

CREATE POLICY "Dealers can update own accounts" ON floor_plan_accounts
  FOR UPDATE USING (auth.uid() = dealer_id);

CREATE POLICY "Dealers can delete own accounts" ON floor_plan_accounts
  FOR DELETE USING (auth.uid() = dealer_id);

-- Listing Floor Plans: Via account ownership
CREATE POLICY "Dealers can view own floor plans" ON listing_floor_plans
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM floor_plan_accounts
      WHERE floor_plan_accounts.id = listing_floor_plans.account_id
      AND floor_plan_accounts.dealer_id = auth.uid()
    )
  );

CREATE POLICY "Dealers can create floor plans for own accounts" ON listing_floor_plans
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM floor_plan_accounts
      WHERE floor_plan_accounts.id = listing_floor_plans.account_id
      AND floor_plan_accounts.dealer_id = auth.uid()
    )
  );

CREATE POLICY "Dealers can update own floor plans" ON listing_floor_plans
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM floor_plan_accounts
      WHERE floor_plan_accounts.id = listing_floor_plans.account_id
      AND floor_plan_accounts.dealer_id = auth.uid()
    )
  );

CREATE POLICY "Dealers can delete own floor plans" ON listing_floor_plans
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM floor_plan_accounts
      WHERE floor_plan_accounts.id = listing_floor_plans.account_id
      AND floor_plan_accounts.dealer_id = auth.uid()
    )
  );

-- Payments: Via floor plan ownership
CREATE POLICY "Dealers can view own payments" ON floor_plan_payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM listing_floor_plans lfp
      JOIN floor_plan_accounts fpa ON fpa.id = lfp.account_id
      WHERE lfp.id = floor_plan_payments.floor_plan_id
      AND fpa.dealer_id = auth.uid()
    )
  );

CREATE POLICY "Dealers can create payments for own floor plans" ON floor_plan_payments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM listing_floor_plans lfp
      JOIN floor_plan_accounts fpa ON fpa.id = lfp.account_id
      WHERE lfp.id = floor_plan_payments.floor_plan_id
      AND fpa.dealer_id = auth.uid()
    )
  );

-- Alerts: Dealer-owned
CREATE POLICY "Dealers can view own alerts" ON floor_plan_alerts
  FOR SELECT USING (auth.uid() = dealer_id);

CREATE POLICY "Dealers can update own alerts" ON floor_plan_alerts
  FOR UPDATE USING (auth.uid() = dealer_id);

CREATE POLICY "System can create alerts" ON floor_plan_alerts
  FOR INSERT WITH CHECK (true);

-- ============================================
-- 10. HELPER FUNCTIONS FOR API
-- ============================================

-- Get dashboard metrics for a dealer
CREATE OR REPLACE FUNCTION get_floor_plan_metrics(p_dealer_id UUID)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  WITH account_totals AS (
    SELECT
      COALESCE(SUM(credit_limit), 0) as total_credit_limit,
      COALESCE(SUM(available_credit), 0) as total_available
    FROM floor_plan_accounts
    WHERE dealer_id = p_dealer_id AND status = 'active'
  ),
  floor_plan_totals AS (
    SELECT
      COALESCE(SUM(lfp.current_balance), 0) as total_balance,
      COALESCE(SUM(lfp.floor_amount), 0) as total_floored,
      COUNT(*) FILTER (WHERE lfp.status = 'active') as units_floored,
      COUNT(*) FILTER (WHERE lfp.is_past_due = true) as units_past_due,
      COUNT(*) FILTER (WHERE lfp.next_curtailment_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7) as upcoming_curtailments,
      COALESCE(SUM(lfp.total_interest_accrued - lfp.total_interest_paid), 0) as unpaid_interest
    FROM listing_floor_plans lfp
    JOIN floor_plan_accounts fpa ON fpa.id = lfp.account_id
    WHERE fpa.dealer_id = p_dealer_id AND lfp.status = 'active'
  ),
  interest_estimate AS (
    SELECT
      COALESCE(SUM(lfp.current_balance * (fpa.interest_rate / 100.0 / 12.0)), 0) as monthly_interest
    FROM listing_floor_plans lfp
    JOIN floor_plan_accounts fpa ON fpa.id = lfp.account_id
    WHERE fpa.dealer_id = p_dealer_id AND lfp.status = 'active'
  ),
  alert_counts AS (
    SELECT
      COUNT(*) FILTER (WHERE severity = 'critical' AND is_dismissed = false) as critical,
      COUNT(*) FILTER (WHERE severity = 'warning' AND is_dismissed = false) as warning,
      COUNT(*) FILTER (WHERE severity = 'info' AND is_dismissed = false) as info
    FROM floor_plan_alerts
    WHERE dealer_id = p_dealer_id
  )
  SELECT json_build_object(
    'totalCreditLimit', at.total_credit_limit,
    'totalAvailableCredit', at.total_available,
    'totalCurrentBalance', fpt.total_balance,
    'totalFloored', fpt.total_floored,
    'creditUtilization', CASE
      WHEN at.total_credit_limit > 0
      THEN ROUND(((at.total_credit_limit - at.total_available) / at.total_credit_limit * 100)::numeric, 1)
      ELSE 0
    END,
    'unitsFloored', fpt.units_floored,
    'unitsPastDue', fpt.units_past_due,
    'upcomingCurtailments', fpt.upcoming_curtailments,
    'unpaidInterest', fpt.unpaid_interest,
    'monthlyInterestEstimate', ROUND(ie.monthly_interest::numeric, 2),
    'alertCounts', json_build_object(
      'critical', ac.critical,
      'warning', ac.warning,
      'info', ac.info
    )
  ) INTO v_result
  FROM account_totals at, floor_plan_totals fpt, interest_estimate ie, alert_counts ac;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
