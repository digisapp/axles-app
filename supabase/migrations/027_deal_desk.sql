-- Deal Desk System
-- Manages sales lifecycle from qualified leads to closed deals
-- Includes quote generation, documents, e-signatures, payments, and commissions

-- ============================================
-- 1. DEALS (Core deal information)
-- ============================================
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_number TEXT NOT NULL,

  -- Foreign Keys
  dealer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,

  -- Buyer Information
  buyer_name TEXT NOT NULL,
  buyer_email TEXT,
  buyer_phone TEXT,
  buyer_company TEXT,
  buyer_address JSONB, -- {street, city, state, zip, country}

  -- Deal Status
  status TEXT DEFAULT 'quote' CHECK (status IN (
    'quote',
    'negotiation',
    'pending_approval',
    'finalized',
    'closed',
    'lost'
  )),

  -- Pricing
  sale_price DECIMAL(14,2) DEFAULT 0,
  trade_in_allowance DECIMAL(14,2) DEFAULT 0,
  total_fees DECIMAL(12,2) DEFAULT 0,
  total_taxes DECIMAL(12,2) DEFAULT 0,
  total_due DECIMAL(14,2) DEFAULT 0,
  amount_paid DECIMAL(14,2) DEFAULT 0,
  balance_due DECIMAL(14,2) DEFAULT 0,

  -- Financing
  financing_type TEXT CHECK (financing_type IN ('cash', 'financed', 'lease')),
  financing_provider TEXT,
  financing_amount DECIMAL(14,2),
  financing_apr DECIMAL(5,3),
  financing_term_months INT,

  -- Floor Plan Integration
  floor_plan_id UUID REFERENCES listing_floor_plans(id) ON DELETE SET NULL,
  floor_plan_payoff_amount DECIMAL(12,2),

  -- Trade-In (inline for simplicity)
  trade_in_year INT,
  trade_in_make TEXT,
  trade_in_model TEXT,
  trade_in_vin TEXT,
  trade_in_mileage INT,
  trade_in_condition TEXT CHECK (trade_in_condition IN ('excellent', 'good', 'fair', 'poor')),

  -- Sales Team
  salesperson_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sales_manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Timestamps
  quote_sent_at TIMESTAMPTZ,
  quote_expires_at TIMESTAMPTZ,
  finalized_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  lost_at TIMESTAMPTZ,
  lost_reason TEXT,

  -- Notes
  internal_notes TEXT,
  special_terms TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to generate deal numbers
CREATE OR REPLACE FUNCTION generate_deal_number()
RETURNS TRIGGER AS $$
DECLARE
  v_year TEXT;
  v_seq INT;
  v_number TEXT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');

  -- Get next sequence number for this dealer and year
  SELECT COUNT(*) + 1 INTO v_seq
  FROM deals
  WHERE dealer_id = NEW.dealer_id
    AND deal_number LIKE 'DL-' || v_year || '-%';

  v_number := 'DL-' || v_year || '-' || LPAD(v_seq::TEXT, 5, '0');
  NEW.deal_number := v_number;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_deal_number
  BEFORE INSERT ON deals
  FOR EACH ROW
  EXECUTE FUNCTION generate_deal_number();

-- ============================================
-- 2. DEAL LINE ITEMS (Itemized pricing)
-- ============================================
CREATE TABLE deal_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE NOT NULL,

  item_type TEXT NOT NULL CHECK (item_type IN (
    'unit',       -- The main equipment being sold
    'fee',        -- Doc fee, delivery, etc.
    'tax',        -- Sales tax
    'add_on',     -- Extended warranty, accessories
    'discount',   -- Promotional discounts
    'trade_in'    -- Trade-in credit (negative)
  )),

  description TEXT NOT NULL,
  quantity INT DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,
  total_price DECIMAL(12,2) NOT NULL,

  is_taxable BOOLEAN DEFAULT false,
  tax_rate DECIMAL(5,3) DEFAULT 0,

  sort_order INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to recalculate deal totals
CREATE OR REPLACE FUNCTION calculate_deal_totals(p_deal_id UUID)
RETURNS VOID AS $$
DECLARE
  v_sale_price DECIMAL := 0;
  v_total_fees DECIMAL := 0;
  v_total_taxes DECIMAL := 0;
  v_trade_in DECIMAL := 0;
  v_total_due DECIMAL := 0;
  v_amount_paid DECIMAL := 0;
