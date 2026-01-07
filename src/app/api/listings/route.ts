import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const supabase = await createClient();

  // Parse query parameters
  const page = parseInt(searchParams.get('page') || '1');
  const perPage = parseInt(searchParams.get('per_page') || '20');
  const category = searchParams.get('category');
  const minPrice = searchParams.get('min_price');
  const maxPrice = searchParams.get('max_price');
  const minYear = searchParams.get('min_year');
  const maxYear = searchParams.get('max_year');
  const make = searchParams.get('make');
  const model = searchParams.get('model');
  const condition = searchParams.get('condition');
  const state = searchParams.get('state');
  const city = searchParams.get('city');
  const maxMileage = searchParams.get('max_mileage');
  const featured = searchParams.get('featured');
  const listingType = searchParams.get('listing_type');
  const industry = searchParams.get('industry');
  const sort = searchParams.get('sort') || 'created_at';
  const order = searchParams.get('order') || 'desc';
  const search = searchParams.get('q');

  let query = supabase
    .from('listings')
    .select(`
      *,
      category:categories!left(id, name, slug),
      images:listing_images!left(id, url, thumbnail_url, is_primary, sort_order),
      user:profiles!left(id, company_name, avatar_url, is_dealer)
    `, { count: 'exact' })
    .eq('status', 'active');

  // Apply filters
  if (category) {
    // Get category by slug and check if it's a parent category
    const { data: categoryData } = await supabase
      .from('categories')
      .select('id, parent_id')
      .eq('slug', category)
      .single();

    if (categoryData) {
      // If this is a parent category (has no parent_id), also include all child categories
      if (!categoryData.parent_id) {
        // Get all child category IDs
        const { data: childCategories } = await supabase
          .from('categories')
          .select('id')
          .eq('parent_id', categoryData.id);

        if (childCategories && childCategories.length > 0) {
          // Include parent and all children
          const categoryIds = [categoryData.id, ...childCategories.map(c => c.id)];
          query = query.in('category_id', categoryIds);
        } else {
          query = query.eq('category_id', categoryData.id);
        }
      } else {
        // It's a child category, match exactly
        query = query.eq('category_id', categoryData.id);
      }
    }
  }

  if (minPrice) query = query.gte('price', parseFloat(minPrice));
  if (maxPrice) query = query.lte('price', parseFloat(maxPrice));
  if (minYear) query = query.gte('year', parseInt(minYear));
  if (maxYear) query = query.lte('year', parseInt(maxYear));
  if (make) {
    // Support multiple makes (comma-separated)
    const makes = make.split(',').map(m => m.trim()).filter(Boolean);
    if (makes.length === 1) {
      query = query.ilike('make', `%${makes[0]}%`);
    } else if (makes.length > 1) {
      // Use OR filter for multiple makes
      query = query.or(makes.map(m => `make.ilike.%${m}%`).join(','));
    }
  }
  if (model) query = query.ilike('model', `%${model}%`);
  if (condition) {
    // Support multiple conditions (comma-separated)
    const conditions = condition.split(',').map(c => c.trim()).filter(Boolean);
    if (conditions.length === 1) {
      query = query.eq('condition', conditions[0]);
    } else if (conditions.length > 1) {
      query = query.in('condition', conditions);
    }
  }
  if (state) {
    // Support multiple states (comma-separated)
    const states = state.split(',').map(s => s.trim()).filter(Boolean);
    if (states.length === 1) {
      query = query.eq('state', states[0]);
    } else if (states.length > 1) {
      query = query.in('state', states);
    }
  }
  if (city) query = query.ilike('city', `%${city}%`);
  if (maxMileage) query = query.lte('mileage', parseInt(maxMileage));
  if (featured === 'true') query = query.eq('is_featured', true);
  if (listingType) {
    if (listingType === 'rent') {
      query = query.in('listing_type', ['rent', 'sale_or_rent']);
    } else if (listingType === 'sale') {
      query = query.in('listing_type', ['sale', 'sale_or_rent']);
    }
  }

  // Full-text search
  if (search) {
    query = query.textSearch('search_vector', search, {
      type: 'websearch',
      config: 'english',
    });
  }

  // Sorting
  const validSortFields = ['created_at', 'price', 'year', 'mileage', 'views_count'];
  const sortField = validSortFields.includes(sort) ? sort : 'created_at';
  const sortOrder = order === 'asc' ? true : false;

  // Featured listings first
  query = query.order('is_featured', { ascending: false });
  query = query.order(sortField, { ascending: sortOrder });

  // Pagination
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error('Listings query error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch listings' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    data,
    total: count || 0,
    page,
    per_page: perPage,
    total_pages: Math.ceil((count || 0) / perPage),
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    // Extract industries from the request body
    const { industries, ...listingData } = body;

    const { data, error } = await supabase
      .from('listings')
      .insert({
        ...listingData,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Create listing error:', error);
      return NextResponse.json(
        { error: 'Failed to create listing' },
        { status: 500 }
      );
    }

    // If industries were provided, insert them into the junction table
    if (industries && Array.isArray(industries) && industries.length > 0) {
      const industryInserts = industries.map((industryId: string) => ({
        listing_id: data.id,
        industry_id: industryId,
      }));

      const { error: industryError } = await supabase
        .from('listing_industries')
        .insert(industryInserts);

      if (industryError) {
        console.error('Industry insert error:', industryError);
        // Don't fail the whole request, just log the error
      }
    }

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
