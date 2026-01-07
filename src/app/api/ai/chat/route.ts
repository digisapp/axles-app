import { NextRequest, NextResponse } from 'next/server';
import { createXai } from '@ai-sdk/xai';
import { generateText } from 'ai';

function getXai() {
  if (!process.env.XAI_API_KEY) {
    return null;
  }
  return createXai({
    apiKey: process.env.XAI_API_KEY,
  });
}

// Detect if the query is a question or a search
function isQuestion(query: string): boolean {
  const q = query.toLowerCase().trim();

  // Starts with question words
  const questionStarters = [
    'what', 'how', 'why', 'when', 'where', 'which', 'who',
    'should', 'can', 'could', 'would', 'is', 'are', 'do', 'does',
    'tell me', 'explain', 'help me', 'i need help', 'i want to know',
    'difference between', 'compare', 'vs', 'versus'
  ];

  for (const starter of questionStarters) {
    if (q.startsWith(starter + ' ') || q.startsWith(starter + ',')) {
      return true;
    }
  }

  // Ends with question mark
  if (q.endsWith('?')) {
    return true;
  }

  // Contains question patterns
  const questionPatterns = [
    /what('s| is| are) (a |the |good |best |average )/,
    /how (do|can|should|much|many|long|to)/,
    /is (it|this|that|there) /,
    /should i /,
    /can (i|you) /,
    /difference between/,
    /worth (it|buying|the)/,
  ];

  for (const pattern of questionPatterns) {
    if (pattern.test(q)) {
      return true;
    }
  }

  return false;
}

// Extract relevant category from the question for suggested listings
function extractCategory(query: string): string | null {
  const q = query.toLowerCase();

  const categoryMap: Record<string, string> = {
    'reefer': 'reefer-trailers',
    'refrigerated': 'reefer-trailers',
    'dry van': 'dry-van-trailers',
    'flatbed': 'flatbed-trailers',
    'lowboy': 'lowboy-trailers',
    'drop deck': 'drop-deck-trailers',
    'step deck': 'step-deck-trailers',
    'dump trailer': 'dump-trailers',
    'tank trailer': 'tank-trailers',
    'livestock': 'livestock-trailers',
    'car hauler': 'car-hauler-trailers',
    'trailer': 'trailers',
    'semi': 'heavy-duty-trucks',
    'sleeper': 'sleeper-trucks',
    'day cab': 'day-cab-trucks',
    'dump truck': 'dump-trucks',
    'box truck': 'box-trucks',
    'truck': 'trucks',
    'peterbilt': 'trucks',
    'freightliner': 'trucks',
    'kenworth': 'trucks',
    'volvo': 'trucks',
    'mack': 'trucks',
    'excavator': 'excavators',
    'bulldozer': 'bulldozers',
    'loader': 'loaders',
    'forklift': 'forklifts',
    'crane': 'cranes',
  };

  for (const [keyword, category] of Object.entries(categoryMap)) {
    if (q.includes(keyword)) {
      return category;
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Check if this is a question or a search
    const questionDetected = isQuestion(query);

    if (!questionDetected) {
      return NextResponse.json({
        type: 'search',
        query,
      });
    }

    // It's a question - generate an AI response
    const xai = getXai();

    if (!xai) {
      return NextResponse.json({
        type: 'chat',
        response: "I'm sorry, I can't answer questions right now. Please try searching instead.",
        suggestedCategory: extractCategory(query),
      });
    }

    const { text } = await generateText({
      model: xai('grok-3-mini'),
      system: `You are a helpful assistant for AxlesAI, a marketplace for buying and selling commercial trucks, trailers, and heavy equipment.

Your role is to help users with:
- Advice on buying/selling trucks, trailers, and equipment
- Explaining differences between equipment types
- Pricing guidance and market insights
- Maintenance tips and what to look for
- Industry terminology and specifications

Keep responses:
- Concise (2-4 short paragraphs or bullet points)
- Practical and actionable
- Focused on commercial trucking/equipment
- Friendly but professional

If the question is not related to trucks, trailers, or heavy equipment, politely redirect them to search for equipment on the marketplace.

Do NOT use markdown formatting like ** or ## - just use plain text with line breaks.`,
      prompt: query,
    });

    return NextResponse.json({
      type: 'chat',
      response: text,
      suggestedCategory: extractCategory(query),
      query,
    });

  } catch (error) {
    console.error('AI Chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
