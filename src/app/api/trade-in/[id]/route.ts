import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('trade_in_requests')
      .select(`
        *,
        interested_listing:listings(id, title, price, images:listing_images(url, is_primary)),
        interested_category:categories(id, name)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    // Check authorization
    if (data.user_id !== user.id && data.assigned_dealer_id !== user.id) {
      // Check if admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (!profile?.is_admin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Error fetching trade-in request', { error });
    return NextResponse.json(
      { error: 'Failed to fetch trade-in request' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is dealer/admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_dealer, is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_dealer && !profile?.is_admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Allowed fields for dealers to update
    if (body.status) updateData.status = body.status;
    if (body.estimated_value !== undefined) updateData.estimated_value = body.estimated_value;
    if (body.valuation_notes !== undefined) updateData.valuation_notes = body.valuation_notes;
    if (body.assigned_dealer_id !== undefined) updateData.assigned_dealer_id = body.assigned_dealer_id;

    // Track timestamps
    if (body.status === 'valued') {
      updateData.valued_at = new Date().toISOString();
    }
    if (['valued', 'accepted', 'rejected'].includes(body.status)) {
      updateData.responded_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('trade_in_requests')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Error updating trade-in request', { error });
    return NextResponse.json(
      { error: 'Failed to update trade-in request' },
      { status: 500 }
    );
  }
}
