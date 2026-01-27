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
