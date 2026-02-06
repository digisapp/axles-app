import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { recordPaymentSchema } from '@/lib/validations/floor-plan';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, rateLimitResponse } from '@/lib/security/rate-limit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST - Record a payment (curtailment, interest, or adjustment)
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
    const parseResult = recordPaymentSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { payment_type, amount, payment_date, reference_number, notes } = parseResult.data;

    // Get floor plan and verify ownership
    const { data: floorPlan } = await supabase
      .from('listing_floor_plans')
      .select(`
        id, current_balance, status, curtailments_paid,
        total_interest_accrued, total_interest_paid,
        account:floor_plan_accounts!inner(
          dealer_id, curtailment_percent, subsequent_curtailment_days
        )
      `)
      .eq('id', id)
      .eq('account.dealer_id', user.id)
      .eq('status', 'active')
      .single();

    if (!floorPlan) {
      return NextResponse.json({ error: 'Floor plan not found or not active' }, { status: 404 });
    }

    // Handle account which could be array or object from Supabase join
    type AccountData = { dealer_id: string; curtailment_percent: number; subsequent_curtailment_days: number };
    const accountData = floorPlan.account as unknown as AccountData | AccountData[] | null;
    const account = Array.isArray(accountData) ? accountData[0] : accountData;

    // Calculate new balance
    let newBalance = floorPlan.current_balance;
    let newCurtailmentsPaid = floorPlan.curtailments_paid;
    let newInterestPaid = floorPlan.total_interest_paid;
    let newNextCurtailmentDate = null;

    if (payment_type === 'curtailment') {
      newBalance = Math.max(0, floorPlan.current_balance - amount);
      newCurtailmentsPaid = floorPlan.curtailments_paid + 1;

      // Calculate next curtailment date
      const subsequentDays = account?.subsequent_curtailment_days || 30;
      const nextDate = new Date(payment_date);
      nextDate.setDate(nextDate.getDate() + subsequentDays);
      newNextCurtailmentDate = nextDate.toISOString().split('T')[0];
    } else if (payment_type === 'interest') {
      newInterestPaid = floorPlan.total_interest_paid + amount;
    } else if (payment_type === 'adjustment') {
      // Adjustment can increase or decrease balance
      newBalance = Math.max(0, floorPlan.current_balance - amount);
    }

    // Start transaction
    // Insert payment record
    const { error: paymentError } = await supabase
      .from('floor_plan_payments')
      .insert({
        floor_plan_id: id,
        payment_type,
        amount,
        payment_date,
        reference_number,
        notes,
        balance_after: newBalance,
      });

    if (paymentError) {
      console.error('Error recording payment:', paymentError);
      return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
    }

    // Update floor plan
    const updateData: Record<string, unknown> = {
      current_balance: newBalance,
    };

    if (payment_type === 'curtailment') {
      updateData.curtailments_paid = newCurtailmentsPaid;
      if (newNextCurtailmentDate) {
        updateData.next_curtailment_date = newNextCurtailmentDate;
      }
    } else if (payment_type === 'interest') {
      updateData.total_interest_paid = newInterestPaid;
    }

    const { data, error: updateError } = await supabase
      .from('listing_floor_plans')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating floor plan:', updateError);
      return NextResponse.json({ error: 'Failed to update floor plan' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data,
      payment: {
        type: payment_type,
        amount,
        balance_after: newBalance,
      },
    });
  } catch (error) {
    console.error('Floor plan payment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
