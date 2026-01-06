import { NextRequest, NextResponse } from 'next/server';
import { estimatePrice } from '@/lib/ai/pricing';
import type { Listing } from '@/types';

export async function POST(request: NextRequest) {
  try {
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
    console.error('AI Price estimation error:', error);
    return NextResponse.json(
      { error: 'Failed to estimate price' },
      { status: 500 }
    );
  }
}