BEGIN
  -- Calculate from line items
  SELECT
    COALESCE(SUM(total_price) FILTER (WHERE item_type = 'unit'), 0),
    COALESCE(SUM(total_price) FILTER (WHERE item_type IN ('fee', 'add_on')), 0),
    COALESCE(SUM(total_price) FILTER (WHERE item_type = 'tax'), 0),
    COALESCE(SUM(ABS(total_price)) FILTER (WHERE item_type IN ('discount', 'trade_in')), 0)
  INTO v_sale_price, v_total_fees, v_total_taxes, v_trade_in
  FROM deal_line_items
  WHERE deal_id = p_deal_id;

  -- Get amount paid from payments
  SELECT COALESCE(SUM(amount), 0) INTO v_amount_paid
  FROM deal_payments
  WHERE deal_id = p_deal_id
    AND status = 'cleared'
    AND payment_type NOT IN ('refund', 'floor_plan_payoff');

  v_total_due := v_sale_price + v_total_fees + v_total_taxes - v_trade_in;

  UPDATE deals SET
    sale_price = v_sale_price,
    total_fees = v_total_fees,
    total_taxes = v_total_taxes,
    trade_in_allowance = v_trade_in,
    total_due = v_total_due,
    amount_paid = v_amount_paid,
    balance_due = v_total_due - v_amount_paid,
    updated_at = NOW()
  WHERE id = p_deal_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-recalculate on line item changes
CREATE OR REPLACE FUNCTION trigger_recalculate_deal_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM calculate_deal_totals(OLD.deal_id);
    RETURN OLD;
  ELSE
    PERFORM calculate_deal_totals(NEW.deal_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_line_items_recalculate
  AFTER INSERT OR UPDATE OR DELETE ON deal_line_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_deal_totals();

-- ============================================
-- 3. DEAL DOCUMENTS (Quotes, contracts, signed docs)
-- ============================================
CREATE TABLE deal_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE NOT NULL,

  document_type TEXT NOT NULL CHECK (document_type IN (
    'quote',
    'buyers_order',
    'bill_of_sale',
    'as_is_disclosure',
    'warranty',
    'financing_agreement',
    'trade_in_agreement',
    'other'
  )),

  title TEXT NOT NULL,
  file_url TEXT,
  file_name TEXT,
  file_size INT,
  mime_type TEXT,

  -- E-Signature fields
  requires_signature BOOLEAN DEFAULT false,
  signature_provider TEXT CHECK (signature_provider IN ('hellosign', 'docusign', 'manual')),
  signature_request_id TEXT,
  signature_status TEXT DEFAULT 'none' CHECK (signature_status IN (
    'none',
    'pending',
    'sent',
    'viewed',
    'signed',
    'declined',
    'expired'
  )),
  signed_at TIMESTAMPTZ,
  signed_document_url TEXT,

  -- Versioning
  version INT DEFAULT 1,
  is_current BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. DEAL PAYMENTS (Deposits and payments)
-- ============================================
CREATE TABLE deal_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE NOT NULL,

  payment_type TEXT NOT NULL CHECK (payment_type IN (
    'deposit',
    'partial',
    'final',
    'refund',
    'floor_plan_payoff'
  )),

  payment_method TEXT CHECK (payment_method IN (
    'cash',
    'check',
    'wire',
    'ach',
    'credit_card',
    'financing',
    'trade_in_credit'
  )),

  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,

  reference_number TEXT,
  check_number TEXT,

  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',
    'cleared',
    'bounced',
    'refunded'
  )),

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to recalculate deal totals on payment changes
CREATE TRIGGER trigger_payments_recalculate
  AFTER INSERT OR UPDATE OR DELETE ON deal_payments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_deal_totals();

