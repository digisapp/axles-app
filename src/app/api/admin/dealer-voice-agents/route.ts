import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

// GET /api/admin/dealer-voice-agents - List all dealer voice agents
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

    // Validate required fields
    if (!body.dealer_id) {
      return NextResponse.json({ error: 'dealer_id is required' }, { status: 400 });
    }

    // Check if dealer exists
    const { data: dealer } = await supabase
      .from('profiles')
      .select('id, company_name')
      .eq('id', body.dealer_id)
      .single();

    if (!dealer) {
      return NextResponse.json({ error: 'Dealer not found' }, { status: 404 });
    }

    // Check if dealer already has a voice agent
    const { data: existing } = await supabase
      .from('dealer_voice_agents')
      .select('id')
      .eq('dealer_id', body.dealer_id)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Dealer already has a voice agent' }, { status: 400 });
    }

    // Create voice agent
    const { data: agent, error } = await supabase
      .from('dealer_voice_agents')
      .insert({
        dealer_id: body.dealer_id,
        phone_number: body.phone_number || null,
        phone_number_id: body.phone_number_id || null,
        agent_name: body.agent_name || 'AI Assistant',
        voice: body.voice || 'Sal',
        greeting: body.greeting || 'Thanks for calling! How can I help you today?',
        instructions: body.instructions || null,
        business_name: body.business_name || dealer.company_name || 'Our Dealership',
        business_description: body.business_description || null,
        business_hours: body.business_hours || null,
        after_hours_message: body.after_hours_message || null,
        can_search_inventory: body.can_search_inventory ?? true,
        can_capture_leads: body.can_capture_leads ?? true,
        can_transfer_calls: body.can_transfer_calls ?? false,
        transfer_phone_number: body.transfer_phone_number || null,
        plan_tier: body.plan_tier || 'starter',
        minutes_included: body.minutes_included || 100,
        is_active: body.is_active ?? false,
        is_provisioned: !!body.phone_number,
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
