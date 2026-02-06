// Floor Plan Management Types

// Floor Plan Provider (Lender)
export interface FloorPlanProvider {
  id: string;
  name: string;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  website?: string | null;
  default_interest_rate?: number | null;
  default_curtailment_days: number;
  default_curtailment_percent: number;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Floor Plan Account (Dealer's credit line with a provider)
export interface FloorPlanAccount {
  id: string;
  dealer_id: string;
  provider_id: string;
  account_number?: string | null;
  account_name?: string | null;
  credit_limit: number;
  available_credit: number;
  interest_rate: number;
  interest_type: 'daily' | 'monthly';
  interest_calculation: 'simple' | 'compound';
  curtailment_days: number;
  curtailment_percent: number;
  subsequent_curtailment_days: number;
  floor_fee_percent: number;
  payoff_fee: number;
  status: 'active' | 'suspended' | 'closed';
  opened_date?: string | null;
  closed_date?: string | null;
  created_at: string;
  updated_at: string;

  // Relations
  provider?: FloorPlanProvider;
}

// Listing Floor Plan (Per-unit tracking)
export interface ListingFloorPlan {
  id: string;
  listing_id: string;
  account_id: string;
  floor_amount: number;
  floor_date: string;
  floor_reference?: string | null;
  current_balance: number;
  total_interest_accrued: number;
  total_interest_paid: number;
  first_curtailment_date?: string | null;
  next_curtailment_date?: string | null;
  curtailments_paid: number;
  payoff_date?: string | null;
  payoff_amount?: number | null;
  payoff_reference?: string | null;
  status: 'active' | 'paid_off' | 'transferred';
  is_past_due: boolean;
  days_floored: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;

  // Relations
  listing?: {
    id: string;
    title: string;
    price: number | null;
    status: string;
    stock_number?: string | null;
    images?: { url: string; is_primary?: boolean }[];
  };
  account?: FloorPlanAccount & {
    provider?: FloorPlanProvider;
  };
  payments?: FloorPlanPayment[];
}

// Floor Plan Payment
export interface FloorPlanPayment {
  id: string;
  floor_plan_id: string;
  payment_type: 'curtailment' | 'interest' | 'payoff' | 'adjustment';
  amount: number;
  payment_date: string;
  reference_number?: string | null;
  balance_after: number;
  notes?: string | null;
  created_at: string;
}

// Floor Plan Alert
export type FloorPlanAlertType =
  | 'curtailment_upcoming'
  | 'curtailment_due'
  | 'curtailment_past_due'
  | 'high_interest'
  | 'credit_limit_warning'
  | 'aging_inventory';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface FloorPlanAlert {
  id: string;
  dealer_id: string;
  floor_plan_id?: string | null;
  alert_type: FloorPlanAlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  is_read: boolean;
  is_dismissed: boolean;
  action_taken: boolean;
  listing_title?: string | null;
  due_date?: string | null;
  amount_due?: number | null;
  created_at: string;
  read_at?: string | null;
  dismissed_at?: string | null;
}

// Dashboard Metrics
export interface FloorPlanDashboardMetrics {
  totalCreditLimit: number;
  totalAvailableCredit: number;
  totalCurrentBalance: number;
  totalFloored: number;
  creditUtilization: number;
  unitsFloored: number;
  unitsPastDue: number;
  upcomingCurtailments: number;
  unpaidInterest: number;
  monthlyInterestEstimate: number;
  alertCounts: {
    critical: number;
    warning: number;
    info: number;
  };
}

// Aging Status for display
export type AgingStatus = 'healthy' | 'warning' | 'critical';

export interface AgingInfo {
  status: AgingStatus;
  daysFloored: number;
  color: string;
  label: string;
}

// Curtailment Status for display
export interface CurtailmentInfo {
  daysUntil: number;
  isPastDue: boolean;
  status: 'ok' | 'upcoming' | 'due' | 'past_due';
  label: string;
  color: string;
}

// Form types for creating/updating
export interface CreateFloorPlanAccountInput {
  provider_id: string;
  account_number?: string;
  account_name?: string;
  credit_limit: number;
  interest_rate: number;
  interest_type?: 'daily' | 'monthly';
  interest_calculation?: 'simple' | 'compound';
  curtailment_days?: number;
  curtailment_percent?: number;
  subsequent_curtailment_days?: number;
  floor_fee_percent?: number;
  payoff_fee?: number;
  opened_date?: string;
}

export interface UpdateFloorPlanAccountInput {
  account_name?: string;
  credit_limit?: number;
  interest_rate?: number;
  curtailment_days?: number;
  curtailment_percent?: number;
  status?: 'active' | 'suspended' | 'closed';
}

export interface CreateListingFloorPlanInput {
  listing_id: string;
  account_id: string;
  floor_amount: number;
  floor_date: string;
  floor_reference?: string;
  notes?: string;
}

export interface RecordPaymentInput {
  payment_type: 'curtailment' | 'interest' | 'payoff' | 'adjustment';
  amount: number;
  payment_date: string;
  reference_number?: string;
  notes?: string;
}

// API Response types
export interface FloorPlanAccountWithStats extends FloorPlanAccount {
  provider: FloorPlanProvider;
  active_units_count: number;
  total_floored_amount: number;
}

export interface FloorPlanUnitsResponse {
  data: ListingFloorPlan[];
  total: number;
  page: number;
  limit: number;
}

export interface FloorPlanDashboardResponse {
  metrics: FloorPlanDashboardMetrics;
  recentAlerts: FloorPlanAlert[];
  upcomingCurtailments: ListingFloorPlan[];
}
