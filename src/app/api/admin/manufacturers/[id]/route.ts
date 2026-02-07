import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkIsAdmin, logAdminAction } from '@/lib/admin/check-admin';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, rateLimitResponse } from '@/lib/security/rate-limit';
import { logger } from '@/lib/logger';
import { validateBody, ValidationError, manufacturerSchema } from '@/lib/validations/api';

const updateManufacturerSchema = manufacturerSchema.partial();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, {
      ...RATE_LIMITS.standard,
      prefix: 'ratelimit:admin-manufacturers',
    });
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const { id } = await params;
    const { isAdmin } = await checkIsAdmin();

    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const supabase = await createClient();

    const { data: manufacturer, error } = await supabase
      .from('manufacturers')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !manufacturer) {
      return NextResponse.json({ error: 'Manufacturer not found' }, { status: 404 });
    }

    // Get actual listing count
    const { count: listingCount } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .ilike('make', manufacturer.canonical_name)
      .eq('status', 'active');

    return NextResponse.json({
      data: {
        ...manufacturer,
        listing_count: listingCount || 0,
      },
    });
  } catch (error) {
    logger.error('Admin get manufacturer error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, {
      ...RATE_LIMITS.standard,
      prefix: 'ratelimit:admin-manufacturers',
    });
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const { id } = await params;
    const { isAdmin, userId } = await checkIsAdmin();

    if (!isAdmin || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    let validatedData;
    try {
      validatedData = validateBody(updateManufacturerSchema, body);
    } catch (err) {
      if (err instanceof ValidationError) {
        return NextResponse.json(
          { error: 'Validation failed', details: err.errors },
          { status: 400 }
        );
      }
      throw err;
    }

    const supabase = await createClient();

    // Get current manufacturer
    const { data: existing, error: fetchError } = await supabase
      .from('manufacturers')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Manufacturer not found' }, { status: 404 });
    }

    // If slug is changing, check for duplicates
    if (validatedData.slug && validatedData.slug !== existing.slug) {
      const { data: duplicate } = await supabase
        .from('manufacturers')
        .select('id')
        .eq('slug', validatedData.slug)
        .neq('id', id)
        .single();

      if (duplicate) {
        return NextResponse.json({ error: 'A manufacturer with this slug already exists' }, { status: 400 });
      }
    }

    // Build update data (only include fields that were sent)
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    const allowedFields = [
      'name', 'slug', 'logo_url', 'description', 'short_description',
      'website', 'country', 'headquarters', 'founded_year',
      'equipment_types', 'canonical_name', 'name_variations',
      'is_featured', 'feature_tier', 'feature_expires_at', 'is_active'
    ];

    for (const field of allowedFields) {
      if ((validatedData as Record<string, unknown>)[field] !== undefined) {
        updateData[field] = (validatedData as Record<string, unknown>)[field];
      }
    }

    const { data: manufacturer, error: updateError } = await supabase
      .from('manufacturers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      logger.error('Error updating manufacturer', { updateError });
      return NextResponse.json({ error: 'Failed to update manufacturer' }, { status: 500 });
    }

    await logAdminAction(userId, 'update_manufacturer', 'manufacturer', id, {
      name: manufacturer.name,
      changes: Object.keys(updateData).filter(k => k !== 'updated_at'),
    });

    return NextResponse.json({ data: manufacturer });
  } catch (error) {
    logger.error('Admin update manufacturer error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, {
      ...RATE_LIMITS.standard,
      prefix: 'ratelimit:admin-manufacturers',
    });
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const { id } = await params;
    const { isAdmin, userId } = await checkIsAdmin();

    if (!isAdmin || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const supabase = await createClient();

    // Get manufacturer name for logging
    const { data: manufacturer, error: fetchError } = await supabase
      .from('manufacturers')
      .select('name')
      .eq('id', id)
      .single();

    if (fetchError || !manufacturer) {
      return NextResponse.json({ error: 'Manufacturer not found' }, { status: 404 });
    }

    // Soft delete (set is_active = false)
    const { error: deleteError } = await supabase
      .from('manufacturers')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (deleteError) {
      logger.error('Error deleting manufacturer', { deleteError });
      return NextResponse.json({ error: 'Failed to delete manufacturer' }, { status: 500 });
    }

    await logAdminAction(userId, 'delete_manufacturer', 'manufacturer', id, {
      name: manufacturer.name,
    });

    return NextResponse.json({ success: true, message: 'Manufacturer deactivated' });
  } catch (error) {
    logger.error('Admin delete manufacturer error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
