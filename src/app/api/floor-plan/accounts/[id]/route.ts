import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateFloorPlanAccountSchema } from '@/lib/validations/floor-plan';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get account details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('floor_plan_accounts')
      .select(`
        *,
        provider:floor_plan_providers(*)
      `)
      .eq('id', id)
      .eq('dealer_id', user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Get floor plan summary
    const { data: floorPlans } = await supabase
      .from('listing_floor_plans')
      .select('id, current_balance, status')
      .eq('account_id', id);

    const activeUnits = floorPlans?.filter(fp => fp.status === 'active') || [];
    const totalFloored = activeUnits.reduce((sum, fp) => sum + (fp.current_balance || 0), 0);

    return NextResponse.json({
      data: {
        ...data,
        active_units_count: activeUnits.length,
        total_floored_amount: totalFloored,
      },
    });
  } catch (error) {
    logger.error('Floor plan account error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update account
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parseResult = updateFloorPlanAccountSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('floor_plan_accounts')
      .select('id')
      .eq('id', id)
      .eq('dealer_id', user.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('floor_plan_accounts')
      .update(parseResult.data)
      .eq('id', id)
      .select(`
        *,
        provider:floor_plan_providers(id, name)
      `)
      .single();

    if (error) {
      logger.error('Error updating account', { error });
      return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Floor plan account update error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Close/deactivate account
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check for active floor plans
    const { count } = await supabase
      .from('listing_floor_plans')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', id)
      .eq('status', 'active');

    if (count && count > 0) {
      return NextResponse.json(
        { error: 'Cannot close account with active floor plans. Pay off all units first.' },
        { status: 400 }
      );
    }

    // Close account (soft delete)
    const { error } = await supabase
      .from('floor_plan_accounts')
      .update({
        status: 'closed',
        closed_date: new Date().toISOString().split('T')[0],
      })
      .eq('id', id)
      .eq('dealer_id', user.id);

    if (error) {
      logger.error('Error closing account', { error });
      return NextResponse.json({ error: 'Failed to close account' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Floor plan account delete error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
