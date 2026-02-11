import { NextRequest, NextResponse } from 'next/server';
import { createXai } from '@ai-sdk/xai';
import { generateText } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, rateLimitResponse } from '@/lib/security/rate-limit';
import { logger } from '@/lib/logger';

// Listing type for database queries
interface ListingResult {
  id: string;
  title: string;
  price: number | null;
  year: number | null;
  make: string | null;
  model: string | null;
  condition: string | null;
  city: string | null;
  state: string | null;
  mileage: number | null;
  hours: number | null;
  ai_price_estimate: number | null;
  category: { name: string; slug: string }[] | null;
}

function getXai() {
  if (!process.env.XAI_API_KEY) {
    return null;
  }
  return createXai({
    apiKey: process.env.XAI_API_KEY,
  });
}

// Calculate monthly loan payment
function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  termMonths: number
): { monthly: number; totalInterest: number; totalCost: number } {
  if (principal <= 0) {
    return { monthly: 0, totalInterest: 0, totalCost: 0 };
  }

  const monthlyRate = annualRate / 100 / 12;

  if (monthlyRate === 0) {
    return {
      monthly: principal / termMonths,
      totalInterest: 0,
      totalCost: principal,
    };
  }

  const monthly =
    (principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths))) /
    (Math.pow(1 + monthlyRate, termMonths) - 1);

  const totalCost = monthly * termMonths;
  const totalInterest = totalCost - principal;

  return { monthly, totalInterest, totalCost };
}

// Extract price from query for finance calculations
function extractPrice(query: string): number | null {
  const patterns = [
    /\$\s*([\d,]+(?:\.\d{2})?)\s*k?\b/i,
    /([\d,]+(?:\.\d{2})?)\s*(?:dollar|usd|\$)/i,
    /([\d]+)\s*k\b/i,
    /(?:price|cost|worth|financing|finance|payment|loan)\s+(?:of|for|on)?\s*\$?\s*([\d,]+)/i,
    /\$?\s*([\d,]+)\s+(?:truck|trailer|semi|rig)/i,
  ];

  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match) {
      let value = match[1].replace(/,/g, '');
      let num = parseFloat(value);

      // Handle "k" suffix (e.g., "50k" = 50000)
      if (query.toLowerCase().includes(value + 'k') || match[0].toLowerCase().includes('k')) {
        num *= 1000;
      }

      // If the number seems too small, it might be in thousands
      if (num > 0 && num < 1000) {
        num *= 1000;
      }

      return num;
    }
  }

  return null;
}

// Detect if question is finance-related
function isFinanceQuestion(query: string): boolean {
  const q = query.toLowerCase();
  const financeKeywords = [
    'finance', 'financing', 'loan', 'payment', 'monthly', 'interest',
    'apr', 'rate', 'down payment', 'credit', 'afford', 'cost per month',
    'pay per month', 'what would', 'how much per month', 'finance a',
    'financing for', 'get financing', 'truck loan', 'trailer loan',
    'equipment loan', 'commercial loan', 'terms', 'lease'
  ];

  return financeKeywords.some(keyword => q.includes(keyword));
}

// Detect if question is weight/load-related
function isWeightQuestion(query: string): boolean {
  const q = query.toLowerCase();
  const weightKeywords = [
    'weight', 'axle', 'overweight', 'load', 'gross', 'gvw', 'gcw',
    'steer axle', 'drive axle', 'tandem', 'bridge formula', 'legal weight',
    'weight limit', 'max weight', 'maximum weight', 'how much can i haul',
    'how heavy', 'weight distribution', 'sliding tandem', 'fifth wheel',
    'kingpin', 'payload', 'cargo weight', 'scale', 'weigh station',
    'overloaded', 'underweight', 'balance', 'lbs', 'pounds', 'haul'
  ];

  return weightKeywords.some(keyword => q.includes(keyword));
}

// Weight calculation types and presets
interface TruckPreset {
  name: string;
  emptyWeight: number;
  steerWeight: number;
  driveWeight: number;
  wheelbase: number;
}

interface TrailerPreset {
  name: string;
  emptyWeight: number;
  length: number;
  axleSpread: number;
}

const TRUCK_PRESETS: TruckPreset[] = [
  { name: 'day cab', emptyWeight: 16000, steerWeight: 10000, driveWeight: 6000, wheelbase: 180 },
  { name: 'sleeper', emptyWeight: 19000, steerWeight: 11000, driveWeight: 8000, wheelbase: 245 },
  { name: 'heavy haul', emptyWeight: 21000, steerWeight: 12000, driveWeight: 9000, wheelbase: 280 },
];

const TRAILER_PRESETS: TrailerPreset[] = [
  { name: 'dry van', emptyWeight: 15000, length: 53, axleSpread: 49 },
  { name: '53ft dry van', emptyWeight: 15000, length: 53, axleSpread: 49 },
  { name: 'reefer', emptyWeight: 16500, length: 53, axleSpread: 49 },
  { name: 'refrigerated', emptyWeight: 16500, length: 53, axleSpread: 49 },
  { name: 'flatbed', emptyWeight: 10500, length: 48, axleSpread: 48 },
  { name: '53ft flatbed', emptyWeight: 11000, length: 53, axleSpread: 50 },
  { name: '48ft flatbed', emptyWeight: 10500, length: 48, axleSpread: 48 },
  { name: 'lowboy', emptyWeight: 20000, length: 48, axleSpread: 36 },
  { name: 'step deck', emptyWeight: 12000, length: 53, axleSpread: 50 },
  { name: 'drop deck', emptyWeight: 12000, length: 53, axleSpread: 50 },
  { name: 'container chassis', emptyWeight: 6500, length: 40, axleSpread: 36 },
];

