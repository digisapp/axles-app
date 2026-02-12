import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, rateLimitResponse } from '@/lib/security/rate-limit';
import { verifyPinSchema, validateBody, ValidationError } from '@/lib/validations/api';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

/**
 * Hash a PIN using SHA-256 with salt (matches admin route)
 */
function hashPin(pin: string, salt: string): string {
  const data = `${salt}:${pin}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Securely compare PIN - supports both hashed and legacy plaintext
 * Returns true if PIN matches either the hash or plaintext (for migration)
 */
function verifyPin(inputPin: string, staff: { id: string; voice_pin?: string; pin_hash?: string }): boolean {
  // First, try hashed comparison (secure)
  if (staff.pin_hash) {
    const inputHash = hashPin(inputPin, staff.id);
    // Use timing-safe comparison
    try {
      return crypto.timingSafeEqual(
        Buffer.from(inputHash),
        Buffer.from(staff.pin_hash)
      );
    } catch {
      return false;
    }
  }

  // Legacy plaintext PINs: auto-migrate to hashed on verification
  // This provides a seamless migration path without manual intervention
  if (staff.voice_pin) {
    try {
      const matches = crypto.timingSafeEqual(
        Buffer.from(inputPin),
        Buffer.from(staff.voice_pin)
      );
      if (matches) {
        // Auto-migrate: hash the PIN and clear the plaintext
        // This happens asynchronously - don't block the response
        createClient().then(async (supabase) => {
          const hashedPin = hashPin(inputPin, staff.id);
          await supabase
            .from('dealer_staff')
            .update({ pin_hash: hashedPin, voice_pin: null })
            .eq('id', staff.id);
        }).catch((err: unknown) => {
          logger.error('PIN hash migration failed', { staffId: staff.id, error: err });
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  return false;
}

// POST - Verify staff PIN for voice authentication
// This endpoint is called by the AI voice agent to authenticate staff
export async function POST(request: NextRequest) {
  try {
    // Apply strict rate limiting to prevent brute force attacks
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, {
      ...RATE_LIMITS.pinVerify,
      prefix: 'ratelimit:pin',
    });

    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const supabase = await createClient();
    const body = await request.json();

    // Validate input with Zod
    let validatedData;
    try {
      validatedData = validateBody(verifyPinSchema, body);
    } catch (err) {
      if (err instanceof ValidationError) {
        return NextResponse.json(
          { error: 'Invalid input', details: err.errors },
          { status: 400 }
        );
      }
      throw err;
    }

    const { dealer_id, pin, name, caller_phone } = validatedData;

    // Fetch staff members for this dealer (we'll verify PIN in code for security)
    let query = supabase
      .from('dealer_staff')
      .select('*')
      .eq('dealer_id', dealer_id)
      .eq('is_active', true);

    // If name provided, filter by name (case-insensitive)
    if (name) {
      query = query.ilike('name', `%${name}%`);
    }

    // Check for lockout
    query = query.or('locked_until.is.null,locked_until.lt.now()');

    const { data: staffMembers, error } = await query;

    // Find staff member with matching PIN (verified securely)
    const staff = staffMembers?.find(s => verifyPin(pin, s));

    if (error || !staff) {
      // Log failed attempt
      await supabase.from('dealer_staff_access_logs').insert({
        dealer_id,
        caller_phone: caller_phone || null,
        auth_success: false,
        auth_method: 'pin',
        query: `PIN verification attempt`,
      });

      return NextResponse.json({
        success: false,
        message: 'Invalid PIN or access denied. Please try again.',
      });
    }

    // Check if account is locked
    if (staff.locked_until && new Date(staff.locked_until) > new Date()) {
      const minutesLeft = Math.ceil(
        (new Date(staff.locked_until).getTime() - Date.now()) / 60000
      );
      return NextResponse.json({
        success: false,
        message: `Account temporarily locked. Please try again in ${minutesLeft} minutes.`,
      });
    }

    // Success - update access tracking
    await supabase
      .from('dealer_staff')
      .update({
        last_access_at: new Date().toISOString(),
        access_count: (staff.access_count || 0) + 1,
        failed_attempts: 0,
      })
      .eq('id', staff.id);

    // Log successful access
    await supabase.from('dealer_staff_access_logs').insert({
      dealer_id,
      staff_id: staff.id,
      caller_phone: caller_phone || null,
      auth_success: true,
      auth_method: name ? 'name_and_pin' : 'pin',
      query: 'Successful authentication',
    });

    // Get dealer info for context
    const { data: dealer } = await supabase
      .from('profiles')
      .select('company_name')
      .eq('id', dealer_id)
      .single();

    // Return staff info and permissions (for AI to use)
    return NextResponse.json({
      success: true,
      message: `Access granted. Welcome back, ${staff.name}!`,
      staff: {
        id: staff.id,
        name: staff.name,
        role: staff.role,
        access_level: staff.access_level,
        permissions: {
          can_view_costs: staff.can_view_costs,
          can_view_margins: staff.can_view_margins,
          can_view_all_leads: staff.can_view_all_leads,
          can_modify_inventory: staff.can_modify_inventory,
        },
      },
      dealer: {
        id: dealer_id,
        company_name: dealer?.company_name,
      },
    });
  } catch (error) {
    logger.error('Error verifying staff PIN', { error });
    return NextResponse.json(
      { error: 'Failed to verify PIN' },
      { status: 500 }
    );
  }
}
