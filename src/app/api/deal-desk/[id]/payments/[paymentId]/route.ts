import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updatePaymentSchema } from '@/lib/validations/deals';

interface RouteParams {
  params: Promise<{ id: string; paymentId: string }>;
}

// PATCH - Update payment status
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, paymentId } = await params;
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

    // Verify payment exists
    const { data: existingPayment } = await supabase
      .from('deal_payments')
      .select('*')
      .eq('id', paymentId)
      .eq('deal_id', id)
      .single();

    if (!existingPayment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const body = await request.json();
    const parseResult = updatePaymentSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const updateData = parseResult.data;

    const { data, error } = await supabase
      .from('deal_payments')
      .update(updateData)
      .eq('id', paymentId)
      .select()
      .single();

    if (error) {
      console.error('Error updating payment:', error);
      return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
    }

    // Log activity if status changed
    if (updateData.status && updateData.status !== existingPayment.status) {
      await supabase
        .from('deal_activities')
        .insert({
          deal_id: id,
          activity_type: 'payment_updated',
          title: `Payment status updated`,
          old_value: existingPayment.status,
          new_value: updateData.status,
          payment_id: paymentId,
          performed_by: user.id,
        });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Update payment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove payment
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, paymentId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify deal belongs to user
    const { data: deal } = await supabase
      .from('deals')
      .select('id, status')
      .eq('id', id)
      .eq('dealer_id', user.id)
      .single();

    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    if (deal.status === 'closed') {
      return NextResponse.json({ error: 'Cannot modify closed deals' }, { status: 400 });
    }

    // Get payment info before deleting
    const { data: existingPayment } = await supabase
      .from('deal_payments')
      .select('amount, payment_type, status')
      .eq('id', paymentId)
      .eq('deal_id', id)
      .single();

    if (!existingPayment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Don't allow deleting cleared payments
    if (existingPayment.status === 'cleared') {
      return NextResponse.json(
        { error: 'Cannot delete cleared payments. Create a refund instead.' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('deal_payments')
      .delete()
      .eq('id', paymentId);

    if (error) {
      console.error('Error deleting payment:', error);
      return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete payment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
