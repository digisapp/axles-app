import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Validate and normalize phone number to E.164 format
 */
function validateE164Phone(phone: string): { valid: boolean; normalized: string } {
  if (!phone) return { valid: false, normalized: '' };

  // Strip all non-digit characters except leading +
  const cleaned = phone.replace(/[^\d+]/g, '');

  // Handle various formats
  if (cleaned.startsWith('+')) {
    const digits = cleaned.slice(1);
    if (digits.length === 11 && digits.startsWith('1')) {
      return { valid: true, normalized: cleaned };
    } else if (digits.length === 10) {
      return { valid: true, normalized: `+1${digits}` };
    }
  } else if (cleaned.startsWith('1') && cleaned.length === 11) {
    return { valid: true, normalized: `+${cleaned}` };
  } else if (cleaned.length === 10) {
    return { valid: true, normalized: `+1${cleaned}` };
  }

  return { valid: false, normalized: cleaned };
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/dealer-voice-agents/[id] - Get specific dealer voice agent
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    // Get the voice agent
    const { data: agent, error } = await supabase
      .from('dealer_voice_agents')
      .select(`
        *,
        dealer:profiles!dealer_id(
          id, email, company_name, phone, avatar_url
        )
      `)
      .eq('id', id)
      .single();

    if (error || !agent) {
      return NextResponse.json({ error: 'Voice agent not found' }, { status: 404 });
    }

    // Get call stats for this agent
    const { count: totalCalls } = await supabase
      .from('call_logs')
      .select('*', { count: 'exact', head: true })
      .eq('dealer_voice_agent_id', id);

    const { data: durationData } = await supabase
      .from('call_logs')
      .select('duration_seconds')
      .eq('dealer_voice_agent_id', id)
      .not('duration_seconds', 'is', null);

    const totalMinutes = durationData
      ? Math.round(durationData.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / 60)
      : 0;

    return NextResponse.json({
      data: {
        ...agent,
        stats: {
          total_calls: totalCalls || 0,
          total_minutes: totalMinutes,
        },
      },
    });
  } catch (error) {
    console.error('Error in GET /api/admin/dealer-voice-agents/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/admin/dealer-voice-agents/[id] - Update dealer voice agent
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    const body = await request.json();

    // Admin can update all fields
    const allowedFields = [
      'phone_number',
      'phone_number_id',
      'agent_name',
      'voice',
      'greeting',
      'instructions',
      'business_name',
      'business_description',
      'business_hours',
      'after_hours_message',
      'can_search_inventory',
      'can_capture_leads',
      'can_transfer_calls',
      'transfer_phone_number',
      'plan_tier',
      'minutes_included',
      'minutes_used',
      'billing_cycle_start',
      'stripe_subscription_id',
      'is_active',
      'is_provisioned',
      'activated_at',
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // Validate and normalize phone numbers if provided
    if (updates.phone_number && typeof updates.phone_number === 'string') {
      const { valid, normalized } = validateE164Phone(updates.phone_number);
      if (!valid) {
        return NextResponse.json(
          { error: 'Invalid phone number. Please use format: +1-XXX-XXX-XXXX' },
          { status: 400 }
        );
      }
      updates.phone_number = normalized;
    }

    if (updates.transfer_phone_number && typeof updates.transfer_phone_number === 'string') {
      const { valid, normalized } = validateE164Phone(updates.transfer_phone_number);
      if (!valid) {
        return NextResponse.json(
          { error: 'Invalid transfer phone number. Please use format: +1-XXX-XXX-XXXX' },
          { status: 400 }
        );
      }
      updates.transfer_phone_number = normalized;
    }

    // Auto-set provisioned if phone number added
    if (body.phone_number && !body.is_provisioned) {
      updates.is_provisioned = true;
    }

    // Auto-set activated_at when activating
    if (body.is_active === true) {
      const { data: current } = await supabase
        .from('dealer_voice_agents')
        .select('activated_at')
        .eq('id', id)
        .single();

      if (current && !current.activated_at) {
        updates.activated_at = new Date().toISOString();
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Update voice agent
    const { data: agent, error } = await supabase
      .from('dealer_voice_agents')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        dealer:profiles!dealer_id(
          id, email, company_name, phone
        )
      `)
      .single();

    if (error) {
      console.error('Error updating dealer voice agent:', error);
      return NextResponse.json({ error: 'Failed to update voice agent' }, { status: 500 });
    }

    return NextResponse.json({ data: agent });
  } catch (error) {
    console.error('Error in PATCH /api/admin/dealer-voice-agents/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/dealer-voice-agents/[id] - Delete dealer voice agent
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    // Delete voice agent
    const { error } = await supabase
      .from('dealer_voice_agents')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting dealer voice agent:', error);
      return NextResponse.json({ error: 'Failed to delete voice agent' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/admin/dealer-voice-agents/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
