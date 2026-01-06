import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkIsAdmin, logAdminAction } from '@/lib/admin/check-admin';

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
    const { action, rejection_reason } = body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get current dealer info
    const { data: dealer, error: fetchError } = await supabase
      .from('profiles')
      .select('id, email, company_name, dealer_status')
      .eq('id', id)
      .single();

    if (fetchError || !dealer) {
      return NextResponse.json({ error: 'Dealer not found' }, { status: 404 });
    }

    // Update dealer status
    const updateData: Record<string, unknown> = {
      dealer_status: action === 'approve' ? 'approved' : 'rejected',
      dealer_reviewed_at: new Date().toISOString(),
      dealer_reviewed_by: userId,
      is_dealer: action === 'approve',
    };

    if (action === 'reject' && rejection_reason) {
      updateData.dealer_rejection_reason = rejection_reason;
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      console.error('Error updating dealer:', updateError);
      return NextResponse.json({ error: 'Failed to update dealer' }, { status: 500 });
    }

    // Log admin action
    await logAdminAction(
      userId,
      action === 'approve' ? 'approve_dealer' : 'reject_dealer',
      'user',
      id,
      {
        dealer_email: dealer.email,
        company_name: dealer.company_name,
        rejection_reason: rejection_reason || null,
      }
    );

    return NextResponse.json({
      success: true,
      message: `Dealer ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
    });
  } catch (error) {
    console.error('Admin dealer action error:', error);
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

    const { data: dealer, error } = await supabase
      .from('profiles')
      .select(`
        id,
        email,
        company_name,
        phone,
        city,
        state,
        address,
        zip_code,
        website,
        about,
        is_dealer,
        dealer_status,
        dealer_applied_at,
        dealer_reviewed_at,
        dealer_rejection_reason,
        business_license,
        tax_id,
        avatar_url,
        banner_url,
        created_at
      `)
      .eq('id', id)
      .single();

    if (error || !dealer) {
      return NextResponse.json({ error: 'Dealer not found' }, { status: 404 });
    }

    // Get listing count
    const { count: listingCount } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', id);

    // Get lead count
    const { count: leadCount } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', id);

    return NextResponse.json({
      data: {
        ...dealer,
        listing_count: listingCount || 0,
        lead_count: leadCount || 0,
      },
    });
  } catch (error) {
    console.error('Admin get dealer error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