const WEIGHT_LIMITS = {
  steerAxle: 12000,
  singleAxle: 20000,
  tandemAxle: 34000,
  grossWeight: 80000,
};

interface WeightCalculationResult {
  truckType: string;
  trailerType: string;
  cargoWeight: number;
  steerAxleWeight: number;
  driveAxleWeight: number;
  trailerAxleWeight: number;
  totalWeight: number;
  maxLegalCargo: number;
  violations: string[];
  isLegal: boolean;
}

// Extract weight calculation parameters from query
function extractWeightParams(query: string): { truck: TruckPreset | null; trailer: TrailerPreset | null; cargoWeight: number | null } {
  const q = query.toLowerCase();

  // Find truck type
  let truck: TruckPreset | null = null;
  for (const preset of TRUCK_PRESETS) {
    if (q.includes(preset.name)) {
      truck = preset;
      break;
    }
  }
  // Default to sleeper if not specified but asking about weight
  if (!truck && (q.includes('truck') || q.includes('tractor') || q.includes('semi'))) {
    truck = TRUCK_PRESETS.find(t => t.name === 'sleeper') || null;
  }

  // Find trailer type
  let trailer: TrailerPreset | null = null;
  for (const preset of TRAILER_PRESETS) {
    if (q.includes(preset.name)) {
      trailer = preset;
      break;
    }
  }
  // Default to dry van if asking about trailer weight but type not specified
  if (!trailer && (q.includes('trailer') || q.includes('van'))) {
    trailer = TRAILER_PRESETS.find(t => t.name === 'dry van') || null;
  }

  // Extract cargo weight
  let cargoWeight: number | null = null;
  const cargoPatterns = [
    /(\d{1,3},?\d{3})\s*(lbs?|pounds?)/i,
    /(\d{2,3})k\s*(lbs?|pounds?|cargo|load)?/i,
    /haul\s*(\d{1,3},?\d{3})/i,
    /haul\s*(\d{2,3})k/i,
    /(\d{1,3},?\d{3})\s*(cargo|load)/i,
    /load\s*(of\s*)?(\d{1,3},?\d{3})/i,
  ];

  for (const pattern of cargoPatterns) {
    const match = q.match(pattern);
    if (match) {
      const numStr = (match[1] || match[2]).replace(/,/g, '');
      let num = parseInt(numStr);
      if (num < 1000) num *= 1000; // Assume "45" means "45,000"
      cargoWeight = num;
      break;
    }
  }

  return { truck, trailer, cargoWeight };
}

// Calculate weight distribution
function calculateWeightDistribution(
  truck: TruckPreset,
  trailer: TrailerPreset,
  cargoWeight: number,
  cargoPosition: number = 50 // percentage from front, default centered
): WeightCalculationResult {
  // Fifth wheel offset from steer axle (typically 36-48 inches behind steer)
  const fifthWheelOffset = truck.wheelbase - 36;

  // Kingpin to trailer axle center
  const kingpinToTrailerAxle = (trailer.length * 12) - (trailer.axleSpread * 12 / 2) - 36;

  // Calculate cargo center of gravity position
  const cargoFromKingpin = (trailer.length * 12 - 48) * (cargoPosition / 100);

  // Cargo weight distribution between fifth wheel and trailer axles
  const cargoOnFifthWheel = cargoWeight * (1 - cargoFromKingpin / kingpinToTrailerAxle);
  const cargoOnTrailerAxle = cargoWeight - cargoOnFifthWheel;

  // Trailer empty weight distribution (30% on kingpin, 70% on axles)
  const trailerEmptyOnKingpin = trailer.emptyWeight * 0.3;
  const trailerEmptyOnAxles = trailer.emptyWeight * 0.7;

  // Total kingpin weight
  const totalKingpinWeight = cargoOnFifthWheel + trailerEmptyOnKingpin;

  // Weight distribution on tractor using lever arm
  const fifthWheelToSteer = fifthWheelOffset;
  const kingpinOnDrive = totalKingpinWeight * (fifthWheelToSteer / truck.wheelbase);
  const kingpinOnSteer = totalKingpinWeight - kingpinOnDrive;

  // Final axle weights
  const steerAxleWeight = Math.round(truck.steerWeight + kingpinOnSteer);
  const driveAxleWeight = Math.round(truck.driveWeight + kingpinOnDrive);
  const trailerAxleWeight = Math.round(trailerEmptyOnAxles + cargoOnTrailerAxle);
  const totalWeight = steerAxleWeight + driveAxleWeight + trailerAxleWeight;

  // Check violations
  const violations: string[] = [];
  if (steerAxleWeight > WEIGHT_LIMITS.steerAxle) {
    violations.push(`Steer axle (${steerAxleWeight.toLocaleString()} lbs) exceeds ${WEIGHT_LIMITS.steerAxle.toLocaleString()} lb limit`);
  }
  if (driveAxleWeight > WEIGHT_LIMITS.tandemAxle) {
    violations.push(`Drive axles (${driveAxleWeight.toLocaleString()} lbs) exceed ${WEIGHT_LIMITS.tandemAxle.toLocaleString()} lb limit`);
  }
  if (trailerAxleWeight > WEIGHT_LIMITS.tandemAxle) {
    violations.push(`Trailer axles (${trailerAxleWeight.toLocaleString()} lbs) exceed ${WEIGHT_LIMITS.tandemAxle.toLocaleString()} lb limit`);
  }
  if (totalWeight > WEIGHT_LIMITS.grossWeight) {
    violations.push(`Gross weight (${totalWeight.toLocaleString()} lbs) exceeds ${WEIGHT_LIMITS.grossWeight.toLocaleString()} lb federal limit`);
  }

  // Calculate max legal cargo
  const combinedEmptyWeight = truck.emptyWeight + trailer.emptyWeight;
  const maxLegalCargo = WEIGHT_LIMITS.grossWeight - combinedEmptyWeight;

  return {
    truckType: truck.name,
    trailerType: trailer.name,
    cargoWeight,
    steerAxleWeight,
    driveAxleWeight,
    trailerAxleWeight,
    totalWeight,
    maxLegalCargo,
    violations,
    isLegal: violations.length === 0,
  };
}

