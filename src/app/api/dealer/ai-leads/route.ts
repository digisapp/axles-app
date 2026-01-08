import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Get dealer's AI leads
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('dealer_ai_leads')
      .select(`
        *,
        conversation:chat_conversations(
          id,
          created_at,
          listing:listings(id, title)
        )
      `)
      .eq('dealer_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: leads, error, count } = await query;

    if (error) {
      console.error('Fetch leads error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch leads' },
        { status: 500 }
      );
    }

    // Get lead stats
    const { data: statsData } = await supabase
      .from('dealer_ai_leads')
      .select('status')
      .eq('dealer_id', user.id);

    const stats = {
      total: statsData?.length || 0,
      new: statsData?.filter(l => l.status === 'new').length || 0,
      contacted: statsData?.filter(l => l.status === 'contacted').length || 0,
      qualified: statsData?.filter(l => l.status === 'qualified').length || 0,
      converted: statsData?.filter(l => l.status === 'converted').length || 0,
    };

    return NextResponse.json({
      leads,
      stats,
      pagination: {
        total: count,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('AI Leads error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Update lead status
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { leadId, status, notes } = body;

    if (!leadId) {
      return NextResponse.json(
        { error: 'Lead ID is required' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (status) {
      updateData.status = status;
      if (status === 'contacted') {
        updateData.contacted_at = new Date().toISOString();
      }
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    const { data: lead, error } = await supabase
      .from('dealer_ai_leads')
      .update(updateData)
      .eq('id', leadId)
      .eq('dealer_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Update lead error:', error);
      return NextResponse.json(
        { error: 'Failed to update lead' },
        { status: 500 }
      );
    }

    return NextResponse.json({ lead });
  } catch (error) {
    console.error('Update lead error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Send notification email for new lead (called internally)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dealerId, leadId, internal } = body;

    // Only allow internal calls
    if (!internal) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    // Get lead details
    const { data: lead } = await supabase
      .from('dealer_ai_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (!lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Get dealer's email settings
    const { data: aiSettings } = await supabase
      .from('dealer_ai_settings')
      .select('lead_notification_email')
      .eq('dealer_id', dealerId)
      .single();

    const { data: dealer } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', dealerId)
      .single();

    const notificationEmail = aiSettings?.lead_notification_email || dealer?.email;

    if (!notificationEmail) {
      return NextResponse.json({ success: true, skipped: true });
    }

    // TODO: Integrate with email service (SendGrid, Resend, etc.)
    // For now, just log the notification
    console.log('New AI Lead Notification:', {
      to: notificationEmail,
      lead: {
        name: lead.visitor_name,
        email: lead.visitor_email,
        phone: lead.visitor_phone,
        interest: lead.equipment_interest,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Send notification error:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}
