// Deal Desk Types

// Deal Status
export type DealStatus =
  | 'quote'
  | 'negotiation'
  | 'pending_approval'
  | 'finalized'
  | 'closed'
  | 'lost';

// Financing Type
export type FinancingType = 'cash' | 'financed' | 'lease';

// Trade-In Condition
export type TradeInCondition = 'excellent' | 'good' | 'fair' | 'poor';

// Buyer Address
export interface BuyerAddress {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

// Core Deal
export interface Deal {
  id: string;
  deal_number: string;
  dealer_id: string;
  lead_id?: string | null;
  listing_id?: string | null;

  // Buyer Information
  buyer_name: string;
  buyer_email?: string | null;
  buyer_phone?: string | null;
  buyer_company?: string | null;
  buyer_address?: BuyerAddress | null;

  // Status
  status: DealStatus;

  // Pricing
  sale_price: number;
  trade_in_allowance: number;
  total_fees: number;
  total_taxes: number;
  total_due: number;
  amount_paid: number;
  balance_due: number;

  // Financing
  financing_type?: FinancingType | null;
  financing_provider?: string | null;
  financing_amount?: number | null;
  financing_apr?: number | null;
  financing_term_months?: number | null;

  // Floor Plan Integration
  floor_plan_id?: string | null;
  floor_plan_payoff_amount?: number | null;

  // Trade-In
  trade_in_year?: number | null;
  trade_in_make?: string | null;
  trade_in_model?: string | null;
  trade_in_vin?: string | null;
  trade_in_mileage?: number | null;
  trade_in_condition?: TradeInCondition | null;

  // Sales Team
  salesperson_id?: string | null;
  sales_manager_id?: string | null;

  // Timestamps
  quote_sent_at?: string | null;
  quote_expires_at?: string | null;
  finalized_at?: string | null;
  closed_at?: string | null;
  lost_at?: string | null;
  lost_reason?: string | null;

  // Notes
  internal_notes?: string | null;
  special_terms?: string | null;

  created_at: string;
  updated_at: string;

  // Relations
  lead?: {
    id: string;
    buyer_name: string;
    buyer_email: string;
    buyer_phone?: string | null;
    status: string;
  } | null;
  listing?: {
    id: string;
    title: string;
    price?: number | null;
    status: string;
    stock_number?: string | null;
    year?: number | null;
    make?: string | null;
    model?: string | null;
    images?: { url: string; is_primary?: boolean }[];
  } | null;
  salesperson?: {
    id: string;
    name: string;
    email?: string | null;
  } | null;
  line_items?: DealLineItem[];
  documents?: DealDocument[];
  payments?: DealPayment[];
  activities?: DealActivity[];
}

// Line Item Type
export type LineItemType =
  | 'unit'
  | 'fee'
  | 'tax'
  | 'add_on'
  | 'discount'
  | 'trade_in';

// Deal Line Item
export interface DealLineItem {
  id: string;
  deal_id: string;
  item_type: LineItemType;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  is_taxable: boolean;
  tax_rate: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// Document Type
export type DocumentType =
  | 'quote'
  | 'buyers_order'
  | 'bill_of_sale'
  | 'as_is_disclosure'
  | 'warranty'
  | 'financing_agreement'
  | 'trade_in_agreement'
  | 'other';

// Signature Status
export type SignatureStatus =
  | 'none'
  | 'pending'
  | 'sent'
  | 'viewed'
  | 'signed'
  | 'declined'
  | 'expired';

// Signature Provider
export type SignatureProvider = 'hellosign' | 'docusign' | 'manual';

// Deal Document
export interface DealDocument {
  id: string;
  deal_id: string;
  document_type: DocumentType;
  title: string;
  file_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  requires_signature: boolean;
  signature_provider?: SignatureProvider | null;
  signature_request_id?: string | null;
  signature_status: SignatureStatus;
  signed_at?: string | null;
  signed_document_url?: string | null;
  version: number;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

// Payment Type
export type PaymentType =
  | 'deposit'
  | 'partial'
  | 'final'
  | 'refund'
  | 'floor_plan_payoff';

// Payment Method
export type PaymentMethod =
  | 'cash'
  | 'check'
  | 'wire'
  | 'ach'
  | 'credit_card'
  | 'financing'
  | 'trade_in_credit';

// Payment Status
export type PaymentStatus = 'pending' | 'cleared' | 'bounced' | 'refunded';

// Deal Payment
export interface DealPayment {
  id: string;
  deal_id: string;
  payment_type: PaymentType;
  payment_method?: PaymentMethod | null;
  amount: number;
  payment_date: string;
  reference_number?: string | null;
  check_number?: string | null;
  status: PaymentStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

// Activity Type
export type ActivityType =
  | 'created'
  | 'status_changed'
  | 'quote_generated'
  | 'quote_sent'
  | 'line_item_added'
  | 'line_item_updated'
  | 'line_item_removed'
  | 'document_uploaded'
  | 'signature_requested'
  | 'document_signed'
  | 'payment_received'
  | 'payment_updated'
  | 'note_added'
  | 'assigned'
  | 'updated';

// Deal Activity
export interface DealActivity {
  id: string;
  deal_id: string;
  activity_type: ActivityType;
  title: string;
  description?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  document_id?: string | null;
  payment_id?: string | null;
  performed_by?: string | null;
  created_at: string;

