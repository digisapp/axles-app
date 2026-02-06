import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createPaymentSchema } from '@/lib/validations/deals';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - List payments for a deal
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify deal belongs to user
    const { data: deal } = await supabase
      .from('deals')
      .select('id')
      .eq('id', id)
      .eq('dealer_id', user.id)
      .single();

    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('deal_payments')
      .select('*')
      .eq('deal_id', id)
      .order('payment_date', { ascending: false });

    if (error) {
      console.error('Error fetching payments:', error);
      return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Payments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Record a payment
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify deal belongs to user
    const { data: deal } = await supabase
      .from('deals')
      .select('id, status, balance_due, floor_plan_id')
      .eq('id', id)
      .eq('dealer_id', user.id)
      .single();

    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    const body = await request.json();
    const parseResult = createPaymentSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const paymentData = parseResult.data;

    // Create payment
    const { data, error } = await supabase
      .from('deal_payments')
      .insert({
        deal_id: id,
        payment_type: paymentData.payment_type,
        payment_method: paymentData.payment_method || null,
        amount: paymentData.amount,
        payment_date: paymentData.payment_date,
        reference_number: paymentData.reference_number || null,
        check_number: paymentData.check_number || null,
        notes: paymentData.notes || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating payment:', error);
      return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
    }

    // Log activity
    await supabase
      .from('deal_activities')
      .insert({
        deal_id: id,
        activity_type: 'payment_received',
        title: `Payment recorded: $${paymentData.amount.toFixed(2)}`,
        description: `${paymentData.payment_type} via ${paymentData.payment_method || 'unknown'}`,
        payment_id: data.id,
        performed_by: user.id,
      });

    // Handle floor plan payoff
    if (paymentData.payment_type === 'floor_plan_payoff' && deal.floor_plan_id) {
      // Record payoff on the floor plan
      const today = new Date().toISOString().split('T')[0];

      await supabase
        .from('floor_plan_payments')
        .insert({
          floor_plan_id: deal.floor_plan_id,
          payment_type: 'payoff',
          amount: paymentData.amount,
          payment_date: paymentData.payment_date || today,
          reference_number: paymentData.reference_number || `Deal ${id}`,
          balance_after: 0,
          notes: `Payoff from deal closure`,
        });

      // Update floor plan status
      await supabase
        .from('listing_floor_plans')
        .update({
          status: 'paid_off',
          payoff_date: paymentData.payment_date || today,
          payoff_amount: paymentData.amount,
          payoff_reference: `Deal ${id}`,
        })
        .eq('id', deal.floor_plan_id);
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Create payment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
