'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';

interface CompareListing {
  id: string;
  title: string;
  price: number | null;
  year: number | null;
  make: string | null;
  model: string | null;
  mileage: number | null;
  hours: number | null;
  condition: string | null;
  image_url: string | null;
}

interface CompareContextType {
  listings: CompareListing[];
  addListing: (listing: CompareListing) => void;
  removeListing: (id: string) => void;
  clearAll: () => void;
  isInCompare: (id: string) => boolean;
  canAddMore: boolean;
}

const CompareContext = createContext<CompareContextType | undefined>(undefined);

const MAX_COMPARE = 4;

// Helper to safely load from localStorage (runs only on client)
function loadFromStorage(): CompareListing[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem('compare-listings');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    localStorage.removeItem('compare-listings');
  }
  return [];
}

export function CompareProvider({ children }: { children: ReactNode }) {
  const [listings, setListings] = useState<CompareListing[]>(loadFromStorage);

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem('compare-listings', JSON.stringify(listings));
  }, [listings]);

  const addListing = useCallback((listing: CompareListing) => {
    setListings((prev) => {
      if (prev.length >= MAX_COMPARE) return prev;
      if (prev.some((l) => l.id === listing.id)) return prev;
      return [...prev, listing];
    });
  }, []);

  const removeListing = useCallback((id: string) => {
    setListings((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setListings([]);
  }, []);

  const isInCompare = useCallback((id: string) => {
    return listings.some((l) => l.id === id);
  }, [listings]);

  const value = useMemo(() => ({
    listings,
    addListing,
    removeListing,
    clearAll,
    isInCompare,
    canAddMore: listings.length < MAX_COMPARE,
  }), [listings, addListing, removeListing, clearAll, isInCompare]);

  return (
    <CompareContext.Provider value={value}>
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare() {
  const context = useContext(CompareContext);
  if (!context) {
    throw new Error('useCompare must be used within a CompareProvider');
  }
  return context;
}
