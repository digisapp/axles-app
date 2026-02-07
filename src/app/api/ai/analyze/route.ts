import { NextRequest, NextResponse } from 'next/server';
import { analyzeImage } from '@/lib/ai/vision';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      );
    }

    if (!process.env.XAI_API_KEY) {
      return NextResponse.json(
        { error: 'AI analysis not configured' },
        { status: 503 }
      );
    }

    const analysis = await analyzeImage(imageUrl);

    return NextResponse.json({ data: analysis });
  } catch (error) {
    logger.error('Image analysis error', { error });
    return NextResponse.json(
      { error: 'Failed to analyze image' },
      { status: 500 }
    );
  }
}
