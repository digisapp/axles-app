import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const supabase = await createClient();

  // Parse query parameters
  const category = searchParams.get('category');
  const limit = parseInt(searchParams.get('limit') || '10');
  const minDiscount = parseInt(searchParams.get('min_discount') || '5'); // Minimum % below market
  const shuffle = searchParams.get('shuffle') === 'true'; // Randomize results

  // Build query for deals (price < ai_price_estimate)
  let query = supabase
    .from('listings')
    .select(`
      *,
      category:categories!left(id, name, slug),
      images:listing_images!left(id, url, thumbnail_url, is_primary, sort_order)
    `)
    .eq('status', 'active')
    .not('price', 'is', null)
    .not('ai_price_estimate', 'is', null)
    .gt('ai_price_estimate', 0);

  // Filter by category if specified
  if (category) {
    const { data: categoryData } = await supabase
      .from('categories')
      .select('id, parent_id')
      .eq('slug', category)
      .single();

    if (categoryData) {
      if (!categoryData.parent_id) {
        // Parent category - include children
        const { data: childCategories } = await supabase
          .from('categories')
          .select('id')
          .eq('parent_id', categoryData.id);

        if (childCategories && childCategories.length > 0) {
          const categoryIds = [categoryData.id, ...childCategories.map(c => c.id)];
          query = query.in('category_id', categoryIds);
        } else {
          query = query.eq('category_id', categoryData.id);
        }
      } else {
        query = query.eq('category_id', categoryData.id);
      }
    }
  }

  // Order by created_at to get recent listings first
  query = query.order('created_at', { ascending: false }).limit(100);

  const { data: listings, error } = await query;

  if (error) {
    console.error('Deals query error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deals' },
      { status: 500 }
    );
  }

  // Calculate discount and filter for deals
  let deals = (listings || [])
    .map(listing => {
      const discount = Math.round(
        ((listing.ai_price_estimate - listing.price) / listing.ai_price_estimate) * 100
      );
      return {
        ...listing,
        discount_percent: discount,
        savings: listing.ai_price_estimate - listing.price,
      };
    })
    .filter(listing => listing.discount_percent >= minDiscount);

  // Either shuffle or sort by discount
  if (shuffle) {
    // Fisher-Yates shuffle for random selection
    for (let i = deals.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deals[i], deals[j]] = [deals[j], deals[i]];
    }
  } else {
    deals = deals.sort((a, b) => b.discount_percent - a.discount_percent);
  }

  deals = deals.slice(0, limit);

  return NextResponse.json({
    data: deals,
    total: deals.length,
  });
}
