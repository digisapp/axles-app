import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { backfillEstimates, updateListingEstimate } from '@/lib/price-estimator';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, rateLimitResponse } from '@/lib/security/rate-limit';
import { logger } from '@/lib/logger';

// POST - Backfill estimates for multiple listings
export async function POST(request: NextRequest) {
  // Apply rate limiting (AI operations are expensive)
  const identifier = getClientIdentifier(request);
  const rateLimitResult = await checkRateLimit(identifier, {
    ...RATE_LIMITS.ai,
    prefix: 'ratelimit:admin:estimates',
  });

  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult);
  }

  const supabase = await createClient();

  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const { limit = 100 } = await request.json().catch(() => ({}));

    const result = await backfillEstimates(limit);

    return NextResponse.json({
      success: true,
      ...result,
      message: `Processed ${result.processed} listings. Updated: ${result.updated}, Skipped: ${result.skipped}`,
    });
  } catch (error) {
    logger.error('Backfill error', { error });
    return NextResponse.json(
      { error: 'Failed to backfill estimates' },
      { status: 500 }
    );
  }
}

// GET - Estimate price for a single listing
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const identifier = getClientIdentifier(request);
  const rateLimitResult = await checkRateLimit(identifier, {
    ...RATE_LIMITS.ai,
    prefix: 'ratelimit:admin:estimates',
  });

  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult);
  }

  const { searchParams } = new URL(request.url);
  const listingId = searchParams.get('listing_id');

  if (!listingId) {
    return NextResponse.json(
      { error: 'listing_id is required' },
      { status: 400 }
    );
  }

  try {
    const estimate = await updateListingEstimate(listingId);

    return NextResponse.json({
      success: true,
      listing_id: listingId,
      ...estimate,
    });
  } catch (error) {
    logger.error('Estimate error', { error });
    return NextResponse.json(
      { error: 'Failed to estimate price' },
      { status: 500 }
    );
  }
}
