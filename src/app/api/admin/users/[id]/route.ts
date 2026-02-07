import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkIsAdmin, logAdminAction } from '@/lib/admin/check-admin';
import { logger } from '@/lib/logger';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { isAdmin, userId } = await checkIsAdmin();

    if (!isAdmin || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { action, reason } = body;

    if (!action || !['suspend', 'unsuspend', 'make_admin', 'remove_admin'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Prevent self-modification for admin status
    if (id === userId && ['make_admin', 'remove_admin'].includes(action)) {
      return NextResponse.json({ error: 'Cannot modify your own admin status' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get current user info
    const { data: targetUser, error: fetchError } = await supabase
      .from('profiles')
      .select('id, email, company_name, is_admin, is_suspended')
      .eq('id', id)
      .single();

    if (fetchError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let updateData: Record<string, unknown> = {};
    let actionType = '';

    switch (action) {
      case 'suspend':
        updateData = {
          is_suspended: true,
          suspended_at: new Date().toISOString(),
          suspended_reason: reason || 'Suspended by admin',
        };
        actionType = 'suspend_user';
        break;
      case 'unsuspend':
        updateData = {
          is_suspended: false,
          suspended_at: null,
          suspended_reason: null,
        };
        actionType = 'unsuspend_user';
        break;
      case 'make_admin':
        updateData = { is_admin: true };
        actionType = 'make_admin';
        break;
      case 'remove_admin':
        updateData = { is_admin: false };
        actionType = 'remove_admin';
        break;
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      logger.error('Error updating user', { updateError });
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }

    // Log admin action
    await logAdminAction(
      userId,
      actionType,
      'user',
      id,
      {
        user_email: targetUser.email,
        company_name: targetUser.company_name,
        reason: reason || null,
      }
    );

    return NextResponse.json({
      success: true,
      message: `User ${action}ed successfully`,
    });
  } catch (error) {
    logger.error('Admin user action error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { isAdmin } = await checkIsAdmin();

    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const supabase = await createClient();

    const { data: user, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get listing stats
    const { count: totalListings } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', id);

    const { count: activeListings } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', id)
      .eq('status', 'active');

    // Get lead stats
    const { count: totalLeads } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', id);

    // Get recent activity
    const { data: recentListings } = await supabase
      .from('listings')
      .select('id, title, status, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      data: {
        ...user,
        stats: {
          total_listings: totalListings || 0,
          active_listings: activeListings || 0,
          total_leads: totalLeads || 0,
        },
        recent_listings: recentListings || [],
      },
    });
  } catch (error) {
    logger.error('Admin get user error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