-- ============================================
-- 5. DEAL ACTIVITIES (Event log/timeline)
-- ============================================
CREATE TABLE deal_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE NOT NULL,

  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'created',
    'status_changed',
    'quote_generated',
    'quote_sent',
    'line_item_added',
    'line_item_updated',
    'line_item_removed',
    'document_uploaded',
    'signature_requested',
    'document_signed',
    'payment_received',
    'payment_updated',
    'note_added',
    'assigned',
    'updated'
  )),

  title TEXT NOT NULL,
  description TEXT,

  -- Change tracking
  old_value TEXT,
  new_value TEXT,

  -- Related records
  document_id UUID REFERENCES deal_documents(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES deal_payments(id) ON DELETE SET NULL,

  performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. COMMISSION CONFIGS (Per salesperson settings)
-- ============================================
CREATE TABLE commission_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  salesperson_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,

  commission_type TEXT DEFAULT 'percent_gross' CHECK (commission_type IN (
    'percent_gross',   -- % of gross profit
    'percent_sale',    -- % of sale price
    'flat_fee',        -- Fixed amount per deal
    'tiered'           -- Based on volume or profit tiers
  )),

  base_rate DECIMAL(5,2) DEFAULT 10.00, -- Default 10%

  -- Tiered commission structure (JSON)
  tiers JSONB, -- [{min: 0, max: 10000, rate: 5}, {min: 10001, max: 25000, rate: 7.5}, ...]

  minimum_commission DECIMAL(10,2) DEFAULT 0,
  maximum_commission DECIMAL(10,2),

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(dealer_id, salesperson_id)
);

-- ============================================
-- 7. COMMISSION PAYOUTS (Per-deal commission tracking)
-- ============================================
CREATE TABLE commission_payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
  salesperson_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,

  -- Calculation basis
  sale_price DECIMAL(14,2) NOT NULL,
  cost_basis DECIMAL(14,2) DEFAULT 0, -- Acquisition cost
  gross_profit DECIMAL(14,2) DEFAULT 0,

  -- Commission details
  commission_type TEXT,
  commission_rate DECIMAL(5,2),
  commission_amount DECIMAL(10,2) NOT NULL,

  -- Payout status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',
    'approved',
    'paid'
  )),

  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(deal_id, salesperson_id)
);

-- ============================================
-- 8. INDEXES
-- ============================================

-- Deals
CREATE INDEX idx_deals_dealer ON deals(dealer_id);
CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_deals_lead ON deals(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX idx_deals_listing ON deals(listing_id) WHERE listing_id IS NOT NULL;
CREATE INDEX idx_deals_salesperson ON deals(salesperson_id) WHERE salesperson_id IS NOT NULL;
CREATE INDEX idx_deals_created ON deals(created_at DESC);
CREATE INDEX idx_deals_number ON deals(deal_number);

-- Line Items
CREATE INDEX idx_deal_line_items_deal ON deal_line_items(deal_id);
CREATE INDEX idx_deal_line_items_type ON deal_line_items(item_type);

-- Documents
CREATE INDEX idx_deal_documents_deal ON deal_documents(deal_id);
CREATE INDEX idx_deal_documents_type ON deal_documents(document_type);
CREATE INDEX idx_deal_documents_signature ON deal_documents(signature_status)
  WHERE signature_status IN ('pending', 'sent');

-- Payments
CREATE INDEX idx_deal_payments_deal ON deal_payments(deal_id);
CREATE INDEX idx_deal_payments_status ON deal_payments(status);
CREATE INDEX idx_deal_payments_date ON deal_payments(payment_date DESC);

-- Activities
CREATE INDEX idx_deal_activities_deal ON deal_activities(deal_id);
CREATE INDEX idx_deal_activities_created ON deal_activities(created_at DESC);

-- Commissions
CREATE INDEX idx_commission_configs_dealer ON commission_configs(dealer_id);
CREATE INDEX idx_commission_payouts_deal ON commission_payouts(deal_id);
CREATE INDEX idx_commission_payouts_salesperson ON commission_payouts(salesperson_id);
CREATE INDEX idx_commission_payouts_status ON commission_payouts(status);

-- ============================================
-- 9. TRIGGERS FOR TIMESTAMPS
-- ============================================

CREATE TRIGGER trigger_deals_updated
  BEFORE UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

CREATE TRIGGER trigger_deal_line_items_updated
  BEFORE UPDATE ON deal_line_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

CREATE TRIGGER trigger_deal_documents_updated
  BEFORE UPDATE ON deal_documents
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

CREATE TRIGGER trigger_deal_payments_updated
  BEFORE UPDATE ON deal_payments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

CREATE TRIGGER trigger_commission_configs_updated
  BEFORE UPDATE ON commission_configs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

CREATE TRIGGER trigger_commission_payouts_updated
  BEFORE UPDATE ON commission_payouts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

-- ============================================
-- 10. ACTIVITY LOGGING TRIGGERS
-- ============================================

-- Log deal status changes
CREATE OR REPLACE FUNCTION log_deal_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO deal_activities (deal_id, activity_type, title, old_value, new_value, performed_by)
    VALUES (
      NEW.id,
      'status_changed',
      'Deal status changed to ' || NEW.status,
      OLD.status,
      NEW.status,
      auth.uid()
    );

    -- Update timestamps based on status
    IF NEW.status = 'finalized' AND OLD.status != 'finalized' THEN
      NEW.finalized_at := NOW();
    ELSIF NEW.status = 'closed' AND OLD.status != 'closed' THEN
      NEW.closed_at := NOW();
    ELSIF NEW.status = 'lost' AND OLD.status != 'lost' THEN
      NEW.lost_at := NOW();
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_deal_status_log
  BEFORE UPDATE OF status ON deals
  FOR EACH ROW
  EXECUTE FUNCTION log_deal_status_change();

-- Log deal creation
CREATE OR REPLACE FUNCTION log_deal_creation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO deal_activities (deal_id, activity_type, title, performed_by)
  VALUES (NEW.id, 'created', 'Deal created: ' || NEW.deal_number, auth.uid());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_deal_created_log
  AFTER INSERT ON deals
  FOR EACH ROW
  EXECUTE FUNCTION log_deal_creation();

-- ============================================
-- 11. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_payouts ENABLE ROW LEVEL SECURITY;

-- Deals: Dealer-owned
CREATE POLICY "Dealers can view own deals" ON deals
  FOR SELECT USING (auth.uid() = dealer_id);

CREATE POLICY "Dealers can create deals" ON deals
  FOR INSERT WITH CHECK (auth.uid() = dealer_id);

CREATE POLICY "Dealers can update own deals" ON deals
  FOR UPDATE USING (auth.uid() = dealer_id);

CREATE POLICY "Dealers can delete own deals" ON deals
  FOR DELETE USING (auth.uid() = dealer_id);

-- Line Items: Via deal ownership
CREATE POLICY "Dealers can view deal line items" ON deal_line_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_line_items.deal_id AND deals.dealer_id = auth.uid())
  );

