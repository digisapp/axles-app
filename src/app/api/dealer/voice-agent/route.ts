import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

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

// GET /api/dealer/voice-agent - Get dealer's voice agent settings
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get dealer's voice agent
    const { data: agent, error } = await supabase
      .from('dealer_voice_agents')
      .select('*')
      .eq('dealer_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      logger.error('Error fetching voice agent', { error });
      return NextResponse.json({ error: 'Failed to fetch voice agent' }, { status: 500 });
    }

    return NextResponse.json({ data: agent || null });
  } catch (error) {
    logger.error('Error in GET /api/dealer/voice-agent', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/dealer/voice-agent - Create dealer's voice agent
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if dealer already has a voice agent
    const { data: existing } = await supabase
      .from('dealer_voice_agents')
      .select('id')
      .eq('dealer_id', user.id)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Voice agent already exists' }, { status: 400 });
    }

    // Get dealer profile for defaults
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_name')
      .eq('id', user.id)
      .single();

    const body = await request.json();

    // Create voice agent with defaults
    const { data: agent, error } = await supabase
      .from('dealer_voice_agents')
      .insert({
        dealer_id: user.id,
        business_name: body.business_name || profile?.company_name || 'Our Dealership',
        agent_name: body.agent_name || 'AI Assistant',
        voice: body.voice || 'Sal',
        greeting: body.greeting || 'Thanks for calling! How can I help you today?',
        business_description: body.business_description || '',
        instructions: body.instructions || '',
        plan_tier: 'trial',
        minutes_included: 30, // Trial gets 30 minutes
        is_active: false, // Not active until phone number assigned
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating voice agent', { error });
      return NextResponse.json({ error: 'Failed to create voice agent' }, { status: 500 });
    }

    return NextResponse.json({ data: agent }, { status: 201 });
  } catch (error) {
    logger.error('Error in POST /api/dealer/voice-agent', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/dealer/voice-agent - Update dealer's voice agent settings
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Only allow updating certain fields
    const allowedFields = [
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
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // Validate and normalize transfer phone number if provided
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

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Update voice agent
    const { data: agent, error } = await supabase
      .from('dealer_voice_agents')
      .update(updates)
      .eq('dealer_id', user.id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating voice agent', { error });
      return NextResponse.json({ error: 'Failed to update voice agent' }, { status: 500 });
    }

    return NextResponse.json({ data: agent });
  } catch (error) {
    logger.error('Error in PATCH /api/dealer/voice-agent', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
