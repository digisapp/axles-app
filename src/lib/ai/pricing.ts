import { createXai } from '@ai-sdk/xai';
import { generateObject } from 'ai';
import { z } from 'zod';
import type { AIPriceEstimate, Listing } from '@/types';
import {
  cacheGet,
  cacheSet,
  generatePriceCacheKey,
  CACHE_TTL,
  isRedisConfigured,
} from '@/lib/cache';

// Lazy initialization to avoid build-time errors
function getXai() {
  if (!process.env.XAI_API_KEY) {
    throw new Error('XAI_API_KEY is not configured');
  }
  return createXai({
    apiKey: process.env.XAI_API_KEY,
  });
}

const priceEstimateSchema = z.object({
  estimated_price: z.number().describe('Estimated fair market value in USD'),
  confidence: z.number().min(0).max(1).describe('Confidence in the estimate from 0 to 1'),
  price_range_low: z.number().describe('Lower bound of reasonable price range'),
  price_range_high: z.number().describe('Upper bound of reasonable price range'),
  market_trend: z.enum(['rising', 'stable', 'declining']).describe('Current market trend for this type of equipment'),
  factors: z.array(z.string()).describe('Key factors affecting the price'),
});

export async function estimatePrice(listing: Partial<Listing>): Promise<AIPriceEstimate> {
  // Check cache first if Redis is available
  if (isRedisConfigured()) {
    const cacheKey = generatePriceCacheKey({
      make: listing.make,
      model: listing.model,
      year: listing.year,
      condition: listing.condition,
      mileage: listing.mileage,
      category_id: listing.category_id,
    });

    const cached = await cacheGet<AIPriceEstimate>(cacheKey);
    if (cached) {
      console.log('Price estimate cache hit');
      return cached;
    }
  }

  const xai = getXai();

  const { object } = await generateObject({
    model: xai('grok-2-latest'),
    schema: priceEstimateSchema,
    prompt: `You are a pricing expert for commercial trucks, trailers, and heavy equipment.

Analyze the following listing and provide a fair market price estimate:

Equipment Details:
- Category: ${listing.category?.name || 'Unknown'}
- Year: ${listing.year || 'Unknown'}
- Make: ${listing.make || 'Unknown'}
- Model: ${listing.model || 'Unknown'}
- Mileage: ${listing.mileage ? `${listing.mileage.toLocaleString()} miles` : 'Unknown'}
- Hours: ${listing.hours ? `${listing.hours.toLocaleString()} hours` : 'N/A'}
- Condition: ${listing.condition || 'Unknown'}
- Location: ${listing.city ? `${listing.city}, ` : ''}${listing.state || 'Unknown'}

Specifications:
${listing.specs ? JSON.stringify(listing.specs, null, 2) : 'None provided'}

Description:
${listing.description || 'None provided'}

Consider:
1. Current market conditions for this type of equipment
2. Age and depreciation
3. Mileage/hours relative to expected lifespan
4. Regional price variations
5. Condition and any noted issues
6. Popular features and specifications

Provide a realistic price estimate based on 2024-2025 market data for commercial vehicles.`,
  });

  const result: AIPriceEstimate = {
    estimated_price: object.estimated_price,
    confidence: object.confidence,
    price_range: {
      low: object.price_range_low,
      high: object.price_range_high,
    },
    market_trend: object.market_trend,
    factors: object.factors,
  };

  // Cache the result
  if (isRedisConfigured()) {
    const cacheKey = generatePriceCacheKey({
      make: listing.make,
      model: listing.model,
      year: listing.year,
      condition: listing.condition,
      mileage: listing.mileage,
      category_id: listing.category_id,
    });

    await cacheSet(cacheKey, result, CACHE_TTL.PRICE_ESTIMATE);
    console.log('Price estimate cached');
  }

  return result;
}

export async function comparePrices(
  listing: Partial<Listing>,
  askingPrice: number
): Promise<{
  assessment: 'excellent' | 'good' | 'fair' | 'high' | 'very_high';
  explanation: string;
  suggested_price: number;
}> {
  const estimate = await estimatePrice(listing);
  const ratio = askingPrice / estimate.estimated_price;

  let assessment: 'excellent' | 'good' | 'fair' | 'high' | 'very_high';
  if (ratio <= 0.85) {
    assessment = 'excellent';
  } else if (ratio <= 0.95) {
    assessment = 'good';
  } else if (ratio <= 1.05) {
    assessment = 'fair';
  } else if (ratio <= 1.15) {
    assessment = 'high';
  } else {
    assessment = 'very_high';
  }

  const explanations = {
    excellent: `This price is ${Math.round((1 - ratio) * 100)}% below market value. Great deal!`,
    good: `This price is slightly below market value. Good opportunity.`,
    fair: `This price is in line with market value.`,
    high: `This price is ${Math.round((ratio - 1) * 100)}% above market value. Consider negotiating.`,
    very_high: `This price is significantly above market value. Proceed with caution.`,
  };

  return {
    assessment,
    explanation: explanations[assessment],
    suggested_price: estimate.estimated_price,
  };
}
