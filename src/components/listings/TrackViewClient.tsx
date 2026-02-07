'use client';

import { useEffect, useRef } from 'react';
import { addToRecentlyViewed } from './RecentlyViewed';
import { logger } from '@/lib/logger';

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
  const tracked = useRef(false);

  useEffect(() => {
    if (!listing?.id || tracked.current) return;

    // Add to recently viewed (local storage)
    addToRecentlyViewed(listing);

    // Track view in database for analytics
    tracked.current = true;
    fetch(`/api/listings/${listing.id}/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).catch((err) => {
      logger.error('Failed to track view', { error: err });
    });
  }, [listing]);

  return null;
}
