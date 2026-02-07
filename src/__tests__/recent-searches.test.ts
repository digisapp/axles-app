import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getRecentSearches, saveRecentSearch, clearRecentSearches } from '@/lib/recent-searches';

describe('recent-searches', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getRecentSearches', () => {
    it('returns empty array when no searches saved', () => {
      expect(getRecentSearches()).toEqual([]);
    });

    it('returns saved searches', () => {
      localStorage.setItem('axlon-recent-searches', JSON.stringify(['trucks', 'trailers']));
      expect(getRecentSearches()).toEqual(['trucks', 'trailers']);
    });

    it('returns empty array on corrupt data', () => {
      localStorage.setItem('axlon-recent-searches', 'not-json');
      expect(getRecentSearches()).toEqual([]);
    });
  });

  describe('saveRecentSearch', () => {
    it('saves a search to localStorage', () => {
      saveRecentSearch('trucks');
      expect(getRecentSearches()).toEqual(['trucks']);
    });

    it('does not save empty queries', () => {
      saveRecentSearch('');
      saveRecentSearch('   ');
      expect(getRecentSearches()).toEqual([]);
    });

    it('deduplicates case-insensitively', () => {
      saveRecentSearch('Trucks');
      saveRecentSearch('trucks');
      expect(getRecentSearches()).toEqual(['trucks']);
    });

    it('puts newest first', () => {
      saveRecentSearch('trucks');
      saveRecentSearch('trailers');
      expect(getRecentSearches()).toEqual(['trailers', 'trucks']);
    });

    it('limits to 5 items', () => {
      for (let i = 0; i < 7; i++) {
        saveRecentSearch(`search-${i}`);
      }
      expect(getRecentSearches()).toHaveLength(5);
      expect(getRecentSearches()[0]).toBe('search-6');
    });
  });

  describe('clearRecentSearches', () => {
    it('clears all saved searches', () => {
      saveRecentSearch('trucks');
      saveRecentSearch('trailers');
      clearRecentSearches();
      expect(getRecentSearches()).toEqual([]);
    });
  });
});
