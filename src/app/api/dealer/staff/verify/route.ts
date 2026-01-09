import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST - Verify staff PIN for voice authentication
// This endpoint is called by the AI voice agent to authenticate staff
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { dealer_id, pin, name, caller_phone } = body;

    // Validate required fields
    if (!dealer_id || !pin) {
      return NextResponse.json(
        { error: 'Dealer ID and PIN are required' },
        { status: 400 }
      );
    }

    // Build query to find matching staff
    let query = supabase
      .from('dealer_staff')
      .select('*')
      .eq('dealer_id', dealer_id)
      .eq('voice_pin', pin)
      .eq('is_active', true);

    // If name provided, match it (case-insensitive)
    if (name) {
      query = query.ilike('name', `%${name}%`);
    }

    // Check for lockout
    query = query.or('locked_until.is.null,locked_until.lt.now()');

    const { data: staff, error } = await query.single();

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
    console.error('Error verifying staff PIN:', error);
    return NextResponse.json(
      { error: 'Failed to verify PIN' },
      { status: 500 }
    );
  }
}
