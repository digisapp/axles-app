import { z } from 'zod';

// Common validation schemas

export const uuidSchema = z.string().uuid('Invalid ID format');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// Listing validation
export const createListingSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200, 'Title too long'),
  description: z.string().max(10000, 'Description too long').optional(),
  price: z.number().min(0, 'Price cannot be negative').max(100000000, 'Price too high').optional().nullable(),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 2).optional().nullable(),
  make: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  vin: z.string().max(17).optional().nullable(),
  mileage: z.number().int().min(0).max(10000000).optional().nullable(),
  hours: z.number().int().min(0).max(1000000).optional().nullable(),
  condition: z.enum(['new', 'excellent', 'good', 'fair', 'salvage']).optional().nullable(),
  category_id: uuidSchema.optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  status: z.enum(['draft', 'active', 'sold', 'expired']).default('draft'),
  industries: z.array(uuidSchema).optional(),
});

export const updateListingSchema = createListingSchema.partial();

// Lead validation
export const createLeadSchema = z.object({
  listing_id: uuidSchema,
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  email: z.string().email('Invalid email address').optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  message: z.string().max(2000, 'Message too long').optional().nullable(),
  source: z.string().max(50).optional(),
}).refine(
  (data) => data.email || data.phone,
  { message: 'Either email or phone is required' }
);

export const updateLeadSchema = z.object({
  status: z.enum(['new', 'contacted', 'qualified', 'negotiating', 'won', 'lost']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  notes: z.string().max(5000).optional().nullable(),
});

// Message validation
export const createMessageSchema = z.object({
  listing_id: uuidSchema,
  recipient_id: uuidSchema,
  content: z.string().min(1, 'Message cannot be empty').max(5000, 'Message too long'),
});

// Staff PIN validation
export const verifyPinSchema = z.object({
  dealer_id: uuidSchema,
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4-6 digits'),
  name: z.string().max(100).optional(),
  caller_phone: z.string().max(20).optional(),
});

// Conversation ID validation (format: listingId-userId)
export const conversationIdSchema = z.string().refine(
  (val) => {
    const parts = val.split('-');
    // UUID format: 8-4-4-4-12 characters
    // So conversationId should have at least 10 parts (5 for each UUID)
    if (parts.length < 10) return false;

    // Reconstruct UUIDs
    const listingId = parts.slice(0, 5).join('-');
    const userId = parts.slice(5, 10).join('-');

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(listingId) && uuidRegex.test(userId);
  },
  { message: 'Invalid conversation ID format' }
);

// Helper to parse conversation ID
export function parseConversationId(conversationId: string): { listingId: string; userId: string } | null {
  const parts = conversationId.split('-');
  if (parts.length < 10) return null;

  const listingId = parts.slice(0, 5).join('-');
  const userId = parts.slice(5, 10).join('-');

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(listingId) || !uuidRegex.test(userId)) return null;

  return { listingId, userId };
}

// Trade-in validation
export const tradeInSchema = z.object({
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1),
  make: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  vin: z.string().max(17).optional(),
  mileage: z.number().int().min(0).max(10000000).optional(),
  condition: z.enum(['excellent', 'good', 'fair', 'poor']),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
});

// AI Search query validation
export const aiSearchSchema = z.object({
  query: z.string().min(1, 'Search query is required').max(500, 'Query too long'),
  context: z.object({
    category: z.string().optional(),
    priceRange: z.object({
      min: z.number().optional(),
      max: z.number().optional(),
    }).optional(),
  }).optional(),
});

