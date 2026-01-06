import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - Fetch conversations for the current user
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get all conversations where user is sender or recipient
  const { data: messages, error } = await supabase
    .from('messages')
    .select(`
      id,
      listing_id,
      sender_id,
      recipient_id,
      content,
      is_read,
      created_at,
      listing:listings(id, title, price, images:listing_images(url, is_primary)),
      sender:profiles!messages_sender_id_fkey(id, company_name, email, avatar_url),
      recipient:profiles!messages_recipient_id_fkey(id, company_name, email, avatar_url)
    `)
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group messages into conversations by listing + other party
  const conversationsMap = new Map();

  messages?.forEach((msg) => {
    const otherUserId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
    const key = `${msg.listing_id}-${otherUserId}`;

    if (!conversationsMap.has(key)) {
      conversationsMap.set(key, {
        listing: msg.listing,
        otherUser: msg.sender_id === user.id ? msg.recipient : msg.sender,
        lastMessage: msg,
        unreadCount: 0,
        messages: [],
      });
    }

    const conv = conversationsMap.get(key);
    conv.messages.push(msg);

    if (!msg.is_read && msg.recipient_id === user.id) {
      conv.unreadCount++;
    }
  });

  const conversations = Array.from(conversationsMap.values());

  return NextResponse.json({ data: conversations });
}

// POST - Send a new message
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { listing_id, recipient_id, content } = body;

  if (!listing_id || !recipient_id || !content) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Cannot message yourself
  if (recipient_id === user.id) {
    return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 });
  }

  // Verify listing exists
  const { data: listing } = await supabase
    .from('listings')
    .select('id, user_id')
    .eq('id', listing_id)
    .single();

  if (!listing) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
  }

  // Insert message
  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      listing_id,
      sender_id: user.id,
      recipient_id,
      content,
      is_read: false,
    })
    .select(`
      id,
      listing_id,
      sender_id,
      recipient_id,
      content,
      is_read,
      created_at
    `)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: message });
}
