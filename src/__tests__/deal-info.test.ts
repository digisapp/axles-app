import { describe, it, expect } from 'vitest';
import { getDealInfo } from '@/lib/deal-info';

describe('getDealInfo', () => {
  it('returns null when no price', () => {
    const listing = { price: null, ai_price_estimate: 50000 } as any;
    expect(getDealInfo(listing)).toBeNull();
  });

  it('returns null when no AI estimate', () => {
    const listing = { price: 45000, ai_price_estimate: null } as any;
    expect(getDealInfo(listing)).toBeNull();
  });

  it('returns null when price is at market value', () => {
    const listing = { price: 50000, ai_price_estimate: 50000 } as any;
    expect(getDealInfo(listing)).toBeNull();
  });

  it('returns hot deal when 15%+ below market', () => {
    const listing = { price: 40000, ai_price_estimate: 50000 } as any;
    const result = getDealInfo(listing);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('hot');
    expect(result!.percentage).toBe(20);
  });

  it('returns good deal when 5-15% below market', () => {
    const listing = { price: 45000, ai_price_estimate: 50000 } as any;
    const result = getDealInfo(listing);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('good');
    expect(result!.percentage).toBe(10);
  });

  it('returns null when price is above market', () => {
    const listing = { price: 55000, ai_price_estimate: 50000 } as any;
    expect(getDealInfo(listing)).toBeNull();
  });
});