CREATE POLICY "Dealers can manage deal line items" ON deal_line_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_line_items.deal_id AND deals.dealer_id = auth.uid())
  );

-- Documents: Via deal ownership
CREATE POLICY "Dealers can view deal documents" ON deal_documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_documents.deal_id AND deals.dealer_id = auth.uid())
  );

CREATE POLICY "Dealers can manage deal documents" ON deal_documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_documents.deal_id AND deals.dealer_id = auth.uid())
  );

-- Payments: Via deal ownership
CREATE POLICY "Dealers can view deal payments" ON deal_payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_payments.deal_id AND deals.dealer_id = auth.uid())
  );

CREATE POLICY "Dealers can manage deal payments" ON deal_payments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_payments.deal_id AND deals.dealer_id = auth.uid())
  );

-- Activities: Via deal ownership
CREATE POLICY "Dealers can view deal activities" ON deal_activities
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_activities.deal_id AND deals.dealer_id = auth.uid())
  );

CREATE POLICY "System can create activities" ON deal_activities
  FOR INSERT WITH CHECK (true);

-- Commission Configs: Dealer-owned
CREATE POLICY "Dealers can view own commission configs" ON commission_configs
  FOR SELECT USING (auth.uid() = dealer_id);

CREATE POLICY "Dealers can manage own commission configs" ON commission_configs
  FOR ALL USING (auth.uid() = dealer_id);

-- Commission Payouts: Via deal ownership
CREATE POLICY "Dealers can view commission payouts" ON commission_payouts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM deals WHERE deals.id = commission_payouts.deal_id AND deals.dealer_id = auth.uid())
  );

CREATE POLICY "Dealers can manage commission payouts" ON commission_payouts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM deals WHERE deals.id = commission_payouts.deal_id AND deals.dealer_id = auth.uid())
  );

-- ============================================
-- 12. HELPER FUNCTIONS
-- ============================================

