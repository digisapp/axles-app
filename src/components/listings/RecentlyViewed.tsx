'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, ChevronRight, ImageOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';
import { useImageFallback } from '@/hooks/useImageFallback';

// Helper function to format relative time
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

interface RecentListing {
  id: string;
  title: string;
  price: number | null;
  year: number | null;
  make: string | null;
  model: string | null;
  city: string | null;
  state: string | null;
  imageUrl: string | null;
  viewedAt: number;
}

const STORAGE_KEY = 'axlon_recently_viewed';
const MAX_RECENT = 10;

export function addToRecentlyViewed(listing: Omit<RecentListing, 'viewedAt'>) {
  if (typeof window === 'undefined') return;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    let recent: RecentListing[] = stored ? JSON.parse(stored) : [];

    // Remove if already exists
    recent = recent.filter((item) => item.id !== listing.id);

    // Add to beginning with timestamp
    recent.unshift({
      ...listing,
      viewedAt: Date.now(),
    });

    // Keep only MAX_RECENT items
    recent = recent.slice(0, MAX_RECENT);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(recent));
  } catch (error) {
    logger.error('Error saving to recently viewed', { error });
  }
}

export function getRecentlyViewed(): RecentListing[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    logger.error('Error reading recently viewed', { error });
    return [];
  }
}

export function clearRecentlyViewed() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

function RecentCard({ listing }: { listing: RecentListing }) {
  const { hasError, handleError } = useImageFallback();

  return (
    <Link href={`/listing/${listing.id}`}>
      <Card className="overflow-hidden hover:shadow-md transition-shadow h-full">
        <div className="relative aspect-[4/3] bg-muted">
          {listing.imageUrl && !hasError ? (
            <Image
              src={listing.imageUrl}
              alt={listing.title}
              fill
              className="object-cover"
              unoptimized
              onError={handleError}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-1">
              <ImageOff className="w-5 h-5 opacity-50" />
              <span className="text-[10px]">No Image</span>
            </div>
          )}
          {/* Relative time badge */}
          <span className="absolute top-1 right-1 text-[9px] bg-black/50 text-white px-1.5 py-0.5 rounded">
            {formatRelativeTime(listing.viewedAt)}
          </span>
        </div>
        <CardContent className="p-2 md:p-3">
          <h3 className="font-medium text-xs md:text-sm line-clamp-1">
            {listing.title}
          </h3>
          <p className="text-sm md:text-base font-bold text-primary mt-0.5">
            {listing.price ? `$${listing.price.toLocaleString()}` : 'Call'}
          </p>
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
            {[listing.year, listing.make].filter(Boolean).join(' ')}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

interface RecentlyViewedProps {
  currentListingId?: string;
  maxItems?: number;
  title?: string;
  className?: string;
}

export function RecentlyViewed({
  currentListingId,
  maxItems = 6,
  title = 'Recently Viewed',
  className = '',
}: RecentlyViewedProps) {
  const [recentListings, setRecentListings] = useState<RecentListing[]>([]);

  useEffect(() => {
    const recent = getRecentlyViewed().filter(
      (item) => item.id !== currentListingId
    );
    setRecentListings(recent.slice(0, maxItems));
  }, [currentListingId, maxItems]);

  if (recentListings.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
          <Clock className="w-5 h-5 text-muted-foreground" />
          {title}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => {
            clearRecentlyViewed();
            setRecentListings([]);
          }}
        >
          Clear
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        {recentListings.map((listing) => (
          <RecentCard key={listing.id} listing={listing} />
        ))}
      </div>
    </div>
  );
}

// Hook for tracking views
export function useTrackView(listing: {
  id: string;
  title: string;
  price: number | null;
  year: number | null;
  make: string | null;
  model: string | null;
  city: string | null;
  state: string | null;
  images?: { url: string; is_primary?: boolean }[];
}) {
  useEffect(() => {
    if (!listing?.id) return;

    const primaryImage =
      listing.images?.find((img) => img.is_primary) || listing.images?.[0];

    addToRecentlyViewed({
      id: listing.id,
      title: listing.title,
      price: listing.price,
      year: listing.year,
      make: listing.make,
      model: listing.model,
      city: listing.city,
      state: listing.state,
      imageUrl: primaryImage?.url || null,
    });
  }, [listing]);
}

function RecentCompactCard({ listing }: { listing: RecentListing }) {
  const { hasError, handleError } = useImageFallback();

  return (
    <Link
      href={`/listing/${listing.id}`}
      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
    >
      <div className="relative w-12 h-12 rounded overflow-hidden bg-muted flex-shrink-0">
        {listing.imageUrl && !hasError ? (
          <Image
            src={listing.imageUrl}
            alt={listing.title}
            fill
            className="object-cover"
            unoptimized
            onError={handleError}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageOff className="w-4 h-4 text-muted-foreground/50" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium line-clamp-1">{listing.title}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <span>{listing.price ? `$${listing.price.toLocaleString()}` : 'Call'}</span>
          <span className="text-muted-foreground/50">·</span>
          <span className="text-muted-foreground/70">{formatRelativeTime(listing.viewedAt)}</span>
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
    </Link>
  );
}

// Compact recently viewed for sidebar/footer
export function RecentlyViewedCompact({ maxItems = 4 }: { maxItems?: number }) {
  const [recentListings, setRecentListings] = useState<RecentListing[]>([]);

  useEffect(() => {
    setRecentListings(getRecentlyViewed().slice(0, maxItems));
  }, [maxItems]);

  if (recentListings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        <Clock className="w-4 h-4" />
        Recently Viewed
      </h3>
      <div className="space-y-2">
        {recentListings.map((listing) => (
          <RecentCompactCard key={listing.id} listing={listing} />
        ))}
      </div>
    </div>
  );
}
