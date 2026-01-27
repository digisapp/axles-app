import { NextRequest } from 'next/server';
import crypto from 'crypto';

/**
 * Verify that a request is from an internal service
 * Uses HMAC signature verification with a shared secret
 */
export function verifyInternalRequest(request: NextRequest): boolean {
  const internalSecret = process.env.INTERNAL_API_SECRET;

  // If no secret is configured, reject internal requests
  if (!internalSecret) {
    console.warn('INTERNAL_API_SECRET not configured - internal endpoints disabled');
    return false;
  }

  const signature = request.headers.get('x-internal-signature');
  const timestamp = request.headers.get('x-internal-timestamp');

  if (!signature || !timestamp) {
    return false;
  }

  // Verify timestamp is within 5 minutes to prevent replay attacks
  const now = Date.now();
  const requestTime = parseInt(timestamp, 10);

  if (isNaN(requestTime) || Math.abs(now - requestTime) > 5 * 60 * 1000) {
    return false;
  }

  // Verify HMAC signature
  const expectedSignature = crypto
    .createHmac('sha256', internalSecret)
    .update(`${timestamp}`)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Generate headers for internal API calls
 * Use this when calling internal endpoints from other services
 */
export function generateInternalHeaders(): Record<string, string> {
  const internalSecret = process.env.INTERNAL_API_SECRET;

  if (!internalSecret) {
    throw new Error('INTERNAL_API_SECRET not configured');
  }

  const timestamp = Date.now().toString();
  const signature = crypto
    .createHmac('sha256', internalSecret)
    .update(timestamp)
    .digest('hex');

  return {
    'x-internal-signature': signature,
    'x-internal-timestamp': timestamp,
  };
}

/**
 * Alternative: Verify using Supabase service role
 * For endpoints that should only be called with service role privileges
 */
export function isServiceRoleRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!authHeader || !serviceRoleKey) {
    return false;
  }

  // Check if using service role key as bearer token
  const token = authHeader.replace('Bearer ', '');
  return token === serviceRoleKey;
}
