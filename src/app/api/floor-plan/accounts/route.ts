import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createFloorPlanAccountSchema } from '@/lib/validations/floor-plan';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, rateLimitResponse } from '@/lib/security/rate-limit';

// GET - List dealer's floor plan accounts
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('floor_plan_accounts')
      .select(`
        *,
        provider:floor_plan_providers(id, name, website)
      `)
      .eq('dealer_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching floor plan accounts:', error);
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
    }

    // Get active units count and total floored for each account
    const accountsWithStats = await Promise.all(
      (data || []).map(async (account) => {
        const { count, data: unitsData } = await supabase
          .from('listing_floor_plans')
          .select('current_balance', { count: 'exact' })
          .eq('account_id', account.id)
          .eq('status', 'active');

        const totalFloored = unitsData?.reduce((sum, u) => sum + (u.current_balance || 0), 0) || 0;

        return {
          ...account,
          active_units_count: count || 0,
          total_floored_amount: totalFloored,
        };
      })
    );

    return NextResponse.json({ data: accountsWithStats });
  } catch (error) {
    console.error('Floor plan accounts error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new floor plan account
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
    const parseResult = createFloorPlanAccountSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('floor_plan_accounts')
      .insert({
        ...parseResult.data,
        dealer_id: user.id,
        available_credit: parseResult.data.credit_limit, // Initially all credit is available
      })
      .select(`
        *,
        provider:floor_plan_providers(id, name)
      `)
      .single();

    if (error) {
      console.error('Error creating floor plan account:', error);
      return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Floor plan account creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
