import { z } from 'zod';

// Account schemas
export const createFloorPlanAccountSchema = z.object({
  provider_id: z.string().uuid('Invalid provider ID'),
  account_number: z.string().max(50).optional(),
  account_name: z.string().max(100).optional(),
  credit_limit: z.number().min(0).max(100000000, 'Credit limit too high'),
  interest_rate: z.number().min(0).max(30, 'Interest rate must be between 0 and 30%'),
  interest_type: z.enum(['daily', 'monthly']).default('daily'),
  interest_calculation: z.enum(['simple', 'compound']).default('simple'),
  curtailment_days: z.number().int().min(1).max(365).default(90),
  curtailment_percent: z.number().min(0).max(100).default(10),
  subsequent_curtailment_days: z.number().int().min(1).max(365).default(30),
  floor_fee_percent: z.number().min(0).max(10).default(0),
  payoff_fee: z.number().min(0).max(10000).default(0),
  opened_date: z.string().optional(),
});

export const updateFloorPlanAccountSchema = z.object({
  account_name: z.string().max(100).optional(),
  credit_limit: z.number().min(0).max(100000000).optional(),
  interest_rate: z.number().min(0).max(30).optional(),
  curtailment_days: z.number().int().min(1).max(365).optional(),
  curtailment_percent: z.number().min(0).max(100).optional(),
  subsequent_curtailment_days: z.number().int().min(1).max(365).optional(),
  status: z.enum(['active', 'suspended', 'closed']).optional(),
});

// Floor plan (unit) schemas
export const createFloorPlanUnitSchema = z.object({
  listing_id: z.string().uuid('Invalid listing ID'),
  account_id: z.string().uuid('Invalid account ID'),
  floor_amount: z.number().min(0).max(100000000, 'Floor amount too high'),
  floor_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  floor_reference: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

export const updateFloorPlanUnitSchema = z.object({
  floor_reference: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

// Payment schemas
export const recordPaymentSchema = z.object({
  payment_type: z.enum(['curtailment', 'interest', 'payoff', 'adjustment']),
  amount: z.number().min(0.01, 'Amount must be positive'),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  reference_number: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

export const recordPayoffSchema = z.object({
  payoff_amount: z.number().min(0.01, 'Payoff amount must be positive'),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  reference_number: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

// Alert schemas
export const dismissAlertSchema = z.object({
  action_taken: z.boolean().optional(),
});

// Query parameter schemas
export const floorPlanUnitsQuerySchema = z.object({
  status: z.enum(['active', 'paid_off', 'transferred', 'all']).default('active'),
  account_id: z.string().uuid().optional(),
  sort_by: z.enum(['days_floored', 'next_curtailment_date', 'current_balance', 'floor_date']).default('next_curtailment_date'),
  sort_order: z.enum(['asc', 'desc']).default('asc'),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const floorPlanAlertsQuerySchema = z.object({
  severity: z.enum(['critical', 'warning', 'info', 'all']).default('all'),
  is_read: z.enum(['true', 'false', 'all']).default('all'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// Type exports
export type CreateFloorPlanAccountInput = z.infer<typeof createFloorPlanAccountSchema>;
export type UpdateFloorPlanAccountInput = z.infer<typeof updateFloorPlanAccountSchema>;
export type CreateFloorPlanUnitInput = z.infer<typeof createFloorPlanUnitSchema>;
export type UpdateFloorPlanUnitInput = z.infer<typeof updateFloorPlanUnitSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type RecordPayoffInput = z.infer<typeof recordPayoffSchema>;
export type FloorPlanUnitsQuery = z.infer<typeof floorPlanUnitsQuerySchema>;
export type FloorPlanAlertsQuery = z.infer<typeof floorPlanAlertsQuerySchema>;
