import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const listingsLimit = parseInt(searchParams.get('listings_limit') || '12');
    const listingsOffset = parseInt(searchParams.get('listings_offset') || '0');
    const category = searchParams.get('category');

    const supabase = await createClient();

    // Get manufacturer
    const { data: manufacturer, error: mfrError } = await supabase
      .from('manufacturers')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (mfrError || !manufacturer) {
      return NextResponse.json({ error: 'Manufacturer not found' }, { status: 404 });
    }

    // Build listings query
    let listingsQuery = supabase
      .from('listings')
      .select(`
        id,
        title,
        price,
        year,
        make,
        model,
        condition,
        mileage,
        hours,
        city,
        state,
        is_featured,
        created_at,
        images:listing_images(id, url, thumbnail_url, is_primary)
      `, { count: 'exact' })
      .ilike('make', manufacturer.canonical_name)
      .eq('status', 'active');

    // Filter by category if provided
    if (category) {
      // Join with categories to filter by slug
      const { data: cat } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', category)
        .single();

      if (cat) {
        listingsQuery = listingsQuery.eq('category_id', cat.id);
      }
    }

    // Order and paginate
    listingsQuery = listingsQuery
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .range(listingsOffset, listingsOffset + listingsLimit - 1);

    const { data: listings, count: listingCount, error: listingsError } = await listingsQuery;

    if (listingsError) {
      logger.error('Error fetching listings', { listingsError });
    }

    // Get listing count by category for this manufacturer
    const { data: categoryCounts } = await supabase
      .rpc('get_manufacturer_category_counts', { make_name: manufacturer.canonical_name })
      .select('*');

    return NextResponse.json({
      data: manufacturer,
      listings: listings || [],
      listing_count: listingCount || 0,
      category_counts: categoryCounts || [],
    });
  } catch (error) {
    logger.error('Manufacturer API error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