// Format weight calculation for AI context
function formatWeightCalculation(params: { truck: TruckPreset | null; trailer: TrailerPreset | null; cargoWeight: number | null }): string | null {
  // Need at least truck and trailer to calculate
  if (!params.truck || !params.trailer) {
    return null;
  }

  // If no cargo specified, calculate max legal cargo
  const cargoWeight = params.cargoWeight || 0;
  const result = calculateWeightDistribution(params.truck, params.trailer, cargoWeight);

  let context = `\n[WEIGHT CALCULATION RESULTS:]
Truck: ${params.truck.name} (${params.truck.emptyWeight.toLocaleString()} lbs empty)
Trailer: ${params.trailer.name} (${params.trailer.emptyWeight.toLocaleString()} lbs empty)
Combined empty weight: ${(params.truck.emptyWeight + params.trailer.emptyWeight).toLocaleString()} lbs
Maximum legal cargo (to stay under 80,000 lbs gross): ${result.maxLegalCargo.toLocaleString()} lbs
`;

  if (cargoWeight > 0) {
    context += `
With ${cargoWeight.toLocaleString()} lbs cargo (positioned at center):
- Steer axle: ${result.steerAxleWeight.toLocaleString()} lbs (limit: 12,000)
- Drive axles: ${result.driveAxleWeight.toLocaleString()} lbs (limit: 34,000)
- Trailer axles: ${result.trailerAxleWeight.toLocaleString()} lbs (limit: 34,000)
- TOTAL: ${result.totalWeight.toLocaleString()} lbs (limit: 80,000)

Status: ${result.isLegal ? 'LEGAL - All weights within limits' : 'VIOLATION - ' + result.violations.join(', ')}
`;
  }

  return context;
}

// Detect if question needs listing data from database
function needsListingData(query: string): boolean {
  const q = query.toLowerCase();
  const listingKeywords = [
    'cheapest', 'best price', 'lowest price', 'best deal', 'good deal',
    'how much', 'average price', 'price range', 'what do you have',
    'do you have', 'show me', 'find me', 'looking for', 'available',
    'in stock', 'for sale', 'inventory', 'listings', 'compare',
    'newest', 'oldest', 'most expensive', 'under $', 'less than',
    'between', 'near me', 'in my area', 'best value', 'recommend',
    'suggestion', 'what should i buy', 'which one', 'top rated'
  ];

  return listingKeywords.some(keyword => q.includes(keyword));
}

