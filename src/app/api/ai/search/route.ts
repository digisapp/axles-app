import { NextRequest, NextResponse } from 'next/server';
import { parseSearchQuery } from '@/lib/ai/search';

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    const result = await parseSearchQuery(query);

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('AI Search error:', error);
    return NextResponse.json(
      { error: 'Failed to process search query' },
      { status: 500 }
    );
  }
}
