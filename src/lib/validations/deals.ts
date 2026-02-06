import { z } from 'zod';

// Enums
export const dealStatusEnum = z.enum([
  'quote',
  'negotiation',
  'pending_approval',
  'finalized',
  'closed',
  'lost',
]);

export const financingTypeEnum = z.enum(['cash', 'financed', 'lease']);

export const tradeInConditionEnum = z.enum(['excellent', 'good', 'fair', 'poor']);

export const lineItemTypeEnum = z.enum([
  'unit',
  'fee',
  'tax',
  'add_on',
  'discount',
  'trade_in',
]);

export const documentTypeEnum = z.enum([
  'quote',
  'buyers_order',
  'bill_of_sale',
  'as_is_disclosure',
  'warranty',
  'financing_agreement',
  'trade_in_agreement',
  'other',
]);

export const signatureStatusEnum = z.enum([
  'none',
  'pending',
  'sent',
  'viewed',
  'signed',
  'declined',
  'expired',
]);

export const signatureProviderEnum = z.enum(['hellosign', 'docusign', 'manual']);

export const paymentTypeEnum = z.enum([
  'deposit',
  'partial',
  'final',
  'refund',
  'floor_plan_payoff',
]);

export const paymentMethodEnum = z.enum([
  'cash',
  'check',
  'wire',
  'ach',
  'credit_card',
  'financing',
  'trade_in_credit',
]);

export const paymentStatusEnum = z.enum(['pending', 'cleared', 'bounced', 'refunded']);

export const payoutStatusEnum = z.enum(['pending', 'approved', 'paid']);

export const commissionTypeEnum = z.enum([
  'percent_gross',
  'percent_sale',
  'flat_fee',
  'tiered',
]);

// Buyer Address Schema
export const buyerAddressSchema = z.object({
  street: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(50).optional(),
  zip: z.string().max(20).optional(),
  country: z.string().max(50).optional(),
});

// Deal Schemas
export const createDealSchema = z.object({
  lead_id: z.string().uuid('Invalid lead ID').optional(),
  listing_id: z.string().uuid('Invalid listing ID').optional(),
  buyer_name: z.string().min(1, 'Buyer name is required').max(200),
  buyer_email: z.string().email('Invalid email').max(200).optional().or(z.literal('')),
  buyer_phone: z.string().max(30).optional(),
  buyer_company: z.string().max(200).optional(),
  buyer_address: buyerAddressSchema.optional(),
  status: dealStatusEnum.default('quote'),
  salesperson_id: z.string().uuid('Invalid salesperson ID').optional(),
  internal_notes: z.string().max(5000).optional(),
});

export const updateDealSchema = z.object({
  buyer_name: z.string().min(1).max(200).optional(),
  buyer_email: z.string().email('Invalid email').max(200).optional().or(z.literal('')),
  buyer_phone: z.string().max(30).optional(),
  buyer_company: z.string().max(200).optional(),
  buyer_address: buyerAddressSchema.optional(),
  status: dealStatusEnum.optional(),
  financing_type: financingTypeEnum.optional().nullable(),
  financing_provider: z.string().max(200).optional().nullable(),
  financing_amount: z.number().min(0).max(100000000).optional().nullable(),
  financing_apr: z.number().min(0).max(50).optional().nullable(),
  financing_term_months: z.number().int().min(1).max(360).optional().nullable(),
  trade_in_year: z.number().int().min(1900).max(2100).optional().nullable(),
  trade_in_make: z.string().max(100).optional().nullable(),
  trade_in_model: z.string().max(100).optional().nullable(),
  trade_in_vin: z.string().max(17).optional().nullable(),
  trade_in_mileage: z.number().int().min(0).max(10000000).optional().nullable(),
  trade_in_condition: tradeInConditionEnum.optional().nullable(),
  trade_in_allowance: z.number().min(0).max(10000000).optional(),
  salesperson_id: z.string().uuid().optional().nullable(),
  sales_manager_id: z.string().uuid().optional().nullable(),
  lost_reason: z.string().max(500).optional(),
  internal_notes: z.string().max(5000).optional(),
  special_terms: z.string().max(5000).optional(),
  quote_expires_at: z.string().datetime().optional().nullable(),
});

// Line Item Schemas
export const createLineItemSchema = z.object({
  item_type: lineItemTypeEnum,
  description: z.string().min(1, 'Description is required').max(500),
  quantity: z.number().int().min(1).default(1),
  unit_price: z.number().min(-10000000).max(10000000),
  is_taxable: z.boolean().default(false),
  tax_rate: z.number().min(0).max(50).default(0),
  sort_order: z.number().int().min(0).default(0),
});