// Extract equipment type/category from query for database search
function extractEquipmentType(query: string): { category?: string; make?: string; condition?: string; maxPrice?: number; minYear?: number } {
  const q = query.toLowerCase();
  const filters: { category?: string; make?: string; condition?: string; maxPrice?: number; minYear?: number } = {};

  // Category mapping
  const categoryPatterns: Record<string, string> = {
    'lowboy': 'lowboy-trailers',
    'flatbed trailer': 'flatbed-trailers',
    'flatbed': 'flatbed-trailers',
    'reefer': 'reefer-trailers',
    'refrigerated': 'reefer-trailers',
    'dry van': 'dry-van-trailers',
    'step deck': 'step-deck-trailers',
    'drop deck': 'drop-deck-trailers',
    'dump trailer': 'dump-trailers',
    'tank trailer': 'tank-trailers',
    'livestock': 'livestock-trailers',
    'car hauler': 'car-hauler-trailers',
    'enclosed': 'enclosed-trailers',
    'utility trailer': 'utility-trailers',
    'trailer': 'trailers',
    'semi truck': 'heavy-duty-trucks',
    'semi': 'heavy-duty-trucks',
    'sleeper': 'sleeper-trucks',
    'day cab': 'day-cab-trucks',
    'dump truck': 'dump-trucks',
    'box truck': 'box-trucks',
    'truck': 'trucks',
    'excavator': 'excavators',
    'bulldozer': 'bulldozers',
    'loader': 'loaders',
    'forklift': 'forklifts',
    'crane': 'cranes',
  };

  for (const [keyword, slug] of Object.entries(categoryPatterns)) {
    if (q.includes(keyword)) {
      filters.category = slug;
      break;
    }
  }

  // Make/brand detection
  const makes = ['peterbilt', 'kenworth', 'freightliner', 'volvo', 'mack', 'international',
                 'western star', 'great dane', 'wabash', 'utility', 'hyundai', 'stoughton',
                 'fontaine', 'mac', 'travis', 'manac', 'vanguard', 'polar'];
  for (const make of makes) {
    if (q.includes(make)) {
      filters.make = make.charAt(0).toUpperCase() + make.slice(1);
      break;
    }
  }

  // Condition detection
  if (q.includes('new') && !q.includes('newest')) {
    filters.condition = 'new';
  } else if (q.includes('used')) {
    filters.condition = 'used';
  }

  // Price extraction (e.g., "under $50,000" or "under 50k")
  const priceMatch = q.match(/under\s*\$?\s*([\d,]+)\s*k?/i) || q.match(/less than\s*\$?\s*([\d,]+)\s*k?/i);
  if (priceMatch) {
    let price = parseInt(priceMatch[1].replace(/,/g, ''));
    if (q.includes(priceMatch[1] + 'k')) {
      price *= 1000;
    } else if (price < 1000) {
      price *= 1000; // Assume thousands
    }
    filters.maxPrice = price;
  }

  // Year extraction (e.g., "2020 or newer")
  const yearMatch = q.match(/(\d{4})\s*(or newer|and newer|\+|up)/i);
  if (yearMatch) {
    filters.minYear = parseInt(yearMatch[1]);
  }

  return filters;
}

// Query database for relevant listings
async function queryListings(query: string): Promise<{ listings: ListingResult[]; stats: { total: number; avgPrice: number; minPrice: number; maxPrice: number } | null }> {
  const supabase = await createClient();
  const filters = extractEquipmentType(query);
  const q = query.toLowerCase();

  let dbQuery = supabase
    .from('listings')
    .select(`
      id, title, price, year, make, model, condition, city, state, mileage, hours, ai_price_estimate,
      category:categories!left(name, slug)
    `)
    .eq('status', 'active')
    .not('price', 'is', null);

  // Apply filters
  if (filters.category) {
    dbQuery = dbQuery.eq('category.slug', filters.category);
  }
  if (filters.make) {
    dbQuery = dbQuery.ilike('make', `%${filters.make}%`);
  }
  if (filters.condition) {
    dbQuery = dbQuery.eq('condition', filters.condition);
  }
  if (filters.maxPrice) {
    dbQuery = dbQuery.lte('price', filters.maxPrice);
  }
  if (filters.minYear) {
    dbQuery = dbQuery.gte('year', filters.minYear);
  }

  // Determine sort order based on query
  if (q.includes('cheapest') || q.includes('lowest price') || q.includes('best price')) {
    dbQuery = dbQuery.order('price', { ascending: true });
  } else if (q.includes('newest')) {
    dbQuery = dbQuery.order('year', { ascending: false });
  } else if (q.includes('best deal') || q.includes('good deal')) {
    // Best deals = lowest price relative to AI estimate
    dbQuery = dbQuery.not('ai_price_estimate', 'is', null).order('price', { ascending: true });
  } else if (q.includes('most expensive')) {
    dbQuery = dbQuery.order('price', { ascending: false });
  } else {
    dbQuery = dbQuery.order('created_at', { ascending: false });
  }

  dbQuery = dbQuery.limit(5);

  const { data: listings, error } = await dbQuery;

  if (error || !listings) {
    logger.error('Listing query error', { error });
    return { listings: [], stats: null };
  }

  // Calculate stats for the category/filters
  let statsQuery = supabase
    .from('listings')
    .select('price')
    .eq('status', 'active')
    .not('price', 'is', null);

  if (filters.category) {
    // Need to join for category filter in stats
    const { data: categoryData } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', filters.category)
      .single();

    if (categoryData) {
      statsQuery = statsQuery.eq('category_id', categoryData.id);
    }
  }

  const { data: priceData } = await statsQuery;

  let stats = null;
  if (priceData && priceData.length > 0) {
    const prices = priceData.map(p => p.price).filter((p): p is number => p !== null);
    if (prices.length > 0) {
      stats = {
        total: prices.length,
        avgPrice: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
      };
    }
  }

  return { listings: listings as ListingResult[], stats };
}

