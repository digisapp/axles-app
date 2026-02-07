import { NextRequest, NextResponse } from 'next/server';
import { estimatePrice } from '@/lib/ai/pricing';
import type { Listing } from '@/types';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, rateLimitResponse } from '@/lib/security/rate-limit';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, {
      ...RATE_LIMITS.ai,
      prefix: 'ratelimit:ai-price',
    });
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const listing: Partial<Listing> = await request.json();

    if (!listing) {
      return NextResponse.json(
        { error: 'Listing data is required' },
        { status: 400 }
      );
    }

    const estimate = await estimatePrice(listing);

    return NextResponse.json({ data: estimate });
  } catch (error) {
    logger.error('AI Price estimation error', { error });
    return NextResponse.json(
      { error: 'Failed to estimate price' },
      { status: 500 }
    );
  }
}