export const updateLineItemSchema = z.object({
  description: z.string().min(1).max(500).optional(),
  quantity: z.number().int().min(1).optional(),
  unit_price: z.number().min(-10000000).max(10000000).optional(),
  is_taxable: z.boolean().optional(),
  tax_rate: z.number().min(0).max(50).optional(),
  sort_order: z.number().int().min(0).optional(),
});

// Payment Schemas
export const createPaymentSchema = z.object({
  payment_type: paymentTypeEnum,
  payment_method: paymentMethodEnum.optional(),
  amount: z.number().min(0.01, 'Amount must be positive').max(100000000),
  payment_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .default(() => new Date().toISOString().split('T')[0]),
  reference_number: z.string().max(100).optional(),
  check_number: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
});

export const updatePaymentSchema = z.object({
  status: paymentStatusEnum.optional(),
  reference_number: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

// Document Schemas
export const uploadDocumentSchema = z.object({
  document_type: documentTypeEnum,
  title: z.string().min(1, 'Title is required').max(200),
  requires_signature: z.boolean().default(false),
});

export const requestSignatureSchema = z.object({
  signature_provider: signatureProviderEnum.default('hellosign'),
  signer_email: z.string().email('Valid signer email is required'),
  signer_name: z.string().min(1, 'Signer name is required').max(200),
  message: z.string().max(1000).optional(),
});

// Quote Schemas
export const generateQuoteSchema = z.object({
  include_terms: z.boolean().default(true),
  expiration_days: z.number().int().min(1).max(90).default(30),
});

export const sendQuoteSchema = z.object({
  recipient_email: z.string().email('Valid email is required'),
  recipient_name: z.string().min(1).max(200),
  message: z.string().max(2000).optional(),
  cc_emails: z.array(z.string().email()).max(5).optional(),
});

// Commission Schemas
export const commissionTierSchema = z.object({
  min: z.number().min(0),
  max: z.number().min(0).optional().nullable(),
  rate: z.number().min(0).max(100),
});

export const createCommissionConfigSchema = z.object({
  salesperson_id: z.string().uuid('Invalid salesperson ID'),
  commission_type: commissionTypeEnum.default('percent_gross'),
  base_rate: z.number().min(0).max(100).default(10),
  tiers: z.array(commissionTierSchema).optional(),
  minimum_commission: z.number().min(0).default(0),
  maximum_commission: z.number().min(0).optional().nullable(),
});

export const updateCommissionConfigSchema = z.object({
  commission_type: commissionTypeEnum.optional(),
  base_rate: z.number().min(0).max(100).optional(),
  tiers: z.array(commissionTierSchema).optional().nullable(),
  minimum_commission: z.number().min(0).optional(),
  maximum_commission: z.number().min(0).optional().nullable(),
  is_active: z.boolean().optional(),
});

export const updatePayoutStatusSchema = z.object({
  status: payoutStatusEnum,
  notes: z.string().max(500).optional(),
});

// Query Schemas
export const dealsQuerySchema = z.object({
  status: z
    .enum(['quote', 'negotiation', 'pending_approval', 'finalized', 'closed', 'lost', 'all', 'pipeline'])
    .default('all'),
  search: z.string().max(100).optional(),
  salesperson_id: z.string().uuid().optional(),
  listing_id: z.string().uuid().optional(),
  sort_by: z
    .enum(['created_at', 'updated_at', 'total_due', 'deal_number', 'buyer_name'])
    .default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const activitiesQuerySchema = z.object({
  activity_type: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// Type exports
export type CreateDealInput = z.infer<typeof createDealSchema>;
export type UpdateDealInput = z.infer<typeof updateDealSchema>;
export type CreateLineItemInput = z.infer<typeof createLineItemSchema>;
export type UpdateLineItemInput = z.infer<typeof updateLineItemSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
export type RequestSignatureInput = z.infer<typeof requestSignatureSchema>;
export type GenerateQuoteInput = z.infer<typeof generateQuoteSchema>;
export type SendQuoteInput = z.infer<typeof sendQuoteSchema>;
export type CreateCommissionConfigInput = z.infer<typeof createCommissionConfigSchema>;
export type UpdateCommissionConfigInput = z.infer<typeof updateCommissionConfigSchema>;
export type DealsQuery = z.infer<typeof dealsQuerySchema>;
export type ActivitiesQuery = z.infer<typeof activitiesQuerySchema>;
