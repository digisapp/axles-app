import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { newTrailersQuerySchema } from '@/lib/validations/api';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse and validate query params
    const rawParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      rawParams[key] = value;
    });

    const parsed = newTrailersQuerySchema.safeParse(rawParams);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const {
      manufacturer,
      type,
      tonnage_min,
      tonnage_max,
      deck_height_max,
      axle_count,
      gooseneck,
      q,
      page,
      limit,
      sort,
    } = parsed.data;

    // Build query
    let query = supabase
      .from('manufacturer_products')
      .select(`
        *,
        manufacturers!inner(name, slug, logo_url),
        manufacturer_product_images!left(url, alt_text)
      `, { count: 'exact' })
      .eq('is_active', true)
      .eq('manufacturer_product_images.is_primary', true);

    // Filter by manufacturer slug
    if (manufacturer) {
      query = query.eq('manufacturers.slug', manufacturer);
    }

    // Filter by product type
    if (type) {
      query = query.eq('product_type', type);
    }

    // Filter by tonnage range (overlap logic)
    // Products whose range overlaps with the requested range
    if (tonnage_min !== undefined) {
      query = query.gte('tonnage_max', tonnage_min);
    }
    if (tonnage_max !== undefined) {
      query = query.lte('tonnage_min', tonnage_max);
    }

    // Filter by deck height
    if (deck_height_max !== undefined) {
      query = query.lte('deck_height_inches', deck_height_max);
    }

    // Filter by axle count
    if (axle_count !== undefined) {
      query = query.eq('axle_count', axle_count);
    }

    // Filter by gooseneck type
    if (gooseneck) {
      query = query.eq('gooseneck_type', gooseneck);
    }

    // Full-text search
    if (q) {
      const tsQuery = q
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .join(' & ');
      query = query.not('search_vector', 'is', null);
      query = query.textSearch('search_vector', tsQuery);
    }

    // Sorting
    switch (sort) {
      case 'manufacturer':
        query = query
          .order('name', { referencedTable: 'manufacturers', ascending: true })
          .order('name', { ascending: true });
        break;
      case 'tonnage':
        query = query.order('tonnage_max', { ascending: false });
        break;
      case 'deck_height':
        query = query.order('deck_height_inches', { ascending: true });
        break;
      case 'newest':
        query = query.order('created_at', { ascending: false });
        break;
      case 'name':
        query = query.order('name', { ascending: true });
        break;
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) {
      console.error('New trailers query error', error);
      return NextResponse.json(
        { error: 'Failed to fetch new trailers' },
        { status: 500 }
      );
    }

    const total = count || 0;

    return NextResponse.json({
      data: data || [],
      total,
      page,
      total_pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('New trailers API error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
