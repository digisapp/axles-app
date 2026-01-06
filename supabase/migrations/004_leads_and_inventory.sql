-- Leads table for tracking buyer inquiries
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL, -- Dealer receiving lead
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_phone TEXT,
  message TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'won', 'lost')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  notes TEXT,
  last_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for leads
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_listing_id ON leads(listing_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);

-- RLS for leads
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Users can view leads assigned to them
CREATE POLICY "Users can view their leads"
  ON leads FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert leads for any listing (when submitting inquiry)
CREATE POLICY "Anyone can create leads"
  ON leads FOR INSERT
  WITH CHECK (true);

-- Users can update their own leads
CREATE POLICY "Users can update their leads"
  ON leads FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own leads
CREATE POLICY "Users can delete their leads"
  ON leads FOR DELETE
  USING (auth.uid() = user_id);

-- Add inventory columns to listings
ALTER TABLE listings ADD COLUMN IF NOT EXISTS stock_number TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS quantity INT DEFAULT 1;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS lot_location TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS acquired_date DATE;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS acquisition_cost DECIMAL(12,2);

-- Index for stock number lookups
CREATE INDEX IF NOT EXISTS idx_listings_stock_number ON listings(stock_number);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for leads updated_at
DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
