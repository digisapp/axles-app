import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkIsAdmin } from '@/lib/admin/check-admin';

export async function GET(request: Request) {
  try {
    const { isAdmin } = await checkIsAdmin();

    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
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
        dealer_applied_at,
        dealer_reviewed_at,
        dealer_rejection_reason,
        business_license,
        tax_id,
        created_at,
        avatar_url
      `, { count: 'exact' });

    // Filter by status
    if (status === 'all') {
      query = query.neq('dealer_status', 'none');
    } else {
      query = query.eq('dealer_status', status);
    }

    // Pagination
    query = query
      .order('dealer_applied_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    const { data: dealers, count, error } = await query;

    if (error) {
      console.error('Error fetching dealers:', error);
      return NextResponse.json({ error: 'Failed to fetch dealers' }, { status: 500 });
    }

    // Get counts by status
    const { count: pendingCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('dealer_status', 'pending');

    const { count: approvedCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('dealer_status', 'approved');

    const { count: rejectedCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('dealer_status', 'rejected');

    return NextResponse.json({
      data: dealers,
      total: count || 0,
      page,
      limit,
      total_pages: Math.ceil((count || 0) / limit),
      counts: {
        pending: pendingCount || 0,
        approved: approvedCount || 0,
        rejected: rejectedCount || 0,
      },
    });
  } catch (error) {
    console.error('Admin dealers error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
