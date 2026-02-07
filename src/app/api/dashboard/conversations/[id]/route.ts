import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch conversation metadata and lead info
    const { data: conversation, error } = await supabase
      .from('chat_conversations')
      .select(`
        *,
        lead:leads(id, status, buyer_name, buyer_email, buyer_phone)
      `)
      .eq('id', id)
      .eq('dealer_id', user.id)
      .single();

    if (error || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Get total message count
    const { count: totalMessages } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', id);

    // Fetch messages with pagination - get most recent first, then reverse
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('id, role, content, metadata, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Reverse to get chronological order (oldest to newest)
    const sortedMessages = messages?.reverse() || [];

    return NextResponse.json({
      conversation: {
        ...conversation,
        messages: sortedMessages,
      },
      pagination: {
        total: totalMessages || 0,
        limit,
        offset,
        hasMore: (totalMessages || 0) > offset + limit,
      },
    });
  } catch (error) {
    logger.error('Conversation detail API error', { error });
    return NextResponse.json(
      { error: 'Failed to fetch conversation' },
      { status: 500 }
    );
  }
}

// Update conversation status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { status } = body;

    // Verify ownership and update
    const { data: conversation, error } = await supabase
      .from('chat_conversations')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('dealer_id', user.id)
      .select()
      .single();

    if (error || !conversation) {
      return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 });
    }

    return NextResponse.json({ conversation });
  } catch (error) {
    logger.error('Conversation update error', { error });
    return NextResponse.json(
      { error: 'Failed to update conversation' },
      { status: 500 }
    );
  }
}
