import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createFloorPlanUnitSchema, floorPlanUnitsQuerySchema } from '@/lib/validations/floor-plan';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, rateLimitResponse } from '@/lib/security/rate-limit';
import { logger } from '@/lib/logger';

// GET - List floored units
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const parseResult = floorPlanUnitsQuerySchema.safeParse(queryParams);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { status, account_id, sort_by, sort_order, search, page, limit } = parseResult.data;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('listing_floor_plans')
      .select(`
        *,
        listing:listings(id, title, price, status, stock_number,
          images:listing_images(url, is_primary)
        ),
        account:floor_plan_accounts!inner(
          id, account_name, interest_rate, curtailment_percent,
          dealer_id,
          provider:floor_plan_providers(id, name)
        )
      `, { count: 'exact' })
      .eq('account.dealer_id', user.id);

    // Filter by status
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    // Filter by account
    if (account_id) {
      query = query.eq('account_id', account_id);
    }

    // Search by listing title or stock number
    if (search) {
      query = query.or(`listing.title.ilike.%${search}%,listing.stock_number.ilike.%${search}%`);
    }

    // Sorting
    const ascending = sort_order === 'asc';
    query = query.order(sort_by, { ascending });

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      logger.error('Error fetching floor plans', { error });
      return NextResponse.json({ error: 'Failed to fetch floor plans' }, { status: 500 });
    }

    return NextResponse.json({
      data,
      total: count || 0,
      page,
      limit,
      total_pages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    logger.error('Floor plan units error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Floor a unit
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
      prefix: 'ratelimit:floor-plan',
    });

    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const body = await request.json();
    const parseResult = createFloorPlanUnitSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { listing_id, account_id, floor_amount, floor_date, floor_reference, notes } = parseResult.data;

    // Verify account belongs to user
    const { data: account } = await supabase
      .from('floor_plan_accounts')
      .select('id, available_credit, curtailment_days')
      .eq('id', account_id)
      .eq('dealer_id', user.id)
      .eq('status', 'active')
      .single();

    if (!account) {
      return NextResponse.json({ error: 'Account not found or not active' }, { status: 404 });
    }

    // Verify listing belongs to user
    const { data: listing } = await supabase
      .from('listings')
      .select('id, title')
      .eq('id', listing_id)
      .eq('user_id', user.id)
      .single();

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    // Check if listing already has active floor plan
    const { data: existingFloorPlan } = await supabase
      .from('listing_floor_plans')
      .select('id')
      .eq('listing_id', listing_id)
      .eq('status', 'active')
      .single();

    if (existingFloorPlan) {
      return NextResponse.json(
        { error: 'This listing already has an active floor plan' },
        { status: 400 }
      );
    }

    // Check available credit
    if (floor_amount > account.available_credit) {
      return NextResponse.json(
        { error: 'Insufficient available credit', available: account.available_credit },
        { status: 400 }
      );
    }

    // Create floor plan
    const { data, error } = await supabase
      .from('listing_floor_plans')
      .insert({
        listing_id,
        account_id,
        floor_amount,
        floor_date,
        floor_reference,
        notes,
        current_balance: floor_amount,
      })
      .select(`
        *,
        listing:listings(id, title, price, status, stock_number),
        account:floor_plan_accounts(id, account_name, provider:floor_plan_providers(name))
      `)
      .single();

    if (error) {
      logger.error('Error creating floor plan', { error });
      return NextResponse.json({ error: 'Failed to floor unit' }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    logger.error('Floor plan creation error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
