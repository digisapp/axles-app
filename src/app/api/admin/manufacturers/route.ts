import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkIsAdmin, logAdminAction } from '@/lib/admin/check-admin';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, rateLimitResponse } from '@/lib/security/rate-limit';
import { logger } from '@/lib/logger';
import { validateBody, ValidationError, manufacturerSchema } from '@/lib/validations/api';

export async function GET(request: NextRequest) {
  try {
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, {
      ...RATE_LIMITS.standard,
      prefix: 'ratelimit:admin-manufacturers',
    });
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const { isAdmin } = await checkIsAdmin();

    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const search = searchParams.get('search') || '';
    const equipmentType = searchParams.get('equipment_type');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    const supabase = await createClient();

    let query = supabase
      .from('manufacturers')
      .select('*', { count: 'exact' });

    // Filter by status
    if (status === 'active') {
      query = query.eq('is_active', true);
    } else if (status === 'inactive') {
      query = query.eq('is_active', false);
    }

    // Search
    if (search) {
      query = query.or(`name.ilike.%${search}%,canonical_name.ilike.%${search}%`);
    }

    // Filter by equipment type
    if (equipmentType) {
      query = query.contains('equipment_types', [equipmentType]);
    }

    // Pagination and ordering
    query = query
      .order('is_featured', { ascending: false })
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    const { data: manufacturers, count, error } = await query;

    if (error) {
      logger.error('Error fetching manufacturers', { error });
      return NextResponse.json({ error: 'Failed to fetch manufacturers' }, { status: 500 });
    }

    // Get counts
    const { count: activeCount } = await supabase
      .from('manufacturers')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    const { count: featuredCount } = await supabase
      .from('manufacturers')
      .select('*', { count: 'exact', head: true })
      .eq('is_featured', true);

    return NextResponse.json({
      data: manufacturers,
      total: count || 0,
      page,
      limit,
      total_pages: Math.ceil((count || 0) / limit),
      counts: {
        total: count || 0,
        active: activeCount || 0,
        featured: featuredCount || 0,
      },
    });
  } catch (error) {
    logger.error('Admin manufacturers error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, {
      ...RATE_LIMITS.standard,
      prefix: 'ratelimit:admin-manufacturers',
    });
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const { isAdmin, userId } = await checkIsAdmin();

    if (!isAdmin || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    let validatedData;
    try {
      validatedData = validateBody(manufacturerSchema, body);
    } catch (err) {
      if (err instanceof ValidationError) {
        return NextResponse.json(
          { error: 'Validation failed', details: err.errors },
          { status: 400 }
        );
      }
      throw err;
    }

    const {
      name,
      slug,
      logo_url,
      description,
      short_description,
      website,
      country,
      headquarters,
      founded_year,
      equipment_types,
      canonical_name,
      name_variations,
      is_featured,
      feature_tier,
      feature_expires_at,
    } = validatedData;

    // Generate slug if not provided
    const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const supabase = await createClient();

    // Check for duplicate slug
    const { data: existing } = await supabase
      .from('manufacturers')
      .select('id')
      .eq('slug', finalSlug)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'A manufacturer with this slug already exists' }, { status: 400 });
    }

    const { data: manufacturer, error } = await supabase
      .from('manufacturers')
      .insert({
        name,
        slug: finalSlug,
        logo_url,
        description,
        short_description,
        website,
        country: country || 'USA',
        headquarters,
        founded_year,
        equipment_types: equipment_types || [],
        canonical_name,
        name_variations: name_variations || [],
        is_featured: is_featured || false,
        feature_tier: feature_tier || 'free',
        feature_expires_at,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating manufacturer', { error });
      return NextResponse.json({ error: 'Failed to create manufacturer' }, { status: 500 });
    }

    await logAdminAction(userId, 'create_manufacturer', 'manufacturer', manufacturer.id, { name });

    return NextResponse.json({ data: manufacturer });
  } catch (error) {
    logger.error('Admin create manufacturer error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
