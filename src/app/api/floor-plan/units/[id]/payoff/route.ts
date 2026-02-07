import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { recordPayoffSchema } from '@/lib/validations/floor-plan';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, rateLimitResponse } from '@/lib/security/rate-limit';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST - Record a payoff (complete payoff of floor plan)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, {
      ...RATE_LIMITS.standard,
      prefix: 'ratelimit:floor-plan',
    });

    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const body = await request.json();
    const parseResult = recordPayoffSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { payoff_amount, payment_date, reference_number, notes } = parseResult.data;

    // Get floor plan and verify ownership
    const { data: floorPlan } = await supabase
      .from('listing_floor_plans')
      .select(`
        id, current_balance, status, listing_id,
        total_interest_accrued, total_interest_paid,
        account:floor_plan_accounts!inner(dealer_id, payoff_fee)
      `)
      .eq('id', id)
      .eq('account.dealer_id', user.id)
      .eq('status', 'active')
      .single();

    if (!floorPlan) {
      return NextResponse.json({ error: 'Floor plan not found or not active' }, { status: 404 });
    }

    // Insert payoff payment record
    const { error: paymentError } = await supabase
      .from('floor_plan_payments')
      .insert({
        floor_plan_id: id,
        payment_type: 'payoff',
        amount: payoff_amount,
        payment_date,
        reference_number,
        notes,
        balance_after: 0,
      });

    if (paymentError) {
      logger.error('Error recording payoff payment', { error: paymentError });
      return NextResponse.json({ error: 'Failed to record payoff' }, { status: 500 });
    }

    // Update floor plan to paid off status
    const { data, error: updateError } = await supabase
      .from('listing_floor_plans')
      .update({
        status: 'paid_off',
        current_balance: 0,
        payoff_date: payment_date,
        payoff_amount,
        payoff_reference: reference_number,
        is_past_due: false,
      })
      .eq('id', id)
      .select(`
        *,
        listing:listings(id, title, status)
      `)
      .single();

    if (updateError) {
      logger.error('Error updating floor plan to paid off', { error: updateError });
      return NextResponse.json({ error: 'Failed to complete payoff' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Unit successfully paid off',
    });
  } catch (error) {
    logger.error('Floor plan payoff error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
