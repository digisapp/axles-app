import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { startVideoGeneration, getVideoResult } from '@/lib/ai/video';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, rateLimitResponse } from '@/lib/security/rate-limit';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, {
      ...RATE_LIMITS.ai,
      prefix: 'ratelimit:ai-video-preview',
    });
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    if (!process.env.XAI_API_KEY) {
      return NextResponse.json(
        { error: 'AI video generation not configured' },
        { status: 503 }
      );
    }

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { listingId } = await request.json();
    if (!listingId) {
      return NextResponse.json({ error: 'listingId is required' }, { status: 400 });
    }

    // Verify listing ownership and get primary image
    const { data: listing } = await supabase
      .from('listings')
      .select('user_id, ai_video_status, title, make, model, year')
      .eq('id', listingId)
      .single();

    if (!listing || listing.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (listing.ai_video_status === 'generating') {
      return NextResponse.json(
        { error: 'Video generation already in progress' },
        { status: 409 }
      );
    }

    // Get primary image (fall back to first image by sort order)
    const { data: primaryImages } = await supabase
      .from('listing_images')
      .select('url, is_primary')
      .eq('listing_id', listingId)
      .order('is_primary', { ascending: false })
      .order('sort_order')
      .limit(1);

    if (!primaryImages?.[0]) {
      return NextResponse.json(
        { error: 'No images found for this listing' },
        { status: 400 }
      );
    }

    return await generateAndSave(supabase, listingId, primaryImages[0].url, listing);
  } catch (error) {
    logger.error('Video preview generation error', { error });
    return NextResponse.json(
      { error: 'Failed to start video generation' },
      { status: 500 }
    );
  }
}

async function generateAndSave(
  supabase: Awaited<ReturnType<typeof createClient>>,
  listingId: string,
  imageUrl: string,
  listing: { title?: string; make?: string; model?: string; year?: number }
) {
  const equipmentDesc = [listing.year, listing.make, listing.model].filter(Boolean).join(' ') || listing.title || 'equipment';
  const prompt = `Slow cinematic camera pan around this ${equipmentDesc}, showing it from multiple angles as if doing a walkaround inspection. Smooth steady movement.`;

  const { request_id } = await startVideoGeneration(imageUrl, prompt);

  await supabase
    .from('listings')
    .update({
      ai_video_request_id: request_id,
      ai_video_status: 'generating',
      ai_video_preview_url: null,
    })
    .eq('id', listingId);

  return NextResponse.json({
    request_id,
    status: 'generating',
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const listingId = searchParams.get('listingId');

    if (!listingId) {
      return NextResponse.json({ error: 'listingId is required' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: listing } = await supabase
      .from('listings')
      .select('user_id, ai_video_status, ai_video_request_id, ai_video_preview_url')
      .eq('id', listingId)
      .single();

    if (!listing || listing.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // If already completed or failed, return current state
    if (listing.ai_video_status !== 'generating') {
      return NextResponse.json({
        status: listing.ai_video_status,
        url: listing.ai_video_preview_url,
      });
    }

    // Poll xAI for the result
    if (!listing.ai_video_request_id) {
      return NextResponse.json({
        status: 'failed',
        url: null,
      });
    }

    try {
      const result = await getVideoResult(listing.ai_video_request_id);

      if (result.status === 'completed' && result.url) {
        await supabase
          .from('listings')
          .update({
            ai_video_status: 'completed',
            ai_video_preview_url: result.url,
          })
          .eq('id', listingId);

        return NextResponse.json({
          status: 'completed',
          url: result.url,
        });
      }

      if (result.status === 'failed') {
        await supabase
          .from('listings')
          .update({
            ai_video_status: 'failed',
            ai_video_request_id: null,
          })
          .eq('id', listingId);

        return NextResponse.json({
          status: 'failed',
          url: null,
        });
      }

      // Still pending
      return NextResponse.json({
        status: 'generating',
        url: null,
      });
    } catch (pollError) {
      logger.error('Video preview poll error', { pollError });
      return NextResponse.json({
        status: 'generating',
        url: null,
      });
    }
  } catch (error) {
    logger.error('Video preview status check error', { error });
    return NextResponse.json(
      { error: 'Failed to check video status' },
      { status: 500 }
    );
  }
}
