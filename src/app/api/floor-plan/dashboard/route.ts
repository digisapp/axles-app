import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, rateLimitResponse } from '@/lib/security/rate-limit';
import { logger } from '@/lib/logger';

// GET - Get floor plan dashboard metrics
export async function GET(request: NextRequest) {
  try {
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, {
      ...RATE_LIMITS.standard,
      prefix: 'ratelimit:floor-plan-dashboard',
    });
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get metrics using the database function
    const { data: metricsData, error: metricsError } = await supabase
      .rpc('get_floor_plan_metrics', { p_dealer_id: user.id });

    if (metricsError) {
      logger.error('Error fetching floor plan metrics', { error: metricsError });
      // Fallback to manual calculation
      return await getManualMetrics(supabase, user.id);
    }

    // Get recent alerts
    const { data: alerts } = await supabase
      .from('floor_plan_alerts')
      .select('*')
      .eq('dealer_id', user.id)
      .eq('is_dismissed', false)
      .order('severity', { ascending: true }) // critical first
      .order('created_at', { ascending: false })
      .limit(5);

    // Get upcoming curtailments (next 7 days)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const { data: upcomingCurtailments } = await supabase
      .from('listing_floor_plans')
      .select(`
        id, floor_amount, current_balance, next_curtailment_date, days_floored,
        listing:listings(id, title, stock_number),
        account:floor_plan_accounts!inner(
          dealer_id, curtailment_percent,
          provider:floor_plan_providers(name)
        )
      `)
      .eq('account.dealer_id', user.id)
      .eq('status', 'active')
      .lte('next_curtailment_date', nextWeek.toISOString().split('T')[0])
      .order('next_curtailment_date', { ascending: true })
      .limit(10);

    return NextResponse.json({
      metrics: metricsData,
      recentAlerts: alerts || [],
      upcomingCurtailments: upcomingCurtailments || [],
    });
  } catch (error) {
    logger.error('Floor plan dashboard error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Fallback manual metrics calculation
async function getManualMetrics(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  // Get account totals
  const { data: accounts } = await supabase
    .from('floor_plan_accounts')
    .select('credit_limit, available_credit')
    .eq('dealer_id', userId)
    .eq('status', 'active');

  const totalCreditLimit = accounts?.reduce((sum, a) => sum + (a.credit_limit || 0), 0) || 0;
  const totalAvailable = accounts?.reduce((sum, a) => sum + (a.available_credit || 0), 0) || 0;

  // Get floor plan stats
  const { data: floorPlans } = await supabase
    .from('listing_floor_plans')
    .select(`
      current_balance, floor_amount, is_past_due, next_curtailment_date,
      total_interest_accrued, total_interest_paid,
      account:floor_plan_accounts!inner(dealer_id, interest_rate)
    `)
    .eq('account.dealer_id', userId)
    .eq('status', 'active');

  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const totalBalance = floorPlans?.reduce((sum, fp) => sum + (fp.current_balance || 0), 0) || 0;
  const totalFloored = floorPlans?.reduce((sum, fp) => sum + (fp.floor_amount || 0), 0) || 0;
  const unitsPastDue = floorPlans?.filter(fp => fp.is_past_due).length || 0;
  const upcomingCurtailments = floorPlans?.filter(fp => {
    if (!fp.next_curtailment_date) return false;
    const curtDate = new Date(fp.next_curtailment_date);
    return curtDate >= today && curtDate <= nextWeek;
  }).length || 0;
  const unpaidInterest = floorPlans?.reduce(
    (sum, fp) => sum + ((fp.total_interest_accrued || 0) - (fp.total_interest_paid || 0)),
    0
  ) || 0;
  const monthlyInterest = floorPlans?.reduce(
    (sum, fp) => {
      // Handle account which could be array or object from Supabase join
      const accountData = fp.account as unknown as { interest_rate?: number } | { interest_rate?: number }[] | null;
      const interestRate = Array.isArray(accountData)
        ? accountData[0]?.interest_rate || 0
        : accountData?.interest_rate || 0;
      return sum + ((fp.current_balance || 0) * (interestRate / 100 / 12));
    },
    0
  ) || 0;

  // Get alert counts
  const { data: alertCounts } = await supabase
    .from('floor_plan_alerts')
    .select('severity')
    .eq('dealer_id', userId)
    .eq('is_dismissed', false);

  const criticalCount = alertCounts?.filter(a => a.severity === 'critical').length || 0;
  const warningCount = alertCounts?.filter(a => a.severity === 'warning').length || 0;
  const infoCount = alertCounts?.filter(a => a.severity === 'info').length || 0;

  const metrics = {
    totalCreditLimit,
    totalAvailableCredit: totalAvailable,
    totalCurrentBalance: totalBalance,
    totalFloored,
    creditUtilization: totalCreditLimit > 0
      ? Math.round(((totalCreditLimit - totalAvailable) / totalCreditLimit * 100) * 10) / 10
      : 0,
    unitsFloored: floorPlans?.length || 0,
    unitsPastDue,
    upcomingCurtailments,
    unpaidInterest: Math.round(unpaidInterest * 100) / 100,
    monthlyInterestEstimate: Math.round(monthlyInterest * 100) / 100,
    alertCounts: {
      critical: criticalCount,
      warning: warningCount,
      info: infoCount,
    },
  };

  return NextResponse.json({
    metrics,
    recentAlerts: [],
    upcomingCurtailments: [],
  });
}
