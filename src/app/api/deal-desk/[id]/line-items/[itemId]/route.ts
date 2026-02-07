import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateLineItemSchema } from '@/lib/validations/deals';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string; itemId: string }>;
}

// PATCH - Update line item
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, itemId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify deal belongs to user and is not closed
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

    // Verify line item exists
    const { data: existingItem } = await supabase
      .from('deal_line_items')
      .select('*')
      .eq('id', itemId)
      .eq('deal_id', id)
      .single();

    if (!existingItem) {
      return NextResponse.json({ error: 'Line item not found' }, { status: 404 });
    }

    const body = await request.json();
    const parseResult = updateLineItemSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const updateData = parseResult.data;

    // Calculate new total if quantity or unit_price changed
    const quantity = updateData.quantity ?? existingItem.quantity;
    const unitPrice = updateData.unit_price ?? existingItem.unit_price;
    const totalPrice = quantity * unitPrice;

    const { data, error } = await supabase
      .from('deal_line_items')
      .update({
        ...updateData,
        total_price: totalPrice,
      })
      .eq('id', itemId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating line item', { error });
      return NextResponse.json({ error: 'Failed to update line item' }, { status: 500 });
    }

    // Log activity
    await supabase
      .from('deal_activities')
      .insert({
        deal_id: id,
        activity_type: 'line_item_updated',
        title: `Updated line item: ${data.description}`,
        old_value: `$${existingItem.total_price.toFixed(2)}`,
        new_value: `$${totalPrice.toFixed(2)}`,
        performed_by: user.id,
      });

    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Update line item error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove line item
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, itemId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify deal belongs to user and is not closed
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

    // Get item info before deleting
    const { data: existingItem } = await supabase
      .from('deal_line_items')
      .select('description, total_price')
      .eq('id', itemId)
      .eq('deal_id', id)
      .single();

    if (!existingItem) {
      return NextResponse.json({ error: 'Line item not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('deal_line_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      logger.error('Error deleting line item', { error });
      return NextResponse.json({ error: 'Failed to delete line item' }, { status: 500 });
    }

    // Log activity
    await supabase
      .from('deal_activities')
      .insert({
        deal_id: id,
        activity_type: 'line_item_removed',
        title: `Removed line item: ${existingItem.description}`,
        old_value: `$${existingItem.total_price.toFixed(2)}`,
        performed_by: user.id,
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Delete line item error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