-- Get deal dashboard metrics
CREATE OR REPLACE FUNCTION get_deal_metrics(p_dealer_id UUID)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  WITH totals AS (
    SELECT
      COUNT(*) as total_deals,
      COUNT(*) FILTER (WHERE status NOT IN ('closed', 'lost')) as pipeline_count,
      COALESCE(SUM(total_due) FILTER (WHERE status NOT IN ('closed', 'lost')), 0) as pipeline_value,
      COUNT(*) FILTER (WHERE status = 'closed' AND closed_at >= DATE_TRUNC('month', CURRENT_DATE)) as closed_this_month,
      COALESCE(SUM(total_due) FILTER (WHERE status = 'closed' AND closed_at >= DATE_TRUNC('month', CURRENT_DATE)), 0) as revenue_this_month,
      COUNT(*) FILTER (WHERE status = 'closed') as total_closed,
      COUNT(*) FILTER (WHERE status = 'lost') as total_lost
    FROM deals
    WHERE dealer_id = p_dealer_id
  ),
  by_status AS (
    SELECT
      COUNT(*) FILTER (WHERE status = 'quote') as quote_count,
      COUNT(*) FILTER (WHERE status = 'negotiation') as negotiation_count,
      COUNT(*) FILTER (WHERE status = 'pending_approval') as pending_count,
      COUNT(*) FILTER (WHERE status = 'finalized') as finalized_count,
      COUNT(*) FILTER (WHERE status = 'closed') as closed_count
    FROM deals
    WHERE dealer_id = p_dealer_id
  )
  SELECT json_build_object(
    'totalDeals', t.total_deals,
    'pipelineCount', t.pipeline_count,
    'pipelineValue', t.pipeline_value,
    'closedThisMonth', t.closed_this_month,
    'revenueThisMonth', t.revenue_this_month,
    'conversionRate', CASE
      WHEN (t.total_closed + t.total_lost) > 0
      THEN ROUND((t.total_closed::numeric / (t.total_closed + t.total_lost) * 100), 1)
      ELSE 0
    END,
    'byStatus', json_build_object(
      'quote', bs.quote_count,
      'negotiation', bs.negotiation_count,
      'pending_approval', bs.pending_count,
      'finalized', bs.finalized_count,
      'closed', bs.closed_count
    )
  ) INTO v_result
  FROM totals t, by_status bs;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Calculate commission for a deal
CREATE OR REPLACE FUNCTION calculate_deal_commission(
  p_deal_id UUID,
  p_salesperson_id UUID
)
RETURNS DECIMAL AS $$
DECLARE
  v_deal deals%ROWTYPE;
  v_config commission_configs%ROWTYPE;
  v_cost DECIMAL;
  v_gross_profit DECIMAL;
  v_commission DECIMAL := 0;
  v_tier JSONB;
BEGIN
  -- Get deal info
  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Get commission config
  SELECT * INTO v_config
  FROM commission_configs
  WHERE dealer_id = v_deal.dealer_id
    AND salesperson_id = p_salesperson_id
    AND is_active = true;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Get cost basis from listing
  SELECT COALESCE(acquisition_cost, 0) INTO v_cost
  FROM listings WHERE id = v_deal.listing_id;

  v_gross_profit := v_deal.sale_price - v_cost;

  -- Calculate based on type
  CASE v_config.commission_type
    WHEN 'percent_gross' THEN
      v_commission := v_gross_profit * (v_config.base_rate / 100);
    WHEN 'percent_sale' THEN
      v_commission := v_deal.sale_price * (v_config.base_rate / 100);
    WHEN 'flat_fee' THEN
      v_commission := v_config.base_rate;
    WHEN 'tiered' THEN
      -- Find matching tier
      FOR v_tier IN SELECT * FROM jsonb_array_elements(v_config.tiers)
      LOOP
        IF v_gross_profit >= (v_tier->>'min')::DECIMAL
           AND (v_tier->>'max' IS NULL OR v_gross_profit <= (v_tier->>'max')::DECIMAL) THEN
          v_commission := v_gross_profit * ((v_tier->>'rate')::DECIMAL / 100);
          EXIT;
        END IF;
      END LOOP;
  END CASE;

  -- Apply min/max
  IF v_config.minimum_commission IS NOT NULL THEN
    v_commission := GREATEST(v_commission, v_config.minimum_commission);
  END IF;

  IF v_config.maximum_commission IS NOT NULL THEN
    v_commission := LEAST(v_commission, v_config.maximum_commission);
  END IF;

  RETURN ROUND(v_commission, 2);
END;
$$ LANGUAGE plpgsql;
