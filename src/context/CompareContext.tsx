'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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

export function CompareProvider({ children }: { children: ReactNode }) {
  const [listings, setListings] = useState<CompareListing[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('compare-listings');
    if (saved) {
      try {
        setListings(JSON.parse(saved));
      } catch {
        localStorage.removeItem('compare-listings');
      }
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem('compare-listings', JSON.stringify(listings));
  }, [listings]);

  const addListing = (listing: CompareListing) => {
    if (listings.length >= MAX_COMPARE) return;
    if (listings.some((l) => l.id === listing.id)) return;
    setListings((prev) => [...prev, listing]);
  };

  const removeListing = (id: string) => {
    setListings((prev) => prev.filter((l) => l.id !== id));
  };

  const clearAll = () => {
    setListings([]);
  };

  const isInCompare = (id: string) => {
    return listings.some((l) => l.id === id);
  };

  return (
    <CompareContext.Provider
      value={{
        listings,
        addListing,
        removeListing,
        clearAll,
        isInCompare,
        canAddMore: listings.length < MAX_COMPARE,
      }}
    >
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
