import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - Fetch messages for a specific conversation (listing + user combo)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // conversationId format: listingId-otherUserId
  const [listingId, otherUserId] = conversationId.split('-');

  if (!listingId || !otherUserId) {
    return NextResponse.json({ error: 'Invalid conversation ID' }, { status: 400 });
  }

  // Fetch all messages between these users for this listing
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
      sender:profiles!messages_sender_id_fkey(id, company_name, email, avatar_url)
    `)
    .eq('listing_id', listingId)
    .or(`and(sender_id.eq.${user.id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${user.id})`)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mark messages as read
  await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('listing_id', listingId)
    .eq('sender_id', otherUserId)
    .eq('recipient_id', user.id);

  // Get listing and other user info
  const { data: listing } = await supabase
    .from('listings')
    .select(`
      id, title, price,
      images:listing_images(url, is_primary)
    `)
    .eq('id', listingId)
    .single();

  const { data: otherUser } = await supabase
    .from('profiles')
    .select('id, company_name, email, avatar_url')
    .eq('id', otherUserId)
    .single();

  return NextResponse.json({
    data: {
      messages,
      listing,
      otherUser,
    },
  });
}

// PUT - Mark messages as read
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [listingId, otherUserId] = conversationId.split('-');

  const { error } = await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('listing_id', listingId)
    .eq('sender_id', otherUserId)
    .eq('recipient_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
