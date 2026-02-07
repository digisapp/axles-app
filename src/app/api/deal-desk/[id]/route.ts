import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateDealSchema } from '@/lib/validations/deals';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get single deal with all relations
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: deal, error } = await supabase
      .from('deals')
      .select(`
        *,
        lead:leads(id, buyer_name, buyer_email, buyer_phone, status, message),
        listing:listings(id, title, price, status, stock_number, year, make, model, vin, mileage, hours,
          images:listing_images(url, is_primary, sort_order),
          acquisition_cost
        ),
        salesperson:profiles!deals_salesperson_id_fkey(id, name, email),
        sales_manager:profiles!deals_sales_manager_id_fkey(id, name, email),
        floor_plan:listing_floor_plans(id, current_balance, floor_amount, days_floored),
        line_items:deal_line_items(*, order:sort_order.asc),
        documents:deal_documents(*),
        payments:deal_payments(*),
        activities:deal_activities(*, performer:profiles!deal_activities_performed_by_fkey(id, name))
      `)
      .eq('id', id)
      .eq('dealer_id', user.id)
      .single();

    if (error || !deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    return NextResponse.json({ data: deal });
  } catch (error) {
    logger.error('Get deal error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update deal
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify deal exists and belongs to user
    const { data: existingDeal } = await supabase
      .from('deals')
      .select('id, status')
      .eq('id', id)
      .eq('dealer_id', user.id)
      .single();

    if (!existingDeal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    const body = await request.json();
    const parseResult = updateDealSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const updateData = parseResult.data;

    // Don't allow updating certain fields on closed or lost deals
    if (existingDeal.status === 'closed' || existingDeal.status === 'lost') {
      if (updateData.status && updateData.status !== existingDeal.status) {
        // Allow reopening, but nothing else
        const allowedStatuses = ['quote', 'negotiation'];
        if (!allowedStatuses.includes(updateData.status)) {
          return NextResponse.json(
            { error: 'Cannot modify closed or lost deal' },
            { status: 400 }
          );
        }
      }
    }

    const { data: deal, error } = await supabase
      .from('deals')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        lead:leads(id, buyer_name, buyer_email),
        listing:listings(id, title, price, stock_number),
        salesperson:profiles!deals_salesperson_id_fkey(id, name)
      `)
      .single();

    if (error) {
      logger.error('Update deal error', { error });
      return NextResponse.json({ error: 'Failed to update deal' }, { status: 500 });
    }

    return NextResponse.json({ data: deal });
  } catch (error) {
    logger.error('Update deal error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete deal
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify deal exists and belongs to user
    const { data: existingDeal } = await supabase
      .from('deals')
      .select('id, status')
      .eq('id', id)
      .eq('dealer_id', user.id)
      .single();

    if (!existingDeal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    // Don't allow deleting closed deals
    if (existingDeal.status === 'closed') {
      return NextResponse.json(
        { error: 'Cannot delete closed deals' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('deals')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Delete deal error', { error });
      return NextResponse.json({ error: 'Failed to delete deal' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Delete deal error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
