import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET - List dealer staff
export async function GET() {
  try {
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
    console.error('Error fetching dealer staff:', error);
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 });
  }
}

// POST - Add new staff member
export async function POST(request: NextRequest) {
  try {
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

    // Validate required fields
    if (!body.name || !body.voice_pin) {
      return NextResponse.json(
        { error: 'Name and voice PIN are required' },
        { status: 400 }
      );
    }

    // Validate PIN format (4-6 digits)
    if (!/^\d{4,6}$/.test(body.voice_pin)) {
      return NextResponse.json(
        { error: 'Voice PIN must be 4-6 digits' },
        { status: 400 }
      );
    }

    // Check if PIN already exists for this dealer
    const { data: existing } = await supabase
      .from('dealer_staff')
      .select('id')
      .eq('dealer_id', user.id)
      .eq('voice_pin', body.voice_pin)
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
        name: body.name,
        role: body.role || 'sales',
        phone_number: body.phone_number || null,
        email: body.email || null,
        voice_pin: body.voice_pin,
        access_level: body.access_level || 'standard',
        can_view_costs: body.can_view_costs || false,
        can_view_margins: body.can_view_margins || false,
        can_view_all_leads: body.can_view_all_leads ?? true,
        can_modify_inventory: body.can_modify_inventory || false,
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
    console.error('Error creating dealer staff:', error);
    return NextResponse.json({ error: 'Failed to create staff member' }, { status: 500 });
  }
}
