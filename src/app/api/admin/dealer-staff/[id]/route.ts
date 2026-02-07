import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Hash a PIN using SHA-256 with salt
 */
function hashPin(pin: string, salt: string): string {
  const data = `${salt}:${pin}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generate a random 4-digit PIN
 */
function generatePin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// GET /api/admin/dealer-staff/[id] - Get specific staff member details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check authentication and admin status
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get staff member with dealer info
    const { data: staff, error } = await supabase
      .from('dealer_staff')
      .select(`
        *,
        dealer:profiles!dealer_id(
          id, email, company_name, phone
        )
      `)
      .eq('id', id)
      .single();

    if (error || !staff) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    // Get recent access logs
    const { data: accessLogs } = await supabase
      .from('dealer_staff_access_logs')
      .select('*')
      .eq('staff_id', id)
      .order('accessed_at', { ascending: false })
      .limit(20);

    // Check for PIN presence before removing sensitive data
    const hasPin = !!staff.voice_pin;
    const hasHashedPin = !!staff.pin_hash;

    // Don't expose PIN or hash to frontend
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { voice_pin: _pin, pin_hash: _hash, ...safeStaff } = staff;

    return NextResponse.json({
      data: {
        ...safeStaff,
        has_pin: hasPin,
        has_hashed_pin: hasHashedPin,
        access_logs: accessLogs || [],
      },
    });
  } catch (error) {
    logger.error('Error in GET /api/admin/dealer-staff/[id]', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/admin/dealer-staff/[id] - Update staff member (admin actions)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check authentication and admin status
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    // Handle specific admin actions
    if (body.action === 'unlock') {
      // Unlock a locked account
      updates.locked_until = null;
      updates.failed_attempts = 0;
    } else if (body.action === 'reset_pin') {
      // Generate new PIN and hash it
      const newPin = generatePin();
      updates.voice_pin = newPin;
      updates.pin_hash = hashPin(newPin, id);
      updates.failed_attempts = 0;
      updates.locked_until = null;

      // Update and return the new PIN (one-time display)
      const { data: staff, error } = await supabase
        .from('dealer_staff')
        .update(updates)
        .eq('id', id)
        .select('id, name, email')
        .single();

      if (error) {
        logger.error('Error resetting PIN', { error });
        return NextResponse.json({ error: 'Failed to reset PIN' }, { status: 500 });
      }

      return NextResponse.json({
        data: staff,
        new_pin: newPin, // One-time display
        message: `PIN reset successfully. New PIN: ${newPin}`,
      });
    } else if (body.action === 'disable') {
      updates.is_active = false;
    } else if (body.action === 'enable') {
      updates.is_active = true;
      updates.locked_until = null;
      updates.failed_attempts = 0;
    } else {
      // Regular field updates
      const allowedFields = [
        'name',
        'role',
        'email',
        'phone_number',
        'access_level',
        'can_view_costs',
        'can_view_margins',
        'can_view_all_leads',
        'can_modify_inventory',
        'is_active',
      ];

      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updates[field] = body[field];
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 });
    }

    // Perform update
    const { data: staff, error } = await supabase
      .from('dealer_staff')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        dealer:profiles!dealer_id(
          id, email, company_name
        )
      `)
      .single();

    if (error) {
      logger.error('Error updating staff', { error });
      return NextResponse.json({ error: 'Failed to update staff member' }, { status: 500 });
    }

    // Don't expose PIN - destructure to remove sensitive fields
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { voice_pin: _pin, pin_hash: _hash, ...safeStaff } = staff;

    return NextResponse.json({ data: safeStaff });
  } catch (error) {
    logger.error('Error in PATCH /api/admin/dealer-staff/[id]', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/dealer-staff/[id] - Delete staff member
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check authentication and admin status
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete staff member
    const { error } = await supabase
      .from('dealer_staff')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Error deleting staff', { error });
      return NextResponse.json({ error: 'Failed to delete staff member' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error in DELETE /api/admin/dealer-staff/[id]', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
