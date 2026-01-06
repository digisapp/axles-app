'use client';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface ListingCardSkeletonProps {
  viewMode?: 'grid' | 'list';
}

export function ListingCardSkeleton({ viewMode = 'grid' }: ListingCardSkeletonProps) {
  if (viewMode === 'list') {
    return (
      <Card className="flex flex-col sm:flex-row overflow-hidden animate-pulse">
        <Skeleton className="w-full sm:w-48 md:w-64 h-48 sm:h-40 md:h-48" />
        <div className="flex-1 p-3 md:p-4 space-y-2 md:space-y-3">
          <Skeleton className="h-5 md:h-6 w-3/4" />
          <Skeleton className="h-6 md:h-8 w-32" />
          <div className="flex gap-4">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-4 w-full hidden md:block" />
          <Skeleton className="h-4 w-2/3 hidden md:block" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden animate-pulse">
      <Skeleton className="aspect-[4/3] w-full" />
      <div className="p-2 md:p-4 space-y-2 md:space-y-3">
        <Skeleton className="h-4 md:h-5 w-3/4" />
        <Skeleton className="h-5 md:h-6 w-24" />
        <div className="flex gap-2">
          <Skeleton className="h-3 md:h-4 w-12" />
          <Skeleton className="h-3 md:h-4 w-16" />
        </div>
        <Skeleton className="h-3 md:h-4 w-1/2" />
      </div>
    </Card>
  );
}

export function ListingGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <ListingCardSkeleton key={i} viewMode="grid" />
      ))}
    </div>
  );
}

export function ListingListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <ListingCardSkeleton key={i} viewMode="list" />
      ))}
    </div>
  );
}
