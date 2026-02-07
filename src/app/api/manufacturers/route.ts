import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const equipmentType = searchParams.get('equipment_type');
    const featuredOnly = searchParams.get('featured_only') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = await createClient();

    let query = supabase
      .from('manufacturers')
      .select('*', { count: 'exact' })
      .eq('is_active', true);

    // Search
    if (q) {
      query = query.or(`name.ilike.%${q}%,canonical_name.ilike.%${q}%`);
    }

    // Filter by equipment type
    if (equipmentType) {
      query = query.contains('equipment_types', [equipmentType]);
    }

    // Featured only
    if (featuredOnly) {
      query = query.eq('is_featured', true);
    }

    // Order: featured first, then by listing count, then alphabetically
    query = query
      .order('is_featured', { ascending: false })
      .order('feature_tier', { ascending: false })
      .order('listing_count', { ascending: false })
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    const { data: manufacturers, count, error } = await query;

    if (error) {
      logger.error('Error fetching manufacturers', { error });
      return NextResponse.json({ error: 'Failed to fetch manufacturers' }, { status: 500 });
    }

    return NextResponse.json({
      data: manufacturers,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('Manufacturers API error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
