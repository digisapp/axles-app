import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

// GET /api/admin/dealer-staff - List all dealer staff (admin only)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication and admin status
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const dealerId = searchParams.get('dealer_id');
    const status = searchParams.get('status'); // 'active', 'inactive', 'locked'
    const search = searchParams.get('search');

    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('dealer_staff')
      .select(`
        *,
        dealer:profiles!dealer_id(
          id, email, company_name
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters
    if (dealerId) {
      query = query.eq('dealer_id', dealerId);
    }

    if (status === 'active') {
      query = query.eq('is_active', true).is('locked_until', null);
    } else if (status === 'inactive') {
      query = query.eq('is_active', false);
    } else if (status === 'locked') {
      query = query.gt('locked_until', new Date().toISOString());
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone_number.ilike.%${search}%`);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: staff, error, count } = await query;

    if (error) {
      logger.error('Error fetching dealer staff', { error });
      return NextResponse.json({ error: 'Failed to fetch dealer staff' }, { status: 500 });
    }

    // Get summary stats
    const { data: allStaff } = await supabase
      .from('dealer_staff')
      .select('is_active, locked_until');

    const now = new Date().toISOString();
    const stats = {
      total: allStaff?.length || 0,
      active: allStaff?.filter(s => s.is_active && (!s.locked_until || s.locked_until < now)).length || 0,
      inactive: allStaff?.filter(s => !s.is_active).length || 0,
      locked: allStaff?.filter(s => s.locked_until && s.locked_until > now).length || 0,
    };

    return NextResponse.json({
      data: staff || [],
      stats,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    logger.error('Error in GET /api/admin/dealer-staff', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
