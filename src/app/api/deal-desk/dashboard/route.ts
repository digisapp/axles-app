import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - Get deal desk dashboard metrics
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get metrics using the database function
    const { data: metrics, error: metricsError } = await supabase
      .rpc('get_deal_metrics', { p_dealer_id: user.id });

    if (metricsError) {
      console.error('Error fetching deal metrics:', metricsError);
      // Return default metrics on error
    }

    // Get recent deals
    const { data: recentDeals, error: dealsError } = await supabase
      .from('deals')
      .select(`
        id, deal_number, buyer_name, status, total_due, balance_due, created_at, updated_at,
        listing:listings(id, title, stock_number,
          images:listing_images(url, is_primary)
        )
      `)
      .eq('dealer_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(5);

    if (dealsError) {
      console.error('Error fetching recent deals:', dealsError);
    }

    // Get deals by status for kanban
    const { data: dealsByStatus, error: statusError } = await supabase
      .from('deals')
      .select(`
        id, deal_number, buyer_name, buyer_email, status, total_due, balance_due,
        created_at, updated_at, quote_sent_at,
        listing:listings(id, title, price, stock_number, year, make, model,
          images:listing_images(url, is_primary)
        ),
        salesperson:profiles!deals_salesperson_id_fkey(id, name)
      `)
      .eq('dealer_id', user.id)
      .in('status', ['quote', 'negotiation', 'pending_approval', 'finalized'])
      .order('updated_at', { ascending: false });

    if (statusError) {
      console.error('Error fetching deals by status:', statusError);
    }

    // Group deals by status for kanban
    const kanbanData = {
      quote: (dealsByStatus || []).filter(d => d.status === 'quote'),
      negotiation: (dealsByStatus || []).filter(d => d.status === 'negotiation'),
      pending_approval: (dealsByStatus || []).filter(d => d.status === 'pending_approval'),
      finalized: (dealsByStatus || []).filter(d => d.status === 'finalized'),
    };

    // Default metrics if function failed
    const defaultMetrics = {
      totalDeals: 0,
      pipelineCount: 0,
      pipelineValue: 0,
      closedThisMonth: 0,
      revenueThisMonth: 0,
      conversionRate: 0,
      byStatus: {
        quote: 0,
        negotiation: 0,
        pending_approval: 0,
        finalized: 0,
        closed: 0,
      },
    };

    return NextResponse.json({
      metrics: metrics || defaultMetrics,
      recentDeals: recentDeals || [],
      kanbanData,
    });
  } catch (error) {
    console.error('Deal desk dashboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
