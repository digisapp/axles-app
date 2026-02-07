import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// Verify the request is from Vercel Cron or has correct secret
function verifyRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return true;
  }

  const vercelCron = request.headers.get('x-vercel-cron');
  if (vercelCron) {
    return true;
  }

  return false;
}

// GET - Generate floor plan alerts
export async function GET(request: NextRequest) {
  if (!verifyRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Use service role client to access all dealers
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Get all active floor plans with upcoming curtailments
    const { data: floorPlans, error: fpError } = await supabase
      .from('listing_floor_plans')
      .select(`
        id, floor_amount, current_balance, next_curtailment_date,
        days_floored, is_past_due, total_interest_accrued, total_interest_paid,
        listing:listings(id, title, stock_number),
        account:floor_plan_accounts!inner(
          id, dealer_id, curtailment_percent, interest_rate,
          provider:floor_plan_providers(name)
        )
      `)
      .eq('status', 'active');

    if (fpError) {
      logger.error('Error fetching floor plans', { error: fpError });
      return NextResponse.json({ error: 'Failed to fetch floor plans' }, { status: 500 });
    }

    const alertsToCreate: Array<{
      dealer_id: string;
      floor_plan_id: string;
      alert_type: string;
      severity: 'info' | 'warning' | 'critical';
      title: string;
      message: string;
      listing_title?: string;
      due_date?: string;
      amount_due?: number;
    }> = [];

    for (const fp of floorPlans || []) {
      // Handle the account which could be an object or array from the join
      const account = fp.account as unknown as {
        dealer_id: string;
        curtailment_percent: number;
        interest_rate: number;
        provider?: { name: string }[] | { name: string };
      } | null;
      const listing = fp.listing as unknown as { title?: string; stock_number?: string } | null;

      const dealerId = account?.dealer_id;
      const provider = account?.provider;
      const providerName = Array.isArray(provider) ? provider[0]?.name : provider?.name || 'Unknown';
      const listingTitle = listing?.title || 'Unknown Unit';
      const curtailmentPercent = account?.curtailment_percent || 10;

      if (!dealerId) continue;

      // Check for past due
      if (fp.is_past_due) {
        alertsToCreate.push({
          dealer_id: dealerId,
          floor_plan_id: fp.id,
          alert_type: 'curtailment_past_due',
          severity: 'critical',
          title: 'Curtailment Past Due',
          message: `${listingTitle} - Payment is overdue. Contact ${providerName} immediately.`,
          listing_title: listingTitle,
          due_date: fp.next_curtailment_date,
          amount_due: fp.floor_amount * (curtailmentPercent / 100),
        });
      }

      // Check for upcoming curtailments
      if (fp.next_curtailment_date) {
        const curtDate = new Date(fp.next_curtailment_date);
        const daysUntil = Math.ceil((curtDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntil === 0) {
          alertsToCreate.push({
            dealer_id: dealerId,
            floor_plan_id: fp.id,
            alert_type: 'curtailment_due',
            severity: 'critical',
            title: 'Curtailment Due Today',
            message: `${listingTitle} - Curtailment payment due today to ${providerName}.`,
            listing_title: listingTitle,
            due_date: fp.next_curtailment_date,
            amount_due: fp.floor_amount * (curtailmentPercent / 100),
          });
        } else if (daysUntil > 0 && daysUntil <= 3) {
          alertsToCreate.push({
            dealer_id: dealerId,
            floor_plan_id: fp.id,
            alert_type: 'curtailment_upcoming',
            severity: 'warning',
            title: `Curtailment in ${daysUntil} Days`,
            message: `${listingTitle} - Payment to ${providerName} due in ${daysUntil} days.`,
            listing_title: listingTitle,
            due_date: fp.next_curtailment_date,
            amount_due: fp.floor_amount * (curtailmentPercent / 100),
          });
        } else if (daysUntil > 3 && daysUntil <= 7) {
          alertsToCreate.push({
            dealer_id: dealerId,
            floor_plan_id: fp.id,
            alert_type: 'curtailment_upcoming',
            severity: 'info',
            title: `Curtailment in ${daysUntil} Days`,
            message: `${listingTitle} - Payment to ${providerName} due in ${daysUntil} days.`,
            listing_title: listingTitle,
            due_date: fp.next_curtailment_date,
            amount_due: fp.floor_amount * (curtailmentPercent / 100),
          });
        }
      }

      // Check for high unpaid interest (>$500)
      const unpaidInterest = fp.total_interest_accrued - fp.total_interest_paid;
      if (unpaidInterest > 500) {
        alertsToCreate.push({
          dealer_id: dealerId,
          floor_plan_id: fp.id,
          alert_type: 'high_interest',
          severity: 'warning',
          title: 'High Unpaid Interest',
          message: `${listingTitle} has $${unpaidInterest.toFixed(2)} in unpaid interest.`,
          listing_title: listingTitle,
          amount_due: unpaidInterest,
        });
      }

      // Check for aging inventory
      if (fp.days_floored >= 150) {
        alertsToCreate.push({
          dealer_id: dealerId,
          floor_plan_id: fp.id,
          alert_type: 'aging_inventory',
          severity: 'critical',
          title: 'Severely Aging Inventory',
          message: `${listingTitle} has been floored for ${fp.days_floored} days. Consider price reduction or auction.`,
          listing_title: listingTitle,
        });
      } else if (fp.days_floored >= 120) {
        alertsToCreate.push({
          dealer_id: dealerId,
          floor_plan_id: fp.id,
          alert_type: 'aging_inventory',
          severity: 'warning',
          title: 'Aging Inventory',
          message: `${listingTitle} has been floored for ${fp.days_floored} days.`,
          listing_title: listingTitle,
        });
      } else if (fp.days_floored >= 90) {
        alertsToCreate.push({
          dealer_id: dealerId,
          floor_plan_id: fp.id,
          alert_type: 'aging_inventory',
          severity: 'info',
          title: 'Inventory Aging',
          message: `${listingTitle} has been floored for ${fp.days_floored} days.`,
          listing_title: listingTitle,
        });
      }
    }

    // Clear old alerts (older than 7 days or already dismissed)
    await supabase
      .from('floor_plan_alerts')
      .delete()
      .or(`is_dismissed.eq.true,created_at.lt.${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()}`);

    // Insert new alerts (upsert to avoid duplicates)
    if (alertsToCreate.length > 0) {
      // Delete existing alerts of the same type for the same floor plan today
      for (const alert of alertsToCreate) {
        await supabase
          .from('floor_plan_alerts')
          .delete()
          .eq('floor_plan_id', alert.floor_plan_id)
          .eq('alert_type', alert.alert_type)
          .eq('is_dismissed', false);
      }

      // Insert new alerts
      const { error: insertError } = await supabase
        .from('floor_plan_alerts')
        .insert(alertsToCreate);

      if (insertError) {
        logger.error('Error inserting alerts', { error: insertError });
      }
    }

    // Check credit utilization per account
    const { data: accounts } = await supabase
      .from('floor_plan_accounts')
      .select('id, dealer_id, credit_limit, available_credit, provider:floor_plan_providers(name)')
      .eq('status', 'active');

    for (const account of accounts || []) {
      const utilization = account.credit_limit > 0
        ? ((account.credit_limit - account.available_credit) / account.credit_limit) * 100
        : 0;

      // Handle provider which could be array or object
      const providerData = account.provider as unknown as { name: string }[] | { name: string } | null;
      const accountProviderName = Array.isArray(providerData)
        ? providerData[0]?.name
        : providerData?.name || 'floor plan';

      if (utilization >= 90) {
        // Delete existing credit limit warning for this account
        await supabase
          .from('floor_plan_alerts')
          .delete()
          .eq('dealer_id', account.dealer_id)
          .eq('alert_type', 'credit_limit_warning')
          .eq('is_dismissed', false);

        await supabase
          .from('floor_plan_alerts')
          .insert({
            dealer_id: account.dealer_id,
            alert_type: 'credit_limit_warning',
            severity: 'critical',
            title: 'Credit Limit Critical',
            message: `Your ${accountProviderName} account is at ${utilization.toFixed(0)}% utilization.`,
          });
      } else if (utilization >= 80) {
        await supabase
          .from('floor_plan_alerts')
          .delete()
          .eq('dealer_id', account.dealer_id)
          .eq('alert_type', 'credit_limit_warning')
          .eq('is_dismissed', false);

        await supabase
          .from('floor_plan_alerts')
          .insert({
            dealer_id: account.dealer_id,
            alert_type: 'credit_limit_warning',
            severity: 'warning',
            title: 'Credit Limit Warning',
            message: `Your ${accountProviderName} account is at ${utilization.toFixed(0)}% utilization.`,
          });
      }
    }

    return NextResponse.json({
      success: true,
      alertsGenerated: alertsToCreate.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Cron floor plan alerts error', { error });
    return NextResponse.json({ error: 'Failed to generate alerts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
