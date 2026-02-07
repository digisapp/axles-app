import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { estimatePrice } from '@/lib/price-estimator';
import { logger } from '@/lib/logger';

// GET - Fetch a single listing
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: listing, error } = await supabase
    .from('listings')
    .select(`
      *,
      category:categories(id, name, slug),
      images:listing_images(id, url, thumbnail_url, is_primary, sort_order),
      user:profiles(id, company_name, phone, email, avatar_url, is_dealer)
    `)
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json({ data: listing });
}

// PUT - Update a listing
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify listing ownership and get current data
  const { data: existingListing } = await supabase
    .from('listings')
    .select('user_id, price, ai_price_estimate')
    .eq('id', id)
    .single();

  if (!existingListing || existingListing.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();

  const updateData = {
    title: body.title,
    category_id: body.category_id || null,
    price: body.price ? parseFloat(body.price) : null,
    price_type: body.price_type,
    condition: body.condition || null,
    year: body.year ? parseInt(body.year) : null,
    make: body.make || null,
    model: body.model || null,
    vin: body.vin || null,
    mileage: body.mileage ? parseInt(body.mileage) : null,
    hours: body.hours ? parseInt(body.hours) : null,
    description: body.description || null,
    city: body.city || null,
    state: body.state || null,
    zip_code: body.zip_code || null,
    specs: body.specs || {},
    status: body.status,
    ai_price_estimate: body.ai_price_estimate || null,
    ai_price_confidence: body.ai_price_confidence || null,
    publish_at: body.publish_at || null,
    unpublish_at: body.unpublish_at || null,
    updated_at: new Date().toISOString(),
  };

  // If publishing for the first time, set published_at
  if (body.status === 'active' && !body.published_at) {
    (updateData as Record<string, unknown>).published_at = new Date().toISOString();
  }

  const { data: listing, error } = await supabase
    .from('listings')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Re-estimate price if price changed or no estimate exists
  const newPrice = body.price ? parseFloat(body.price) : null;
  const priceChanged = newPrice !== existingListing.price;
  const needsEstimate = newPrice && newPrice > 0 && (priceChanged || !existingListing.ai_price_estimate);

  if (needsEstimate) {
    try {
      const estimate = await estimatePrice({
        id: listing.id,
        make: listing.make,
        model: listing.model,
        year: listing.year,
        category_id: listing.category_id,
        mileage: listing.mileage,
        condition: listing.condition,
      });

      if (estimate.estimate !== null && estimate.confidence >= 0.3) {
        await supabase
          .from('listings')
          .update({
            ai_price_estimate: estimate.estimate,
            ai_price_confidence: estimate.confidence,
          })
          .eq('id', id);

        // Include estimate in response
        listing.ai_price_estimate = estimate.estimate;
        listing.ai_price_confidence = estimate.confidence;
      }
    } catch (estimateError) {
      logger.error('Price estimate error', { estimateError });
      // Don't fail the request if estimation fails
    }
  }

  return NextResponse.json({ data: listing });
}

// DELETE - Delete a listing
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify listing ownership
  const { data: listing } = await supabase
    .from('listings')
    .select('user_id')
    .eq('id', id)
    .single();

  if (!listing || listing.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Get all images to delete from storage
  const { data: images } = await supabase
    .from('listing_images')
    .select('url')
    .eq('listing_id', id);

  // Delete images from storage
  if (images && images.length > 0) {
    const paths = images
      .map((img) => {
        const urlParts = img.url.split('/listing-images/');
        return urlParts[1];
      })
      .filter(Boolean);

    if (paths.length > 0) {
      await supabase.storage.from('listing-images').remove(paths);
    }
  }

  // Delete the listing (images cascade due to ON DELETE CASCADE)
  const { error } = await supabase
    .from('listings')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
