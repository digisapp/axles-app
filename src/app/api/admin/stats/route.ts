import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkIsAdmin } from '@/lib/admin/check-admin';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, rateLimitResponse } from '@/lib/security/rate-limit';

export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting (stats can be expensive)
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, {
      ...RATE_LIMITS.standard,
      prefix: 'ratelimit:admin:stats',
    });

    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const { isAdmin } = await checkIsAdmin();

    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '30'; // days

    const supabase = await createClient();

    // Get overall stats
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    const { count: totalDealers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_dealer', true);

    const { count: pendingDealers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('dealer_status', 'pending');

    const { count: totalListings } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true });

    const { count: activeListings } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    const { count: totalLeads } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true });

    const { count: totalMessages } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true });

    // Get total views
    const { data: viewsData } = await supabase
      .from('listings')
      .select('views_count');

    const totalViews = viewsData?.reduce((sum, l) => sum + (l.views_count || 0), 0) || 0;

    // Calculate date range
    const daysAgo = parseInt(range);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);
    const startDateStr = startDate.toISOString();

    // Get new users in range
    const { count: newUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDateStr);

    // Get new listings in range
    const { count: newListings } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDateStr);

    // Get new leads in range
    const { count: newLeads } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDateStr);

    // Get daily signups for chart
    const { data: dailySignups } = await supabase
      .from('profiles')
      .select('created_at')
      .gte('created_at', startDateStr)
      .order('created_at', { ascending: true });

    // Group by day
    const signupsByDay = groupByDay(dailySignups || [], 'created_at', daysAgo);

    // Get daily listings for chart
    const { data: dailyListings } = await supabase
      .from('listings')
      .select('created_at')
      .gte('created_at', startDateStr)
      .order('created_at', { ascending: true });

    const listingsByDay = groupByDay(dailyListings || [], 'created_at', daysAgo);

    // Get daily leads for chart
    const { data: dailyLeads } = await supabase
      .from('leads')
      .select('created_at')
      .gte('created_at', startDateStr)
      .order('created_at', { ascending: true });

    const leadsByDay = groupByDay(dailyLeads || [], 'created_at', daysAgo);

    // Get top dealers by listings
    const { data: topDealers } = await supabase
      .from('profiles')
      .select(`
        id,
        company_name,
        email,
        avatar_url
      `)
      .eq('is_dealer', true)
      .limit(10);

    // Get listing counts for top dealers
    const topDealersWithStats = await Promise.all(
      (topDealers || []).map(async (dealer) => {
        const { count } = await supabase
          .from('listings')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', dealer.id)
          .eq('status', 'active');

        return {
          ...dealer,
          listing_count: count || 0,
        };
      })
    );

    // Sort by listing count
    topDealersWithStats.sort((a, b) => b.listing_count - a.listing_count);

    // Get listing breakdown by category
    const { data: categoryBreakdown } = await supabase
      .from('listings')
      .select(`
        category:categories(name),
        status
      `)
      .eq('status', 'active');

    const categoryStats = (categoryBreakdown || []).reduce((acc, listing) => {
      // Type assertion for the joined category (can be single object or array)
      const category = listing.category as unknown as { name: string } | { name: string }[] | null;
      let categoryName = 'Uncategorized';
      if (category) {
        if (Array.isArray(category)) {
          categoryName = category[0]?.name || 'Uncategorized';
        } else {
          categoryName = category.name || 'Uncategorized';
        }
      }
      acc[categoryName] = (acc[categoryName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      overview: {
        total_users: totalUsers || 0,
        total_dealers: totalDealers || 0,
        pending_dealers: pendingDealers || 0,
        total_listings: totalListings || 0,
        active_listings: activeListings || 0,
        total_leads: totalLeads || 0,
        total_messages: totalMessages || 0,
        total_views: totalViews,
      },
      period: {
        days: daysAgo,
        new_users: newUsers || 0,
        new_listings: newListings || 0,
        new_leads: newLeads || 0,
      },
      charts: {
        signups: signupsByDay,
        listings: listingsByDay,
        leads: leadsByDay,
      },
      top_dealers: topDealersWithStats.slice(0, 5),
      category_breakdown: categoryStats,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function groupByDay(
  data: { created_at: string }[],
  dateField: string,
  days: number
): { date: string; count: number }[] {
  const result: Record<string, number> = {};

  // Initialize all days with 0
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    result[dateStr] = 0;
  }

  // Count items per day
  data.forEach((item) => {
    const dateStr = new Date(item.created_at).toISOString().split('T')[0];
    if (result.hasOwnProperty(dateStr)) {
      result[dateStr]++;
    }
  });

  // Convert to array
  return Object.entries(result).map(([date, count]) => ({ date, count }));
}
