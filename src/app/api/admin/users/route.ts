import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkIsAdmin } from '@/lib/admin/check-admin';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, rateLimitResponse } from '@/lib/security/rate-limit';

export async function GET(request: NextRequest) {
  try {
    // Rate limit admin endpoints (100 requests per minute)
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, {
      ...RATE_LIMITS.standard,
      prefix: 'ratelimit:admin',
    });

    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const { isAdmin } = await checkIsAdmin();

    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || 'all'; // all, dealers, individuals
    const status = searchParams.get('status') || 'all'; // all, active, suspended
    const sort = searchParams.get('sort') || 'created_at';
    const order = searchParams.get('order') || 'desc';
    const offset = (page - 1) * limit;

    const supabase = await createClient();

    // Build query
    let query = supabase
      .from('profiles')
      .select(`
        id,
        email,
        company_name,
        phone,
        city,
        state,
        is_dealer,
        dealer_status,
        is_admin,
        is_suspended,
        suspended_at,
        avatar_url,
        created_at
      `, { count: 'exact' });

    // Search filter
    if (search) {
      query = query.or(`email.ilike.%${search}%,company_name.ilike.%${search}%`);
    }

    // Type filter
    if (type === 'dealers') {
      query = query.eq('is_dealer', true);
    } else if (type === 'individuals') {
      query = query.eq('is_dealer', false);
    }

    // Status filter
    if (status === 'active') {
      query = query.eq('is_suspended', false);
    } else if (status === 'suspended') {
      query = query.eq('is_suspended', true);
    }

    // Sorting
    const ascending = order === 'asc';
    query = query.order(sort, { ascending });

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data: users, count, error } = await query;

    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    // Get user stats for each user
    const usersWithStats = await Promise.all(
      (users || []).map(async (user) => {
        const { count: listingCount } = await supabase
          .from('listings')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        return {
          ...user,
          listing_count: listingCount || 0,
        };
      })
    );

    // Get overall counts
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    const { count: totalDealers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_dealer', true);

    const { count: suspendedUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_suspended', true);

    return NextResponse.json({
      data: usersWithStats,
      total: count || 0,
      page,
      limit,
      total_pages: Math.ceil((count || 0) / limit),
      stats: {
        total_users: totalUsers || 0,
        total_dealers: totalDealers || 0,
        suspended_users: suspendedUsers || 0,
      },
    });
  } catch (error) {
    console.error('Admin users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
