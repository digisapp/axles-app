import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createDealSchema, dealsQuerySchema } from '@/lib/validations/deals';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, rateLimitResponse } from '@/lib/security/rate-limit';
import { logger } from '@/lib/logger';

// GET - List deals
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const parseResult = dealsQuerySchema.safeParse(queryParams);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { status, search, salesperson_id, listing_id, sort_by, sort_order, page, limit } = parseResult.data;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('deals')
      .select(`
        *,
        lead:leads(id, buyer_name, buyer_email, buyer_phone, status),
        listing:listings(id, title, price, status, stock_number, year, make, model,
          images:listing_images(url, is_primary)
        ),
        salesperson:profiles!deals_salesperson_id_fkey(id, name, email),
        line_items:deal_line_items(id, item_type, description, quantity, unit_price, total_price),
        payments:deal_payments(id, payment_type, amount, status, payment_date)
      `, { count: 'exact' })
      .eq('dealer_id', user.id);

    // Filter by status
    if (status === 'pipeline') {
      query = query.in('status', ['quote', 'negotiation', 'pending_approval', 'finalized']);
    } else if (status !== 'all') {
      query = query.eq('status', status);
    }

    // Filter by salesperson
    if (salesperson_id) {
      query = query.eq('salesperson_id', salesperson_id);
    }

    // Filter by listing
    if (listing_id) {
      query = query.eq('listing_id', listing_id);
    }

    // Search by deal number, buyer name, or buyer email
    if (search) {
      query = query.or(`deal_number.ilike.%${search}%,buyer_name.ilike.%${search}%,buyer_email.ilike.%${search}%`);
    }

    // Sorting
    const ascending = sort_order === 'asc';
    query = query.order(sort_by, { ascending });

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      logger.error('Error fetching deals', { error });
      return NextResponse.json({ error: 'Failed to fetch deals' }, { status: 500 });
    }

    return NextResponse.json({
      data,
      total: count || 0,
      page,
      limit,
      total_pages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    logger.error('Deals list error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new deal
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, {
      ...RATE_LIMITS.standard,
      prefix: 'ratelimit:deal-desk',
    });

    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const body = await request.json();
    const parseResult = createDealSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const dealData = parseResult.data;

    // If creating from a lead, copy lead data
    let leadData = null;
    if (dealData.lead_id) {
      const { data: lead } = await supabase
        .from('leads')
        .select('*')
        .eq('id', dealData.lead_id)
        .eq('user_id', user.id)
        .single();

      if (!lead) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
      }

      leadData = lead;

      // Update lead status to won
      await supabase
        .from('leads')
        .update({ status: 'won' })
        .eq('id', dealData.lead_id);
    }

    // Verify listing if provided
    if (dealData.listing_id) {
      const { data: listing } = await supabase
        .from('listings')
        .select('id, title, price')
        .eq('id', dealData.listing_id)
        .eq('user_id', user.id)
        .single();

      if (!listing) {
        return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
      }
    }

    // Create deal
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .insert({
        dealer_id: user.id,
        lead_id: dealData.lead_id || null,
        listing_id: dealData.listing_id || (leadData?.listing_id || null),
        buyer_name: dealData.buyer_name || leadData?.buyer_name,
        buyer_email: dealData.buyer_email || leadData?.buyer_email || null,
        buyer_phone: dealData.buyer_phone || leadData?.buyer_phone || null,
        buyer_company: dealData.buyer_company || null,
        buyer_address: dealData.buyer_address || null,
        status: dealData.status || 'quote',
        salesperson_id: dealData.salesperson_id || null,
        internal_notes: dealData.internal_notes || null,
      })
      .select(`
        *,
        lead:leads(id, buyer_name, buyer_email, status),
        listing:listings(id, title, price, status, stock_number)
      `)
      .single();

    if (dealError) {
      logger.error('Error creating deal', { error: dealError });
      return NextResponse.json({ error: 'Failed to create deal' }, { status: 500 });
    }

    // If there's a listing, add it as a line item
    if (deal.listing_id) {
      const { data: listing } = await supabase
        .from('listings')
        .select('title, price')
        .eq('id', deal.listing_id)
        .single();

      if (listing && listing.price) {
        await supabase
          .from('deal_line_items')
          .insert({
            deal_id: deal.id,
            item_type: 'unit',
            description: listing.title || 'Equipment',
            quantity: 1,
            unit_price: listing.price,
            total_price: listing.price,
            sort_order: 0,
          });
      }
    }

    return NextResponse.json({ data: deal }, { status: 201 });
  } catch (error) {
    logger.error('Deal creation error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
