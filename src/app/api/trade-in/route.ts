import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Get current user if logged in
    const { data: { user } } = await supabase.auth.getUser();

    const tradeInData = {
      user_id: user?.id || null,
      contact_name: body.contact_name,
      contact_email: body.contact_email,
      contact_phone: body.contact_phone || null,
      equipment_year: body.equipment_year || null,
      equipment_make: body.equipment_make,
      equipment_model: body.equipment_model,
      equipment_vin: body.equipment_vin || null,
      equipment_mileage: body.equipment_mileage || null,
      equipment_hours: body.equipment_hours || null,
      equipment_condition: body.equipment_condition || null,
      equipment_description: body.equipment_description || null,
      photos: body.photos || [],
      interested_listing_id: body.interested_listing_id || null,
      interested_category_id: body.interested_category_id || null,
      purchase_timeline: body.purchase_timeline || null,
      status: 'pending',
    };

    const { data, error } = await supabase
      .from('trade_in_requests')
      .insert(tradeInData)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data, message: 'Trade-in request submitted successfully' });
  } catch (error) {
    console.error('Error creating trade-in request:', error);
    return NextResponse.json(
      { error: 'Failed to submit trade-in request' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a dealer
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_dealer, is_admin')
      .eq('id', user.id)
      .single();

    let query = supabase
      .from('trade_in_requests')
      .select(`
        *,
        interested_listing:listings(id, title, price),
        interested_category:categories(id, name)
      `)
      .order('created_at', { ascending: false });

    // If dealer, show assigned requests; otherwise show own requests
    if (profile?.is_dealer || profile?.is_admin) {
      if (status) {
        query = query.eq('status', status);
      }
      // Dealers see requests assigned to them or unassigned
      query = query.or(`assigned_dealer_id.eq.${user.id},assigned_dealer_id.is.null`);
    } else {
      // Regular users see only their own requests
      query = query.eq('user_id', user.id);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching trade-in requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trade-in requests' },
      { status: 500 }
    );
  }
}
