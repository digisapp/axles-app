import type { Listing } from '@/types';

export interface DealInfo {
  type: 'hot' | 'good';
  percentage: number;
}

export function getDealInfo(listing: Listing): DealInfo | null {
  if (!listing.price || !listing.ai_price_estimate) return null;

  const ratio = listing.price / listing.ai_price_estimate;

  if (ratio <= 0.85) {
    return { type: 'hot', percentage: Math.round((1 - ratio) * 100) };
  }
  if (ratio <= 0.95) {
    return { type: 'good', percentage: Math.round((1 - ratio) * 100) };
  }

  return null;
}
