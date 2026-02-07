import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateFloorPlanUnitSchema } from '@/lib/validations/floor-plan';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get floor plan details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('listing_floor_plans')
      .select(`
        *,
        listing:listings(id, title, price, status, stock_number,
          images:listing_images(url, is_primary)
        ),
        account:floor_plan_accounts!inner(
          *,
          dealer_id,
          provider:floor_plan_providers(*)
        ),
        payments:floor_plan_payments(*)
      `)
      .eq('id', id)
      .eq('account.dealer_id', user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Floor plan not found' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Floor plan unit error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update floor plan
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parseResult = updateFloorPlanUnitSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    // Verify ownership via account
    const { data: existing } = await supabase
      .from('listing_floor_plans')
      .select(`
        id,
        account:floor_plan_accounts!inner(dealer_id)
      `)
      .eq('id', id)
      .eq('account.dealer_id', user.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Floor plan not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('listing_floor_plans')
      .update(parseResult.data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating floor plan', { error });
      return NextResponse.json({ error: 'Failed to update floor plan' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Floor plan update error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