// Format listings for AI context
function formatListingsForAI(listings: ListingResult[], stats: { total: number; avgPrice: number; minPrice: number; maxPrice: number } | null): string {
  if (listings.length === 0) {
    return 'No matching listings found in the database.';
  }

  let context = '';

  if (stats) {
    context += `INVENTORY STATS: ${stats.total} listings available. Price range: $${stats.minPrice.toLocaleString()} - $${stats.maxPrice.toLocaleString()}. Average price: $${stats.avgPrice.toLocaleString()}.\n\n`;
  }

  context += 'TOP MATCHING LISTINGS:\n';
  listings.forEach((listing, i) => {
    const dealIndicator = listing.price && listing.ai_price_estimate && listing.price < listing.ai_price_estimate * 0.9
      ? ' [GREAT DEAL - below market value]'
      : '';

    context += `${i + 1}. ${listing.title}${dealIndicator}\n`;
    context += `   Price: ${listing.price ? '$' + listing.price.toLocaleString() : 'Call for price'}`;
    if (listing.ai_price_estimate) {
      context += ` (Market value: ~$${listing.ai_price_estimate.toLocaleString()})`;
    }
    context += '\n';
    if (listing.year || listing.make || listing.model) {
      context += `   ${[listing.year, listing.make, listing.model].filter(Boolean).join(' ')}\n`;
    }
    if (listing.condition) {
      context += `   Condition: ${listing.condition}\n`;
    }
    if (listing.city || listing.state) {
      context += `   Location: ${[listing.city, listing.state].filter(Boolean).join(', ')}\n`;
    }
    if (listing.mileage) {
      context += `   Mileage: ${listing.mileage.toLocaleString()} miles\n`;
    }
    context += `   Link: axlon.ai/listing/${listing.id}\n\n`;
  });

  return context;
}