  // Relations
  performer?: {
    id: string;
    name: string;
  } | null;
}

// Commission Type
export type CommissionType =
  | 'percent_gross'
  | 'percent_sale'
  | 'flat_fee'
  | 'tiered';

// Commission Tier
export interface CommissionTier {
  min: number;
  max?: number | null;
  rate: number;
}

// Commission Config
export interface CommissionConfig {
  id: string;
  dealer_id: string;
  salesperson_id: string;
  commission_type: CommissionType;
  base_rate: number;
  tiers?: CommissionTier[] | null;
  minimum_commission: number;
  maximum_commission?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;

  // Relations
  salesperson?: {
    id: string;
    name: string;
    email?: string | null;
  } | null;
}

// Commission Payout Status
export type PayoutStatus = 'pending' | 'approved' | 'paid';

// Commission Payout
export interface CommissionPayout {
  id: string;
  deal_id: string;
  salesperson_id: string;
  sale_price: number;
  cost_basis: number;
  gross_profit: number;
  commission_type?: string | null;
  commission_rate?: number | null;
  commission_amount: number;
  status: PayoutStatus;
  approved_by?: string | null;
  approved_at?: string | null;
  paid_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;

  // Relations
  deal?: Deal;
  salesperson?: {
    id: string;
    name: string;
    email?: string | null;
  } | null;
}

// Dashboard Metrics
export interface DealDashboardMetrics {
  totalDeals: number;
  pipelineCount: number;
  pipelineValue: number;
  closedThisMonth: number;
  revenueThisMonth: number;
  conversionRate: number;
  byStatus: {
    quote: number;
    negotiation: number;
    pending_approval: number;
    finalized: number;
    closed: number;
  };
}

// Form Input Types
export interface CreateDealInput {
  lead_id?: string;
  listing_id?: string;
  buyer_name: string;
  buyer_email?: string;
  buyer_phone?: string;
  buyer_company?: string;
  buyer_address?: BuyerAddress;
  status?: DealStatus;
  salesperson_id?: string;
  internal_notes?: string;
}

export interface UpdateDealInput {
  buyer_name?: string;
  buyer_email?: string;
  buyer_phone?: string;
  buyer_company?: string;
  buyer_address?: BuyerAddress;
  status?: DealStatus;
  financing_type?: FinancingType;
  financing_provider?: string;
  financing_amount?: number;
  financing_apr?: number;
  financing_term_months?: number;
  trade_in_year?: number;
  trade_in_make?: string;
  trade_in_model?: string;
  trade_in_vin?: string;
  trade_in_mileage?: number;
  trade_in_condition?: TradeInCondition;
  trade_in_allowance?: number;
  salesperson_id?: string;
  sales_manager_id?: string;
  lost_reason?: string;
  internal_notes?: string;
  special_terms?: string;
}

export interface CreateLineItemInput {
  item_type: LineItemType;
  description: string;
  quantity?: number;
  unit_price: number;
  is_taxable?: boolean;
  tax_rate?: number;
  sort_order?: number;
}

export interface UpdateLineItemInput {
  description?: string;
  quantity?: number;
  unit_price?: number;
  is_taxable?: boolean;
  tax_rate?: number;
  sort_order?: number;
}

export interface CreatePaymentInput {
  payment_type: PaymentType;
  payment_method?: PaymentMethod;
  amount: number;
  payment_date?: string;
  reference_number?: string;
  check_number?: string;
  notes?: string;
}

export interface UpdatePaymentInput {
  status?: PaymentStatus;
  reference_number?: string;
  notes?: string;
}

export interface UploadDocumentInput {
  document_type: DocumentType;
  title: string;
  requires_signature?: boolean;
}

// API Response Types
export interface DealsResponse {
  data: Deal[];
  total: number;
  page: number;
  limit: number;
}

export interface DealDashboardResponse {
  metrics: DealDashboardMetrics;
  recentDeals: Deal[];
}

// Kanban Column Definition
export interface DealKanbanColumn {
  id: DealStatus;
  title: string;
  color: string;
  deals: Deal[];
}

// Status Display Info
export interface DealStatusInfo {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
}

export const DEAL_STATUS_INFO: Record<DealStatus, DealStatusInfo> = {
  quote: {
    label: 'Quote',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    icon: 'FileText',
  },
  negotiation: {
    label: 'Negotiation',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    icon: 'MessageSquare',
  },
  pending_approval: {
    label: 'Pending Approval',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    icon: 'Clock',
  },
  finalized: {
    label: 'Finalized',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    icon: 'CheckCircle',
  },
  closed: {
    label: 'Closed',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    icon: 'CheckCircle2',
  },
  lost: {
    label: 'Lost',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    icon: 'XCircle',
  },
};

// Pipeline Stages (for Kanban)
export const PIPELINE_STAGES: DealStatus[] = [
  'quote',
  'negotiation',
  'pending_approval',
  'finalized',
  'closed',
];
