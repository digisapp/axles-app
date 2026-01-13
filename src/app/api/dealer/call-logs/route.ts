import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/dealer/call-logs - Get dealer's call logs
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const status = searchParams.get('status'); // 'completed', 'missed', 'in_progress'
    const search = searchParams.get('search'); // Search by caller phone or name

    const offset = (page - 1) * limit;

    // First get the dealer's voice agent ID
    const { data: voiceAgent } = await supabase
      .from('dealer_voice_agents')
      .select('id')
      .eq('dealer_id', user.id)
      .single();

    if (!voiceAgent) {
      return NextResponse.json({
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 }
      });
    }

    // Build query for call logs
    let query = supabase
      .from('call_logs')
      .select('id, caller_phone, caller_name, duration_seconds, status, recording_url, interest, equipment_type, intent, lead_id, started_at, ended_at, transcript, transcript_status, summary', { count: 'exact' })
      .eq('dealer_voice_agent_id', voiceAgent.id)
      .order('started_at', { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`caller_phone.ilike.%${search}%,caller_name.ilike.%${search}%`);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: calls, error, count } = await query;

    if (error) {
      console.error('Error fetching call logs:', error);
      return NextResponse.json({ error: 'Failed to fetch call logs' }, { status: 500 });
    }

    // Calculate stats
    const { data: statsData } = await supabase
      .from('call_logs')
      .select('duration_seconds, status, lead_id')
      .eq('dealer_voice_agent_id', voiceAgent.id);

    const stats = {
      totalCalls: statsData?.length || 0,
      totalMinutes: Math.round((statsData?.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) || 0) / 60),
      leadsCapture: statsData?.filter(c => c.lead_id).length || 0,
      avgDuration: statsData?.length
        ? Math.round((statsData.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / statsData.length))
        : 0,
    };

    return NextResponse.json({
      data: calls || [],
      stats,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Error in GET /api/dealer/call-logs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
