import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

// Popular makes and models for autocomplete
const POPULAR_MAKES = [
  'Peterbilt', 'Freightliner', 'Kenworth', 'Volvo', 'International',
  'Mack', 'Western Star', 'Cascadia', 'Great Dane', 'Wabash',
  'Utility', 'Hyundai', 'Stoughton', 'Vanguard', 'MAC'
];

const POPULAR_MODELS: Record<string, string[]> = {
  'Peterbilt': ['389', '579', '567', '379', '386', '365'],
  'Freightliner': ['Cascadia', 'Columbia', 'Century', 'Coronado', 'M2'],
  'Kenworth': ['T680', 'W900', 'T880', 'T800', 'T370'],
  'Volvo': ['VNL 780', 'VNL 860', 'VNR', 'VHD'],
  'International': ['LT', 'Prostar', 'Lonestar', '9900i'],
  'Mack': ['Anthem', 'Pinnacle', 'Granite', 'TerraPro'],
};

const POPULAR_CATEGORIES = [
  { label: 'Semi Trucks', query: 'semi trucks' },
  { label: 'Sleeper Trucks', query: 'sleeper trucks' },
  { label: 'Day Cabs', query: 'day cab trucks' },
  { label: 'Dry Van Trailers', query: 'dry van trailers' },
  { label: 'Flatbed Trailers', query: 'flatbed trailers' },
  { label: 'Reefer Trailers', query: 'reefer trailers' },
  { label: 'Dump Trucks', query: 'dump trucks' },
  { label: 'Box Trucks', query: 'box trucks' },
];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q')?.toLowerCase() || '';

  const suggestions: {
    type: 'make' | 'model' | 'category' | 'popular' | 'recent';
    text: string;
    subtext?: string;
  }[] = [];

  // If no query, return popular suggestions
  if (!query) {
    // Add popular makes
    POPULAR_MAKES.slice(0, 5).forEach(make => {
      suggestions.push({ type: 'popular', text: make, subtext: 'Popular Make' });
    });

    // Add popular categories
    POPULAR_CATEGORIES.slice(0, 3).forEach(cat => {
      suggestions.push({ type: 'category', text: cat.label, subtext: 'Category' });
    });

    return NextResponse.json({ suggestions });
  }

  // Search makes
  const matchingMakes = POPULAR_MAKES.filter(make =>
    make.toLowerCase().includes(query)
  );
  matchingMakes.slice(0, 3).forEach(make => {
    suggestions.push({ type: 'make', text: make, subtext: 'Make' });
  });

  // Search models within makes
  for (const [make, models] of Object.entries(POPULAR_MODELS)) {
    if (make.toLowerCase().includes(query)) {
      // Show top models for matching make
      models.slice(0, 2).forEach(model => {
        suggestions.push({
          type: 'model',
          text: `${make} ${model}`,
          subtext: 'Model'
        });
      });
    } else {
      // Search within models
      models.forEach(model => {
        if (model.toLowerCase().includes(query)) {
          suggestions.push({
            type: 'model',
            text: `${make} ${model}`,
            subtext: 'Model'
          });
        }
      });
    }
  }

  // Search categories
  POPULAR_CATEGORIES.forEach(cat => {
    if (cat.label.toLowerCase().includes(query) || cat.query.includes(query)) {
      suggestions.push({ type: 'category', text: cat.label, subtext: 'Category' });
    }
  });

  // Try to get actual inventory data for more relevant suggestions
  try {
    const supabase = await createClient();

    // Get matching makes from database
    const { data: makeData } = await supabase
      .from('listings')
      .select('make')
      .ilike('make', `%${query}%`)
      .eq('status', 'active')
      .limit(20);

    if (makeData) {
      const dbMakes = [...new Set(makeData.map(l => l.make).filter(Boolean))];
      dbMakes.slice(0, 3).forEach(make => {
        // Only add if not already in suggestions
        if (!suggestions.some(s => s.text.toLowerCase() === make?.toLowerCase())) {
          suggestions.push({ type: 'make', text: make!, subtext: 'Make' });
        }
      });
    }

    // Get matching models from database
    const { data: modelData } = await supabase
      .from('listings')
      .select('make, model')
      .or(`make.ilike.%${query}%,model.ilike.%${query}%`)
      .eq('status', 'active')
      .limit(20);

    if (modelData) {
      const dbModels = [...new Set(
        modelData
          .filter(l => l.make && l.model)
          .map(l => `${l.make} ${l.model}`)
      )];
      dbModels.slice(0, 3).forEach(model => {
        // Only add if not already in suggestions
        if (!suggestions.some(s => s.text.toLowerCase() === model.toLowerCase())) {
          suggestions.push({ type: 'model', text: model, subtext: 'Model' });
        }
      });
    }
  } catch (error) {
    logger.error('Error fetching autocomplete suggestions', { error });
    // Continue with static suggestions if DB fails
  }

  // Dedupe and limit
  const seen = new Set<string>();
  const uniqueSuggestions = suggestions.filter(s => {
    const key = s.text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);

  return NextResponse.json({ suggestions: uniqueSuggestions });
}
