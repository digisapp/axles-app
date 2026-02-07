import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // active, closed, converted, all

    // Fetch conversations for this dealer
    let query = supabase
      .from('chat_conversations')
      .select(`
        *,
        lead:leads(id, status, buyer_name),
        messages:chat_messages(id, role, content, created_at)
      `)
      .eq('dealer_id', user.id)
      .order('updated_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: conversations, error } = await query;

    if (error) {
      logger.error('Error fetching conversations', { error });
      return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
    }

    // Process conversations to add summary info
    const processedConversations = conversations?.map((conv) => {
      const messages = conv.messages || [];
      const lastMessage = messages[messages.length - 1];
      const userMessages = messages.filter((m: { role: string }) => m.role === 'user');

      return {
        ...conv,
        message_count: messages.length,
        user_message_count: userMessages.length,
        last_message: lastMessage?.content?.substring(0, 100) || null,
        last_message_at: lastMessage?.created_at || conv.created_at,
        messages: undefined, // Remove full messages from list view
      };
    });

    return NextResponse.json({ conversations: processedConversations });
  } catch (error) {
    logger.error('Conversations API error', { error });
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}