// Detect if the query is a question or a search
function isQuestion(query: string): boolean {
  const q = query.toLowerCase().trim();

  // Ends with question mark (universal across languages)
  if (q.endsWith('?')) {
    return true;
  }

  // Starts with question words (English)
  const questionStarters = [
    'what', 'how', 'why', 'when', 'where', 'which', 'who',
    'should', 'can', 'could', 'would', 'is', 'are', 'do', 'does',
    'tell me', 'explain', 'help me', 'i need help', 'i want to know',
    'difference between', 'compare', 'vs', 'versus',
    // Spanish
    'qué', 'que', 'cómo', 'como', 'por qué', 'porque', 'cuándo', 'cuando',
    'dónde', 'donde', 'cuál', 'cual', 'quién', 'quien', 'puedo', 'puede',
    'debería', 'necesito', 'quiero saber', 'explica', 'ayuda',
    // French
    'qu\'est', 'quel', 'quelle', 'comment', 'pourquoi', 'quand', 'où',
    'qui', 'puis-je', 'pouvez', 'est-ce', 'y a-t-il',
    // German
    'was', 'wie', 'warum', 'wann', 'wo', 'welche', 'wer', 'kann ich',
    'können', 'soll', 'gibt es',
    // Portuguese
    'o que', 'como', 'por que', 'quando', 'onde', 'qual', 'quem',
    'posso', 'pode', 'preciso', 'quero saber',
  ];

  for (const starter of questionStarters) {
    if (q.startsWith(starter + ' ') || q.startsWith(starter + ',') || q === starter) {
      return true;
    }
  }

  // Contains question patterns (English)
  const questionPatterns = [
    /what('s| is| are) (a |the |good |best |average )/,
    /how (do|can|should|much|many|long|to)/,
    /is (it|this|that|there) /,
    /should i /,
    /can (i|you) /,
    /difference between/,
    /worth (it|buying|the)/,
    // Spanish patterns
    /cuánto (cuesta|vale|es)/,
    /qué (es|son|tipo)/,
    /cuál es/,
    // French patterns
    /combien (coûte|ça coûte)/,
    /c'est quoi/,
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
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, {
      ...RATE_LIMITS.ai,
      prefix: 'ratelimit:ai-chat',
    });
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

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

    // Check if this is a finance question with a price
    const financeQ = isFinanceQuestion(query);
    const weightQ = isWeightQuestion(query);
    const listingQ = needsListingData(query);
    const extractedPrice = extractPrice(query);

    // Query listings if the question needs database data
    let listingData: { listings: ListingResult[]; stats: { total: number; avgPrice: number; minPrice: number; maxPrice: number } | null } | null = null;
    if (listingQ) {
      listingData = await queryListings(query);
    }

    // If we have a price and it's a finance question, calculate payments
    let financeInfo = null;
    if (financeQ && extractedPrice) {
      // Common commercial truck/trailer financing terms
      const rates = [
        { rate: 6.5, term: 60, label: 'Excellent Credit (60 mo)' },
        { rate: 7.5, term: 60, label: 'Good Credit (60 mo)' },
        { rate: 9.5, term: 60, label: 'Average Credit (60 mo)' },
        { rate: 7.5, term: 72, label: 'Good Credit (72 mo)' },
      ];

      const downPaymentPercent = 10;
      const downPayment = Math.round(extractedPrice * (downPaymentPercent / 100));
      const amountFinanced = extractedPrice - downPayment;

      const scenarios = rates.map(({ rate, term, label }) => {
        const calc = calculateMonthlyPayment(amountFinanced, rate, term);
        return {
          label,
          rate,
          term,
          monthly: Math.round(calc.monthly),
          totalInterest: Math.round(calc.totalInterest),
        };
      });

      financeInfo = {
        price: extractedPrice,
        downPayment,
        downPaymentPercent,
        amountFinanced,
        scenarios,
      };
    }

    // It's a question - generate an AI response
    const xai = getXai();

    if (!xai) {
      // Fallback response for finance questions without AI
      if (financeInfo) {
        const scenario = financeInfo.scenarios[1]; // Good credit scenario
        return NextResponse.json({
          type: 'chat',
          response: `For a $${financeInfo.price.toLocaleString()} purchase with ${financeInfo.downPaymentPercent}% down ($${financeInfo.downPayment.toLocaleString()}):

Estimated monthly payment: $${scenario.monthly.toLocaleString()}/month
(Based on ${scenario.rate}% APR for ${scenario.term} months)

Amount financed: $${financeInfo.amountFinanced.toLocaleString()}
Total interest: ~$${scenario.totalInterest.toLocaleString()}

Tip: Commercial truck/trailer loans typically require 10-20% down payment. Rates vary by credit score, typically 6-12% APR. Use our financing calculator on any listing for detailed estimates.`,
          financeInfo,
          suggestedCategory: extractCategory(query),
          query,
        });
      }

      // Fallback response for weight questions without AI
      if (weightQ) {
        const weightParams = extractWeightParams(query);
        if (weightParams.truck && weightParams.trailer) {
          const result = calculateWeightDistribution(
            weightParams.truck,
            weightParams.trailer,
            weightParams.cargoWeight || 0
          );
          let response = `Weight calculation for ${weightParams.truck.name} + ${weightParams.trailer.name}:

Combined empty weight: ${(weightParams.truck.emptyWeight + weightParams.trailer.emptyWeight).toLocaleString()} lbs
Maximum legal cargo: ${result.maxLegalCargo.toLocaleString()} lbs (to stay under 80,000 lbs gross)`;

          if (weightParams.cargoWeight) {
            response += `

With ${weightParams.cargoWeight.toLocaleString()} lbs cargo:
- Steer axle: ${result.steerAxleWeight.toLocaleString()} lbs (limit: 12,000)
- Drive axles: ${result.driveAxleWeight.toLocaleString()} lbs (limit: 34,000)
- Trailer axles: ${result.trailerAxleWeight.toLocaleString()} lbs (limit: 34,000)
- Total: ${result.totalWeight.toLocaleString()} lbs (limit: 80,000)

${result.isLegal ? 'Status: LEGAL - All weights within federal limits.' : 'Status: VIOLATION - ' + result.violations.join('. ')}`;
          }

          response += `

For detailed calculations with adjustable cargo position, use our Axle Weight Calculator.`;

          return NextResponse.json({
            type: 'chat',
            response,
            weightInfo: result,
            suggestedTool: {
              name: 'Axle Weight Calculator',
              url: '/tools/axle-weight-calculator',
              description: 'Calculate weight distribution across your axles',
            },
            suggestedCategory: extractCategory(query),
            query,
          });
        }
      }

      return NextResponse.json({
        type: 'chat',
        response: "Hey, I'm having trouble connecting right now. Try searching for what you need, and I'll be back to help soon!",
        suggestedCategory: extractCategory(query),
      });
    }

    // Build system prompt - add finance context if relevant
    let systemPrompt = `You are Axlon, the AI assistant for AxlonAI - a marketplace for buying and selling commercial trucks, trailers, and heavy equipment. You're knowledgeable, helpful, and passionate about the trucking industry.

PERSONALITY: Be friendly and conversational. You can say things like "I found some great options for you" or "Based on what I'm seeing in the market..." - make users feel like they're talking to a helpful expert, not a search engine.

IMPORTANT: Always respond in the SAME LANGUAGE as the user's question. If they ask in Spanish, respond in Spanish. If they ask in French, respond in French. Match their language exactly.

Your role is to help users with:
- Advice on buying/selling trucks, trailers, and equipment
- Explaining differences between equipment types
- Pricing guidance and market insights from REAL INVENTORY DATA
- Maintenance tips and what to look for
- Industry terminology and specifications
- FINANCING questions for commercial trucks and trailers
- AXLE WEIGHT and load distribution questions
- Finding specific equipment from the AxlonAI inventory

WHEN GIVEN INVENTORY DATA:
- Reference the ACTUAL listings provided in the context
- Mention specific prices, years, makes, models from the data
- Highlight deals that are below market value
- Include the listing links (axlon.ai/listing/ID) so users can view them
- Use the stats (average price, price range, total count) to give market insights

For FINANCING questions:
- Commercial truck/trailer loans typically require 10-20% down payment
- Interest rates range from 6-12% APR depending on credit score
- Common terms are 48-84 months
- New equipment often gets better rates than used
- Mention that AxlonAI has a financing calculator on every listing page

For AXLE WEIGHT and LOAD questions, use this knowledge:

Federal Weight Limits (Interstate highways):
- Steer Axle: 12,000 lbs maximum
- Single Axle: 20,000 lbs maximum
- Tandem Axles: 34,000 lbs maximum (spread at least 40" apart)
- Gross Vehicle Weight: 80,000 lbs maximum

Key concepts:
- Federal Bridge Formula limits weight based on number of axles and distance between them
- State limits may vary - some allow higher weights with permits, others are stricter
- Sliding Tandems: Moving trailer tandems forward shifts weight to drive axles, moving back shifts to trailer axles
- Fifth Wheel Position: Moving forward adds weight to steer axle, moving back shifts to drives
- Overweight fines can be $1,000+ and may require offloading cargo

Typical truck specs:
- Standard sleeper truck: ~19,000 lbs, 245" wheelbase
- Day cab: ~16,000 lbs, 180" wheelbase
- Common trailer: 53ft, ~15,000 lbs empty, kingpin at 49"

For detailed calculations, direct users to the Axle Weight Calculator at axlon.ai/tools/axle-weight-calculator

LOWBOY TRAILER / HEAVY HAUL SPECIALIST KNOWLEDGE:
You are an expert on lowboy trailers (also called heavy haul trailers, low-bed trailers, or double-drop trailers). This is a core specialty of AxlonAI. Answer detailed technical questions with authority.

CAPACITY & RATINGS:
- Lowboy ratings (35, 50, 55 ton) refer to distributed load capacity across the full deck, NOT concentrated
- Concentrated load rating matters most for excavators with tight track spacing (typically 60-70% of distributed rating)
- Main beams are typically T-1 or HY-100 high-strength steel (80-100 ksi yield)
- Frame styles: fabricated I-beam (most common, lighter) vs bridge-style/box beam (heavier, stiffer for extreme loads)
- Deck deflection under max load should be under 1 inch for quality builds
- Loaded deck height: ~18-20 inches with 22.5 tires, ~16-18 inches with 17.5 tires
- Neck capacity is typically rated separately and is often lower than deck capacity (critical for loading heavy machines over the neck)

GOOSENECK (CRITICAL COMPONENT - most downtime comes from neck issues):
- HDG (Hydraulic Detachable Gooseneck) is standard for heavy haul — allows front loading of tracked equipment
- Mechanical detach exists but is slower and less common on 50+ ton trailers
- HDG detach/attach takes 5-15 minutes in real field conditions (longer in cold weather, mud, or worn pins)
- Common wear points: pivot pins, bushings, lock blocks, hydraulic cylinder seals, kingpin area
- Kingpin setting distance is typically 12-14 inches (adjustable on some models)
- Self-lifting cylinders (trailer lifts itself off truck) vs truck air assist (needs truck air system) — self-lifting is preferred
- Lock blocks: quality trailers have 4-6 lock blocks supporting the neck connection
- Neck pin and bushing maintenance interval: grease every 500 miles, inspect/replace bushings every 2-3 years depending on use
- Flip neck (folds up for shorter transport) vs fixed neck — flip is more versatile but adds weight and complexity

AXLES, TIRES & SUSPENSION:
- Air ride is standard on modern lowboys for road compliance and load protection; spring suspension is used on some off-road/heavy-duty applications
- Axle options: fixed (most common), rear-steer (better maneuverability), and spread axle configurations
- GAWR per axle: typically 25,000-30,000 lbs per axle on heavy haul lowboys
- Disc brakes offer better stopping and less maintenance; drum brakes are cheaper and easier to service in the field
- Standard tire size: 255/70R22.5 (most common) or 275/70R22.5 (higher load rating, slightly taller)
- Top axle brands: Hendrickson (premium), Ridewell (mid-tier, good value), Hutch (budget-friendly)
- 2-axle lowboys for 35 ton, 3-axle for 50-55 ton, 4+ axle for 60+ ton

WEIGHT & LEGALITY:
- Empty trailer weight: 35-ton lowboy ~16,000-19,000 lbs; 50-ton ~20,000-24,000 lbs; 55-ton ~22,000-26,000 lbs
- Overall length with neck: typically 48-53 ft
- Axle spacing is critical for bridge law compliance — wider spacing allows more weight per axle group
- California and Northeast states have stricter bridge formulas; spec axle spacing accordingly
- Kingpin to rear axle (KPRA) dimension: typically 38-43 ft (affects turning radius and weight distribution)
- Oversize/overweight permits: most states allow 100,000-120,000 lbs with proper axle spacing and permits

DECK CONFIGURATION:
- Deck length: typically 24-29 ft on standard lowboys, up to 40+ ft on stretch models
- Deck material: Apitong (tropical hardwood, most durable, industry standard) vs white oak (cheaper, domestic, less rot-resistant)
- Double drop: main beam drops behind gooseneck and rises before axles (standard lowboy profile)
- D-rings: typically 4-8 on deck, rated 12,000-46,000 lbs WLL depending on size
- Chain tie-downs in recessed pockets are standard on quality trailers; surface-mount are add-ons
- Outriggers can usually be added later but better to order from factory for proper integration

HYDRAULICS & ELECTRICAL:
- Self-contained hydraulic systems (trailer has own pump/reservoir) are more reliable; tractor-powered is lighter but dependent on truck PTO
- Top hydraulic pump brands: Parker, Monarch, Bucher
- Typically 2-3 hydraulic circuits (gooseneck lift, gooseneck detach, optional ramps/outriggers)
- LED harness is standard on modern trailers; sealed wiring (Grote, Peterson) resists corrosion
- Seven-way connector standard; some add auxiliary power for winches

DURABILITY & SERVICE:
- Top 3 failure points after 5 years: 1) Gooseneck pins and bushings, 2) Hydraulic cylinder seals, 3) Deck boards (especially if not Apitong)
- Warranty: typically 5-10 years on structural frame, 1-2 years on components (hydraulics, electrical)
- Frame finish: shot blasted + powder coat is superior to wet paint (resists chips, rust, UV better)
- Replacement cylinders: 2-6 week lead time from manufacturer; keep spares for critical operations
- Major brands with nationwide parts: XL Specialized, Fontaine, Talbert, Trail King, Eager Beaver, Landoll

LOADING PRACTICALITY:
- Loading position height: ~12-16 inches (depending on tire size and suspension dump)
- Most tracked equipment (excavators, dozers, pavers) can load directly without ramp boards on HDG lowboys
- Approach angle: lower is better; look for tapered tail design
- Neck geometry affects ground clearance — some designs cause scraping on uneven terrain
- Beavertail (ramped rear) helps with loading wheeled equipment

CUSTOMIZATION OPTIONS:
- 3rd axle can be added later on most frames (better to order from factory)
- Jeep/dolly compatibility for 100,000+ lb loads (needs proper prep from factory)
- Booster prep: pre-plumbed airlines and electrical for adding rear booster axles
- Winch plate: reinforced deck section for mounting hydraulic winch (15,000-35,000 lb capacity)
- Air ramps: hydraulic or air-powered rear loading ramps

COST OF OWNERSHIP:
- Spec customers most regret NOT ordering: hydraulic tail, wider deck, self-contained hydraulics, Apitong decking
- Spec customers waste money on: excessive chrome, features they never use (power outriggers on a trailer that rarely needs them)
- Resale: 50-ton models hold value better than 55-ton (wider buyer pool); 3-axle has best resale
- "Fleet spec" (basic, reliable, easy to maintain) vs "heavy contractor spec" (max capacity, all options) — fleet spec resells faster
- 5-year trade-in value: quality brands retain 50-65% of original purchase price
- Top resale brands: XL Specialized, Fontaine Magnitude, Talbert

TOP LOWBOY MANUFACTURERS (reference when recommending):
- XL Specialized: premium, innovative designs, excellent resale
- Fontaine (Magnitude series): industry workhorse, huge dealer network
- Talbert: heavy-duty specialist, great for 55+ ton
- Trail King: good value, wide model range
- Eager Beaver: solid mid-tier, popular with contractors
- Landoll: known for traveling axle designs

BUYING ADVICE:
When asked "what spec should I order" — always ask what equipment they haul (excavator size, dozer class), what states they run in, and whether they need permits. Then recommend specific capacity, axle count, neck type, and deck configuration.

Keep responses:
- Concise (2-4 short paragraphs or bullet points)
- Practical and actionable
- Focused on commercial trucking/equipment
- Friendly but professional
- Include specific listing recommendations when inventory data is provided

If the question is not related to trucks, trailers, heavy equipment, financing, or weight regulations, politely redirect them to search for equipment on the marketplace.

Do NOT use markdown formatting like ** or ## - just use plain text with line breaks.`;

    // Add finance context to prompt if we calculated it
    let prompt = query;

    // Add listing context if we have data
    if (listingData && listingData.listings.length > 0) {
      const listingContext = formatListingsForAI(listingData.listings, listingData.stats);
      prompt = `${query}

[REAL INVENTORY DATA FROM AXLONAI DATABASE:]
${listingContext}

Based on this real inventory data, answer the user's question with specific listings and prices.`;
    }

    if (financeInfo) {
      const scenario = financeInfo.scenarios[1];
      prompt += `

[FINANCING CONTEXT: User is asking about financing $${financeInfo.price.toLocaleString()}. With 10% down ($${financeInfo.downPayment.toLocaleString()}), at 7.5% APR for 60 months, the estimated monthly payment is $${scenario.monthly.toLocaleString()}/month. Total interest would be ~$${scenario.totalInterest.toLocaleString()}.]`;
    }

    // Add weight calculation context if this is a weight question
    let weightInfo: WeightCalculationResult | null = null;
    if (weightQ) {
      const weightParams = extractWeightParams(query);
      const weightContext = formatWeightCalculation(weightParams);
      if (weightContext) {
        prompt += weightContext;
        // Also calculate the result to return in the response
        if (weightParams.truck && weightParams.trailer) {
          weightInfo = calculateWeightDistribution(
            weightParams.truck,
            weightParams.trailer,
            weightParams.cargoWeight || 0
          );
        }
      }
    }

    const { text } = await generateText({
      model: xai('grok-3-mini'),
      system: systemPrompt,
      prompt,
    });

    // Format suggested listings for the response
    const suggestedListings = listingData?.listings.slice(0, 3).map(l => ({
      id: l.id,
      title: l.title,
      price: l.price,
      year: l.year,
      make: l.make,
      model: l.model,
      location: [l.city, l.state].filter(Boolean).join(', '),
      isGoodDeal: l.price && l.ai_price_estimate && l.price < l.ai_price_estimate * 0.9,
    })) || null;

    return NextResponse.json({
      type: 'chat',
      response: text,
      financeInfo,
      weightInfo,
      suggestedCategory: extractCategory(query),
      suggestedTool: weightQ ? {
        name: 'Axle Weight Calculator',
        url: '/tools/axle-weight-calculator',
        description: 'Calculate weight distribution across your axles',
      } : null,
      suggestedListings,
      inventoryStats: listingData?.stats || null,
      query,
    });

  } catch (error) {
    logger.error('AI Chat error', { error });
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
