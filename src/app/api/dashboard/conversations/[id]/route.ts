import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
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

    // Fetch conversation with all messages
    const { data: conversation, error } = await supabase
      .from('chat_conversations')
      .select(`
        *,
        lead:leads(id, status, buyer_name, buyer_email, buyer_phone),
        messages:chat_messages(id, role, content, metadata, created_at)
      `)
      .eq('id', id)
      .eq('dealer_id', user.id)
      .single();

    if (error || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Sort messages by created_at
    if (conversation.messages) {
      conversation.messages.sort((a: { created_at: string }, b: { created_at: string }) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }

    return NextResponse.json({ conversation });
  } catch (error) {
    console.error('Conversation detail API error:', error);
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
    console.error('Conversation update error:', error);
    return NextResponse.json(
      { error: 'Failed to update conversation' },
      { status: 500 }
    );
  }
}
