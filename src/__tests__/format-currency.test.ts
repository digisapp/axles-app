import { describe, it, expect } from 'vitest';
import { formatCurrency } from '@/lib/format-currency';

describe('formatCurrency', () => {
  it('formats whole dollar amounts', () => {
    expect(formatCurrency(50000)).toBe('$50,000.00');
  });

  it('formats cents correctly', () => {
    expect(formatCurrency(45000.5)).toBe('$45,000.50');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('formats negative numbers', () => {
    expect(formatCurrency(-1500)).toBe('-$1,500.00');
  });

  it('formats large numbers with commas', () => {
    expect(formatCurrency(1250000)).toBe('$1,250,000.00');
  });

  it('formats small amounts', () => {
    expect(formatCurrency(0.99)).toBe('$0.99');
  });
});
