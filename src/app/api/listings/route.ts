import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { estimatePrice } from '@/lib/price-estimator';
import {
  cacheGet,
  cacheSet,
  generateSearchCacheKey,
  CACHE_TTL,
  isRedisConfigured,
} from '@/lib/cache';
import { createListingSchema, validateBody, ValidationError } from '@/lib/validations/api';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, rateLimitResponse } from '@/lib/security/rate-limit';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const supabase = await createClient();

  // Parse and validate pagination parameters with limits
  const rawPage = parseInt(searchParams.get('page') || '1');
  const rawPerPage = parseInt(searchParams.get('per_page') || '20');

  // Enforce limits to prevent resource exhaustion
  const page = Math.max(1, Math.min(rawPage, 1000)); // Max 1000 pages
  const perPage = Math.max(1, Math.min(rawPerPage, 100)); // Max 100 items per page
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

  // Try to get cached results if Redis is available
  const cacheParams = {
    page: page.toString(),
    perPage: perPage.toString(),
    category: category || undefined,
    minPrice: minPrice || undefined,
    maxPrice: maxPrice || undefined,
    minYear: minYear || undefined,
    maxYear: maxYear || undefined,
    make: make || undefined,
    model: model || undefined,
    condition: condition || undefined,
    state: state || undefined,
    city: city || undefined,
    maxMileage: maxMileage || undefined,
    featured: featured || undefined,
    listingType: listingType || undefined,
    industry: industry || undefined,
    sort,
    order,
    search: search || undefined,
  };

  const cacheKey = generateSearchCacheKey(cacheParams);

  // Check cache first
  if (isRedisConfigured()) {
    const cached = await cacheGet<{
      data: unknown[];
      total: number;
      page: number;
      per_page: number;
      total_pages: number;
    }>(cacheKey);

    if (cached) {
      return NextResponse.json({
        ...cached,
        cached: true,
      });
    }
  }

  let query = supabase
    .from('listings')
    .select(`
      *,
      category:categories!left(id, name, slug),
      images:listing_images!left(id, url, thumbnail_url, is_primary, sort_order),
      user:profiles!listings_user_id_fkey(id, company_name, avatar_url, is_dealer)
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
    logger.error('Listings query error', { error });
    return NextResponse.json(
      { error: 'Failed to fetch listings' },
      { status: 500 }
    );
  }

  const response = {
    data,
    total: count || 0,
    page,
    per_page: perPage,
    total_pages: Math.ceil((count || 0) / perPage),
  };

  // Cache the results
  if (isRedisConfigured()) {
    await cacheSet(cacheKey, response, CACHE_TTL.SEARCH_RESULTS);
  }

  return NextResponse.json(response);
}

export async function POST(request: NextRequest) {
  const identifier = getClientIdentifier(request);
  const rateLimitResult = await checkRateLimit(identifier, {
    ...RATE_LIMITS.standard,
    prefix: 'ratelimit:listings',
  });
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult);
  }

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

    // Validate input with Zod
    let validatedData;
    try {
      validatedData = validateBody(createListingSchema, body);
    } catch (err) {
      if (err instanceof ValidationError) {
        return NextResponse.json(
          { error: 'Validation failed', details: err.errors },
          { status: 400 }
        );
      }
      throw err;
    }

    // Extract industries from the validated data
    const { industries, ...listingData } = validatedData;

    const { data, error } = await supabase
      .from('listings')
      .insert({
        ...listingData,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      logger.error('Create listing error', { error });
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
        logger.error('Industry insert error', { industryError });
        // Don't fail the whole request, just log the error
      }
    }

    // Auto-estimate price if listing has a price
    if (data.price && data.price > 0) {
      try {
        const estimate = await estimatePrice({
          id: data.id,
          make: data.make,
          model: data.model,
          year: data.year,
          category_id: data.category_id,
          mileage: data.mileage,
          condition: data.condition,
        });

        if (estimate.estimate !== null && estimate.confidence >= 0.3) {
          await supabase
            .from('listings')
            .update({
              ai_price_estimate: estimate.estimate,
              ai_price_confidence: estimate.confidence,
            })
            .eq('id', data.id);
        }
      } catch (estimateError) {
        logger.error('Price estimate error', { estimateError });
        // Don't fail the request if estimation fails
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
