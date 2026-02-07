import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateBody, ValidationError, listingImagesSchema, updateImagesOrderSchema } from '@/lib/validations/api';

// GET - Fetch images for a listing
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: images, error } = await supabase
    .from('listing_images')
    .select('*')
    .eq('listing_id', id)
    .order('sort_order');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: images });
}

// POST - Add images to a listing
export async function POST(
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

  const body = await request.json();
  let validatedData;
  try {
    validatedData = validateBody(listingImagesSchema, body);
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Validation failed', details: err.errors },
        { status: 400 }
      );
    }
    throw err;
  }
  const { images } = validatedData;

  // Get current max sort order
  const { data: existingImages } = await supabase
    .from('listing_images')
    .select('sort_order')
    .eq('listing_id', id)
    .order('sort_order', { ascending: false })
    .limit(1);

  const startOrder = existingImages?.[0]?.sort_order ?? -1;

  // Insert new images
  const imagesToInsert = images.map((img, index) => ({
    listing_id: id,
    url: img.url,
    thumbnail_url: img.thumbnail_url || null,
    is_primary: img.is_primary || false,
    sort_order: startOrder + index + 1,
    ai_analysis: img.ai_analysis || null,
  }));

  const { data: insertedImages, error } = await supabase
    .from('listing_images')
    .insert(imagesToInsert)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: insertedImages });
}

// PUT - Update image order or primary status
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

  // Verify listing ownership
  const { data: listing } = await supabase
    .from('listings')
    .select('user_id')
    .eq('id', id)
    .single();

  if (!listing || listing.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  let validatedOrderData;
  try {
    validatedOrderData = validateBody(updateImagesOrderSchema, body);
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Validation failed', details: err.errors },
        { status: 400 }
      );
    }
    throw err;
  }
  const { images } = validatedOrderData;

  // Update all images in parallel (avoids sequential N+1)
  await Promise.all(
    images
      .filter((img: { id?: string }) => img.id)
      .map((img: { id: string; is_primary?: boolean; sort_order?: number }) =>
        supabase
          .from('listing_images')
          .update({
            is_primary: img.is_primary,
            sort_order: img.sort_order,
          })
          .eq('id', img.id)
          .eq('listing_id', id)
      )
  );

  // Fetch updated images
  const { data: updatedImages } = await supabase
    .from('listing_images')
    .select('*')
    .eq('listing_id', id)
    .order('sort_order');

  return NextResponse.json({ data: updatedImages });
}

// DELETE - Remove an image
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

  const { searchParams } = new URL(request.url);
  const imageId = searchParams.get('imageId');

  if (!imageId) {
    return NextResponse.json({ error: 'Image ID required' }, { status: 400 });
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

  // Get image URL for storage deletion
  const { data: image } = await supabase
    .from('listing_images')
    .select('url')
    .eq('id', imageId)
    .single();

  if (image?.url) {
    // Extract path from URL and delete from storage
    const urlParts = image.url.split('/listing-images/');
    if (urlParts[1]) {
      await supabase.storage.from('listing-images').remove([urlParts[1]]);
    }
  }

  // Delete from database
  const { error } = await supabase
    .from('listing_images')
    .delete()
    .eq('id', imageId)
    .eq('listing_id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