// Stripe checkout validation
export const stripeCheckoutSchema = z.object({
  product: z.enum(['featured_week', 'featured_month', 'bump', 'dealer_pro_monthly', 'dealer_pro_yearly']),
  listingId: z.string().uuid().optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

// Chat message validation
export const chatMessageSchema = z.object({
  dealerId: z.string().uuid(),
  message: z.string().min(1, 'Message is required').max(5000, 'Message too long'),
  conversationId: z.string().optional(),
  chatSettings: z.record(z.string(), z.unknown()).optional(),
});

// Chat lead capture validation
export const chatLeadSchema = z.object({
  dealerId: z.string().uuid(),
  conversationId: z.string().optional(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
});

// Favorite validation
export const favoriteSchema = z.object({
  listing_id: z.string().uuid(),
});

// Saved search validation
export const savedSearchSchema = z.object({
  name: z.string().min(1).max(100),
  query: z.string().max(500).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  notify_email: z.boolean().optional(),
  notify_frequency: z.string().max(50).optional(),
});

// Dealer staff validation
export const createStaffSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().optional().nullable(),
  phone_number: z.string().max(20).optional().nullable(),
  role: z.string().max(50).optional(),
  voice_pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4-6 digits'),
  access_level: z.string().max(50).optional(),
  can_view_costs: z.boolean().optional(),
  can_view_margins: z.boolean().optional(),
  can_view_all_leads: z.boolean().optional(),
  can_modify_inventory: z.boolean().optional(),
});

export const updateStaffSchema = createStaffSchema.partial();

// Dealer voice agent validation
export const voiceAgentSchema = z.object({
  agent_name: z.string().min(1).max(100).optional(),
  business_name: z.string().max(200).optional(),
  business_description: z.string().max(5000).optional(),
  greeting: z.string().max(500).optional(),
  instructions: z.string().max(5000).optional(),
  voice: z.string().max(50).optional(),
  is_active: z.boolean().optional(),
  business_hours: z.record(z.string(), z.unknown()).optional().nullable(),
  after_hours_message: z.string().max(500).optional(),
  can_search_inventory: z.boolean().optional(),
  can_capture_leads: z.boolean().optional(),
  can_transfer_calls: z.boolean().optional(),
  transfer_phone_number: z.string().max(20).optional().nullable(),
});

// Admin dealer action validation
export const adminDealerActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  rejection_reason: z.string().max(1000).optional(),
});

// Admin user action validation
export const adminUserActionSchema = z.object({
  action: z.enum(['suspend', 'unsuspend', 'make_admin', 'remove_admin']),
  reason: z.string().max(1000).optional(),
});

// Admin manufacturer validation
export const manufacturerSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).optional(),
  logo_url: z.string().url().optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  short_description: z.string().max(500).optional().nullable(),
  website: z.string().url().optional().nullable(),
  country: z.string().max(100).optional(),
  headquarters: z.string().max(200).optional().nullable(),
  founded_year: z.number().int().min(1800).max(2100).optional().nullable(),
  equipment_types: z.array(z.string()).optional(),
  canonical_name: z.string().min(1).max(100),
  name_variations: z.array(z.string()).optional(),
  is_featured: z.boolean().optional(),
  feature_tier: z.string().max(50).optional(),
  feature_expires_at: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
});

// Trade-in offer validation
export const tradeInOfferSchema = z.object({
  offer_amount: z.number().min(0),
  message: z.string().max(5000).optional(),
  email: z.string().email(),
});

// Listing images validation
export const listingImagesSchema = z.object({
  images: z.array(z.object({
    url: z.string().url(),
    thumbnail_url: z.string().url().optional().nullable(),
    is_primary: z.boolean().optional(),
    ai_analysis: z.string().optional().nullable(),
  })).min(1),
});

export const updateImagesOrderSchema = z.object({
  images: z.array(z.object({
    id: z.string().uuid(),
    is_primary: z.boolean().optional(),
    sort_order: z.number().int().min(0).optional(),
  })).min(1),
});

// Conversation reply validation
export const conversationReplySchema = z.object({
  message: z.string().min(1, 'Reply cannot be empty').max(5000, 'Reply too long'),
});

// Dashboard lead creation (different from public createLeadSchema)
export const dashboardCreateLeadSchema = z.object({
  listing_id: uuidSchema.optional(),
  user_id: uuidSchema,
  buyer_name: z.string().min(1, 'Name is required').max(100),
  buyer_email: z.string().email('Invalid email address'),
  buyer_phone: z.string().max(20).optional().nullable(),
  message: z.string().max(2000).optional().nullable(),
});

// AI lead update validation
export const aiLeadUpdateSchema = z.object({
  leadId: z.string().uuid(),
  status: z.enum(['new', 'contacted', 'qualified', 'converted', 'lost']).optional(),
  notes: z.string().max(5000).optional(),
});

// AI lead notification validation (internal)
export const aiLeadNotificationSchema = z.object({
  dealerId: z.string().uuid(),
  leadId: z.string().uuid(),
});

