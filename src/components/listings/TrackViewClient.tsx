'use client';

import { useEffect } from 'react';
import { addToRecentlyViewed } from './RecentlyViewed';

interface TrackViewClientProps {
  listing: {
    id: string;
    title: string;
    price: number | null;
    year: number | null;
    make: string | null;
    model: string | null;
    city: string | null;
    state: string | null;
    imageUrl: string | null;
  };
}

export function TrackViewClient({ listing }: TrackViewClientProps) {
  useEffect(() => {
    if (!listing?.id) return;
    addToRecentlyViewed(listing);
  }, [listing]);

  return null;
}
