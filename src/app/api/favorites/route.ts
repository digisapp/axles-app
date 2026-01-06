import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - Fetch user's favorites
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: favorites, error } = await supabase
    .from('favorites')
    .select(`
      listing_id,
      created_at,
      listing:listings(
        id, title, price, price_type, condition, year, make, model,
        city, state, status, views_count, created_at,
        images:listing_images(id, url, is_primary)
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filter out any listings that no longer exist
  const validFavorites = favorites?.filter((f) => f.listing) || [];

  return NextResponse.json({ data: validFavorites });
}

// POST - Add a favorite
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { listing_id } = body;

  if (!listing_id) {
    return NextResponse.json({ error: 'Listing ID required' }, { status: 400 });
  }

  // Check if listing exists
  const { data: listing } = await supabase
    .from('listings')
    .select('id')
    .eq('id', listing_id)
    .single();

  if (!listing) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
  }

  // Check if already favorited
  const { data: existing } = await supabase
    .from('favorites')
    .select('listing_id')
    .eq('user_id', user.id)
    .eq('listing_id', listing_id)
    .single();

  if (existing) {
    return NextResponse.json({ data: { already_exists: true } });
  }

  // Add favorite
  const { error } = await supabase
    .from('favorites')
    .insert({
      user_id: user.id,
      listing_id,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: { success: true } });
}

// DELETE - Remove a favorite
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const listingId = searchParams.get('listing_id');

  if (!listingId) {
    return NextResponse.json({ error: 'Listing ID required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', user.id)
    .eq('listing_id', listingId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: { success: true } });
}
