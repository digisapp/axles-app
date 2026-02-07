import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get daily views using the RPC function
    const { data: dailyViews, error: viewsError } = await supabase
      .rpc('get_user_daily_views', {
        p_user_id: user.id,
        p_days: days,
      });

    // Get daily leads using the RPC function
    const { data: dailyLeads, error: leadsError } = await supabase
      .rpc('get_user_daily_leads', {
        p_user_id: user.id,
        p_days: days,
      });

    // Get view stats with trend
    const { data: viewStats } = await supabase
      .rpc('get_user_view_stats', {
        p_user_id: user.id,
        p_period_days: 7,
      });

    // Get lead stats with trend
    const { data: leadStats } = await supabase
      .rpc('get_user_lead_stats', {
        p_user_id: user.id,
        p_period_days: 7,
      });

    // Fill in missing dates with zeros for charts
    const viewsData = fillMissingDates(dailyViews || [], days, 'view_date', 'view_count');
    const leadsData = fillMissingDates(dailyLeads || [], days, 'lead_date', 'lead_count');

    // Calculate totals
    const totalViews = viewsData.reduce((sum, d) => sum + d.count, 0);
    const totalLeads = leadsData.reduce((sum, d) => sum + d.count, 0);

    return NextResponse.json({
      views: {
        daily: viewsData,
        total: totalViews,
        trend: viewStats?.[0]?.trend_percentage || 0,
        currentPeriod: viewStats?.[0]?.current_period_views || 0,
        previousPeriod: viewStats?.[0]?.previous_period_views || 0,
      },
      leads: {
        daily: leadsData,
        total: totalLeads,
        trend: leadStats?.[0]?.trend_percentage || 0,
        currentPeriod: leadStats?.[0]?.current_period_leads || 0,
        previousPeriod: leadStats?.[0]?.previous_period_leads || 0,
      },
    });
  } catch (error) {
    logger.error('Analytics error', { error });
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}

function fillMissingDates(
  data: Array<{ [key: string]: string | number }>,
  days: number,
  dateField: string,
  countField: string
): Array<{ date: string; count: number }> {
  const result: Array<{ date: string; count: number }> = [];
  const dataMap = new Map<string, number>();

  // Create map of existing data
  data.forEach((item) => {
    const date = String(item[dateField]);
    dataMap.set(date, Number(item[countField]) || 0);
  });

  // Fill in all dates
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    result.push({
      date: dateStr,
      count: dataMap.get(dateStr) || 0,
    });
  }

  return result;
}
