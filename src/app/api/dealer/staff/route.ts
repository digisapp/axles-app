import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, rateLimitResponse } from '@/lib/security/rate-limit';
import { logger } from '@/lib/logger';
import { validateBody, ValidationError, createStaffSchema } from '@/lib/validations/api';

// GET - List dealer staff
export async function GET(request: NextRequest) {
  try {
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, {
      ...RATE_LIMITS.standard,
      prefix: 'ratelimit:dealer-staff',
    });
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is a dealer
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_dealer')
      .eq('id', user.id)
      .single();

    if (!profile?.is_dealer) {
      return NextResponse.json({ error: 'Dealer access required' }, { status: 403 });
    }

    // Get all staff for this dealer
    const { data: staff, error } = await supabase
      .from('dealer_staff')
      .select('*')
      .eq('dealer_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Mask PINs for security (show only last 2 digits)
    const maskedStaff = staff?.map(s => ({
      ...s,
      voice_pin: '**' + s.voice_pin.slice(-2),
      voice_pin_full: undefined, // Never send full PIN
    }));

    return NextResponse.json({ data: maskedStaff });
  } catch (error) {
    logger.error('Error fetching dealer staff', { error });
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 });
  }
}

// POST - Add new staff member
export async function POST(request: NextRequest) {
  try {
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, {
      ...RATE_LIMITS.standard,
      prefix: 'ratelimit:dealer-staff',
    });
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is a dealer
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_dealer')
      .eq('id', user.id)
      .single();

    if (!profile?.is_dealer) {
      return NextResponse.json({ error: 'Dealer access required' }, { status: 403 });
    }

    const body = await request.json();

    let validatedData;
    try {
      validatedData = validateBody(createStaffSchema, body);
    } catch (err) {
      if (err instanceof ValidationError) {
        return NextResponse.json(
          { error: 'Validation failed', details: err.errors },
          { status: 400 }
        );
      }
      throw err;
    }

    // Check if PIN already exists for this dealer
    const { data: existing } = await supabase
      .from('dealer_staff')
      .select('id')
      .eq('dealer_id', user.id)
      .eq('voice_pin', validatedData.voice_pin)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'This PIN is already in use. Please choose a different PIN.' },
        { status: 400 }
      );
    }

    // Create staff member
    const { data: staff, error } = await supabase
      .from('dealer_staff')
      .insert({
        dealer_id: user.id,
        name: validatedData.name,
        role: validatedData.role || 'sales',
        phone_number: validatedData.phone_number || null,
        email: validatedData.email || null,
        voice_pin: validatedData.voice_pin,
        access_level: validatedData.access_level || 'standard',
        can_view_costs: validatedData.can_view_costs || false,
        can_view_margins: validatedData.can_view_margins || false,
        can_view_all_leads: validatedData.can_view_all_leads ?? true,
        can_modify_inventory: validatedData.can_modify_inventory || false,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      data: {
        ...staff,
        voice_pin: '**' + staff.voice_pin.slice(-2),
      },
      message: 'Staff member added successfully',
    });
  } catch (error) {
    logger.error('Error creating dealer staff', { error });
    return NextResponse.json({ error: 'Failed to create staff member' }, { status: 500 });
  }
}
