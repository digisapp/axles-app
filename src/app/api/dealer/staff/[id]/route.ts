import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, rateLimitResponse } from '@/lib/security/rate-limit';
import { logger } from '@/lib/logger';
import { validateBody, ValidationError, updateStaffSchema } from '@/lib/validations/api';

// GET - Get single staff member
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, {
      ...RATE_LIMITS.standard,
      prefix: 'ratelimit:dealer-staff',
    });
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: staff, error } = await supabase
      .from('dealer_staff')
      .select('*')
      .eq('id', id)
      .eq('dealer_id', user.id)
      .single();

    if (error || !staff) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        ...staff,
        voice_pin: '**' + staff.voice_pin.slice(-2),
      },
    });
  } catch (error) {
    logger.error('Error fetching staff member', { error });
    return NextResponse.json({ error: 'Failed to fetch staff member' }, { status: 500 });
  }
}

// PATCH - Update staff member
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, {
      ...RATE_LIMITS.standard,
      prefix: 'ratelimit:dealer-staff',
    });
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('dealer_staff')
      .select('id')
      .eq('id', id)
      .eq('dealer_id', user.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    const body = await request.json();

    let validatedData;
    try {
      validatedData = validateBody(updateStaffSchema, body);
    } catch (err) {
      if (err instanceof ValidationError) {
        return NextResponse.json(
          { error: 'Validation failed', details: err.errors },
          { status: 400 }
        );
      }
      throw err;
    }

    // If updating PIN, validate uniqueness
    if (validatedData.voice_pin) {
      // Check if PIN already exists for another staff member
      const { data: pinExists } = await supabase
        .from('dealer_staff')
        .select('id')
        .eq('dealer_id', user.id)
        .eq('voice_pin', validatedData.voice_pin!)
        .neq('id', id)
        .single();

      if (pinExists) {
        return NextResponse.json(
          { error: 'This PIN is already in use by another staff member' },
          { status: 400 }
        );
      }
    }

    // Build update object from validated data
    const updateData: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(validatedData)) {
      if (value !== undefined) {
        updateData[field] = value;
      }
    }
    // Also allow is_active from body (not in updateStaffSchema)
    if (body.is_active !== undefined) {
      updateData.is_active = body.is_active;
    }

    const { data: staff, error } = await supabase
      .from('dealer_staff')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      data: {
        ...staff,
        voice_pin: '**' + staff.voice_pin.slice(-2),
      },
      message: 'Staff member updated successfully',
    });
  } catch (error) {
    logger.error('Error updating staff member', { error });
    return NextResponse.json({ error: 'Failed to update staff member' }, { status: 500 });
  }
}

// DELETE - Remove staff member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, {
      ...RATE_LIMITS.standard,
      prefix: 'ratelimit:dealer-staff',
    });
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('dealer_staff')
      .delete()
      .eq('id', id)
      .eq('dealer_id', user.id);

    if (error) throw error;

    return NextResponse.json({ message: 'Staff member removed successfully' });
  } catch (error) {
    logger.error('Error deleting staff member', { error });
    return NextResponse.json({ error: 'Failed to delete staff member' }, { status: 500 });
  }
}
