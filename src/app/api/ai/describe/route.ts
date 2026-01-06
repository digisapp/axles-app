import { NextRequest, NextResponse } from 'next/server';
import { generateListingDescription } from '@/lib/ai/vision';

export async function POST(request: NextRequest) {
  try {
    const { imageUrls, specs } = await request.json();

    if (!imageUrls || imageUrls.length === 0) {
      return NextResponse.json(
        { error: 'At least one image URL is required' },
        { status: 400 }
      );
    }

    if (!process.env.XAI_API_KEY) {
      return NextResponse.json(
        { error: 'AI description generation not configured' },
        { status: 503 }
      );
    }

    const description = await generateListingDescription(imageUrls, specs || {});

    return NextResponse.json({ data: { description } });
  } catch (error) {
    console.error('Description generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate description' },
      { status: 500 }
    );
  }
}
