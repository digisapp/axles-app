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
    'overloaded', 'underweight', 'balance', 'lbs', 'pounds'
  ];

  return weightKeywords.some(keyword => q.includes(keyword));
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
    const extractedPrice = extractPrice(query);

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

      return NextResponse.json({
        type: 'chat',
        response: "I'm sorry, I can't answer questions right now. Please try searching instead.",
        suggestedCategory: extractCategory(query),
      });
    }

    // Build system prompt - add finance context if relevant
    let systemPrompt = `You are a helpful assistant for AxlesAI, a marketplace for buying and selling commercial trucks, trailers, and heavy equipment.

IMPORTANT: Always respond in the SAME LANGUAGE as the user's question. If they ask in Spanish, respond in Spanish. If they ask in French, respond in French. Match their language exactly.

Your role is to help users with:
- Advice on buying/selling trucks, trailers, and equipment
- Explaining differences between equipment types
- Pricing guidance and market insights
- Maintenance tips and what to look for
- Industry terminology and specifications
- FINANCING questions for commercial trucks and trailers
- AXLE WEIGHT and load distribution questions

For FINANCING questions:
- Commercial truck/trailer loans typically require 10-20% down payment
- Interest rates range from 6-12% APR depending on credit score
- Common terms are 48-84 months
- New equipment often gets better rates than used
- Mention that AxlesAI has a financing calculator on every listing page

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

For detailed calculations, direct users to the Axle Weight Calculator at axles.ai/tools/axle-weight-calculator

Keep responses:
- Concise (2-4 short paragraphs or bullet points)
- Practical and actionable
- Focused on commercial trucking/equipment
- Friendly but professional

If the question is not related to trucks, trailers, heavy equipment, financing, or weight regulations, politely redirect them to search for equipment on the marketplace.

Do NOT use markdown formatting like ** or ## - just use plain text with line breaks.`;

    // Add finance context to prompt if we calculated it
    let prompt = query;
    if (financeInfo) {
      const scenario = financeInfo.scenarios[1];
      prompt = `${query}

[Context: User is asking about financing $${financeInfo.price.toLocaleString()}. With 10% down ($${financeInfo.downPayment.toLocaleString()}), at 7.5% APR for 60 months, the estimated monthly payment is $${scenario.monthly.toLocaleString()}/month. Total interest would be ~$${scenario.totalInterest.toLocaleString()}.]`;
    }

    const { text } = await generateText({
      model: xai('grok-3-mini'),
      system: systemPrompt,
      prompt,
    });

    return NextResponse.json({
      type: 'chat',
      response: text,
      financeInfo,
      suggestedCategory: extractCategory(query),
      suggestedTool: weightQ ? {
        name: 'Axle Weight Calculator',
        url: '/tools/axle-weight-calculator',
        description: 'Calculate weight distribution across your axles',
      } : null,
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
