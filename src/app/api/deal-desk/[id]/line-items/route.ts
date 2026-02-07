import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createLineItemSchema } from '@/lib/validations/deals';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, rateLimitResponse } from '@/lib/security/rate-limit';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - List line items for a deal
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, {
      ...RATE_LIMITS.standard,
      prefix: 'ratelimit:deal-desk-line-items',
    });
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

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
      .from('deal_line_items')
      .select('*')
      .eq('deal_id', id)
      .order('sort_order', { ascending: true });

    if (error) {
      logger.error('Error fetching line items', { error });
      return NextResponse.json({ error: 'Failed to fetch line items' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Line items error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Add line item to deal
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, {
      ...RATE_LIMITS.standard,
      prefix: 'ratelimit:deal-desk-line-items',
    });
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const { id } = await params;
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

    const body = await request.json();
    const parseResult = createLineItemSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const itemData = parseResult.data;
    const totalPrice = itemData.quantity * itemData.unit_price;

    const { data, error } = await supabase
      .from('deal_line_items')
      .insert({
        deal_id: id,
        item_type: itemData.item_type,
        description: itemData.description,
        quantity: itemData.quantity,
        unit_price: itemData.unit_price,
        total_price: totalPrice,
        is_taxable: itemData.is_taxable,
        tax_rate: itemData.tax_rate,
        sort_order: itemData.sort_order,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating line item', { error });
      return NextResponse.json({ error: 'Failed to create line item' }, { status: 500 });
    }

    // Log activity
    await supabase
      .from('deal_activities')
      .insert({
        deal_id: id,
        activity_type: 'line_item_added',
        title: `Added line item: ${itemData.description}`,
        new_value: `$${totalPrice.toFixed(2)}`,
        performed_by: user.id,
      });

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    logger.error('Create line item error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