// Trade-in request validation
export const tradeInRequestSchema = z.object({
  contact_name: z.string().min(1).max(100),
  contact_email: z.string().email(),
  contact_phone: z.string().max(20).optional().nullable(),
  equipment_year: z.number().int().min(1900).max(new Date().getFullYear() + 1).optional().nullable(),
  equipment_make: z.string().min(1).max(100),
  equipment_model: z.string().min(1).max(100),
  equipment_vin: z.string().max(17).optional().nullable(),
  equipment_mileage: z.number().int().min(0).optional().nullable(),
  equipment_hours: z.number().int().min(0).optional().nullable(),
  equipment_condition: z.enum(['excellent', 'good', 'fair', 'poor']).optional().nullable(),
  equipment_description: z.string().max(5000).optional().nullable(),
  photos: z.array(z.string().url()).optional(),
  interested_listing_id: uuidSchema.optional().nullable(),
  interested_category_id: uuidSchema.optional().nullable(),
  purchase_timeline: z.string().max(100).optional().nullable(),
});

// Admin voice agent create (includes dealer_id)
export const adminVoiceAgentCreateSchema = z.object({
  dealer_id: z.string().uuid(),
  phone_number: z.string().max(20).optional().nullable(),
  phone_number_id: z.string().max(100).optional().nullable(),
  agent_name: z.string().max(100).optional(),
  voice: z.string().max(50).optional(),
  greeting: z.string().max(500).optional(),
  instructions: z.string().max(5000).optional().nullable(),
  business_name: z.string().max(200).optional(),
  business_description: z.string().max(5000).optional().nullable(),
  business_hours: z.record(z.string(), z.unknown()).optional().nullable(),
  after_hours_message: z.string().max(500).optional().nullable(),
  can_search_inventory: z.boolean().optional(),
  can_capture_leads: z.boolean().optional(),
  can_transfer_calls: z.boolean().optional(),
  transfer_phone_number: z.string().max(20).optional().nullable(),
  plan_tier: z.string().max(50).optional(),
  minutes_included: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

// Admin voice agent update (all fields optional, including admin-only fields)
export const adminVoiceAgentUpdateSchema = z.object({
  phone_number: z.string().max(20).optional().nullable(),
  phone_number_id: z.string().max(100).optional().nullable(),
  agent_name: z.string().max(100).optional(),
  voice: z.string().max(50).optional(),
  greeting: z.string().max(500).optional(),
  instructions: z.string().max(5000).optional().nullable(),
  business_name: z.string().max(200).optional(),
  business_description: z.string().max(5000).optional().nullable(),
  business_hours: z.record(z.string(), z.unknown()).optional().nullable(),
  after_hours_message: z.string().max(500).optional().nullable(),
  can_search_inventory: z.boolean().optional(),
  can_capture_leads: z.boolean().optional(),
  can_transfer_calls: z.boolean().optional(),
  transfer_phone_number: z.string().max(20).optional().nullable(),
  plan_tier: z.string().max(50).optional(),
  minutes_included: z.number().int().min(0).optional(),
  minutes_used: z.number().int().min(0).optional(),
  billing_cycle_start: z.string().optional().nullable(),
  stripe_subscription_id: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
  is_provisioned: z.boolean().optional(),
  activated_at: z.string().optional().nullable(),
});

// Admin dealer staff PATCH (action-based or field updates)
export const adminStaffPatchSchema = z.object({
  action: z.enum(['unlock', 'reset_pin', 'disable', 'enable']).optional(),
  name: z.string().min(1).max(100).optional(),
  role: z.string().max(50).optional(),
  email: z.string().email().optional().nullable(),
  phone_number: z.string().max(20).optional().nullable(),
  access_level: z.string().max(50).optional(),
  can_view_costs: z.boolean().optional(),
  can_view_margins: z.boolean().optional(),
  can_view_all_leads: z.boolean().optional(),
  can_modify_inventory: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

/**
 * Helper to validate request body with Zod schema
 * Returns parsed data or throws formatted error
 */
export function validateBody<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errors = result.error.issues.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    throw new ValidationError('Validation failed', errors);
  }

  return result.data;
}

export class ValidationError extends Error {
  public errors: Array<{ field: string; message: string }>;

  constructor(message: string, errors: Array<{ field: string; message: string }>) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}
