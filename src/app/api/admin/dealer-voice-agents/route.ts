import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, rateLimitResponse } from '@/lib/security/rate-limit';
import { logger } from '@/lib/logger';
import { validateBody, ValidationError, adminVoiceAgentCreateSchema } from '@/lib/validations/api';

// GET /api/admin/dealer-voice-agents - List all dealer voice agents
export async function GET(request: NextRequest) {
  try {
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, {
      ...RATE_LIMITS.standard,
      prefix: 'ratelimit:admin-dealer-voice-agents',
    });
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

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
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'active', 'inactive', 'all'
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const perPage = parseInt(searchParams.get('per_page') || '20');

    // Build query
    let query = supabase
      .from('dealer_voice_agents')
      .select(`
        *,
        dealer:profiles!dealer_id(
          id, email, company_name, phone
        )
      `, { count: 'exact' });

    // Apply filters
    if (status === 'active') {
      query = query.eq('is_active', true);
    } else if (status === 'inactive') {
      query = query.eq('is_active', false);
    }

    if (search) {
      query = query.or(`business_name.ilike.%${search}%,phone_number.ilike.%${search}%`);
    }

    // Pagination
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    const { data: agents, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      logger.error('Error fetching dealer voice agents', { error });
      return NextResponse.json({ error: 'Failed to fetch voice agents' }, { status: 500 });
    }

    return NextResponse.json({
      data: agents,
      total: count || 0,
      page,
      per_page: perPage,
      total_pages: Math.ceil((count || 0) / perPage),
    });
  } catch (error) {
    logger.error('Error in GET /api/admin/dealer-voice-agents', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/dealer-voice-agents - Create voice agent for a dealer
export async function POST(request: NextRequest) {
  try {
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, {
      ...RATE_LIMITS.standard,
      prefix: 'ratelimit:admin-dealer-voice-agents',
    });
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

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
    let validatedData;
    try {
      validatedData = validateBody(adminVoiceAgentCreateSchema, body);
    } catch (err) {
      if (err instanceof ValidationError) {
        return NextResponse.json(
          { error: 'Validation failed', details: err.errors },
          { status: 400 }
        );
      }
      throw err;
    }

    // Check if dealer exists
    const { data: dealer } = await supabase
      .from('profiles')
      .select('id, company_name')
      .eq('id', validatedData.dealer_id)
      .single();

    if (!dealer) {
      return NextResponse.json({ error: 'Dealer not found' }, { status: 404 });
    }

    // Check if dealer already has a voice agent
    const { data: existing } = await supabase
      .from('dealer_voice_agents')
      .select('id')
      .eq('dealer_id', validatedData.dealer_id)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Dealer already has a voice agent' }, { status: 400 });
    }

    // Create voice agent
    const { data: agent, error } = await supabase
      .from('dealer_voice_agents')
      .insert({
        dealer_id: validatedData.dealer_id,
        phone_number: validatedData.phone_number || null,
        phone_number_id: validatedData.phone_number_id || null,
        agent_name: validatedData.agent_name || 'AI Assistant',
        voice: validatedData.voice || 'Sal',
        greeting: validatedData.greeting || 'Thanks for calling! How can I help you today?',
        instructions: validatedData.instructions || null,
        business_name: validatedData.business_name || dealer.company_name || 'Our Dealership',
        business_description: validatedData.business_description || null,
        business_hours: validatedData.business_hours || null,
        after_hours_message: validatedData.after_hours_message || null,
        can_search_inventory: validatedData.can_search_inventory ?? true,
        can_capture_leads: validatedData.can_capture_leads ?? true,
        can_transfer_calls: validatedData.can_transfer_calls ?? false,
        transfer_phone_number: validatedData.transfer_phone_number || null,
        plan_tier: validatedData.plan_tier || 'starter',
        minutes_included: validatedData.minutes_included || 100,
        is_active: validatedData.is_active ?? false,
        is_provisioned: !!validatedData.phone_number,
      })
      .select(`
        *,
        dealer:profiles!dealer_id(
          id, email, company_name, phone
        )
      `)
      .single();

    if (error) {
      logger.error('Error creating dealer voice agent', { error });
      return NextResponse.json({ error: 'Failed to create voice agent' }, { status: 500 });
    }

    return NextResponse.json({ data: agent }, { status: 201 });
  } catch (error) {
    logger.error('Error in POST /api/admin/dealer-voice-agents', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
