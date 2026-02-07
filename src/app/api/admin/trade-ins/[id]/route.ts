import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const body = await request.json();

    // Check if user is admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
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

    // Update trade-in request
    const updateData: Record<string, unknown> = {};

    if (body.status) {
      updateData.status = body.status;
    }
    if (body.offer_amount !== undefined) {
      updateData.offer_amount = body.offer_amount;
    }
    if (body.admin_notes !== undefined) {
      updateData.admin_notes = body.admin_notes;
    }
    if (body.assigned_dealer_id !== undefined) {
      updateData.assigned_dealer_id = body.assigned_dealer_id;
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
    logger.error('Error updating trade-in', { error });
    return NextResponse.json(
      { error: 'Failed to update trade-in request' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // Check if user is admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
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

    const { data, error } = await supabase
      .from('trade_in_requests')
      .select(`
        *,
        interested_listing:listings(id, title, price),
        interested_category:categories(id, name)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Error fetching trade-in', { error });
    return NextResponse.json(
      { error: 'Failed to fetch trade-in request' },
      { status: 500 }
    );
  }
}
