'use client';

import { forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface LoadMoreButtonProps {
  onClick: () => void;
  isLoading: boolean;
  hasMore: boolean;
  loadedCount: number;
  totalCount: number;
}

export const LoadMoreButton = forwardRef<HTMLDivElement, LoadMoreButtonProps>(
  ({ onClick, isLoading, hasMore, loadedCount, totalCount }, ref) => {
    if (!hasMore) {
      return (
        <div ref={ref} className="text-center py-8 text-muted-foreground">
          <p className="text-sm">
            Showing all {loadedCount.toLocaleString()} results
          </p>
        </div>
      );
    }

    return (
      <div ref={ref} className="flex flex-col items-center gap-2 py-8">
        <p className="text-sm text-muted-foreground">
          Showing {loadedCount.toLocaleString()} of {totalCount.toLocaleString()} results
        </p>
        <Button
          variant="outline"
          onClick={onClick}
          disabled={isLoading}
          className="min-w-[200px]"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Loading...
            </>
          ) : (
            `Load More`
          )}
        </Button>
      </div>
    );
  }
);

LoadMoreButton.displayName = 'LoadMoreButton';

interface InfiniteScrollTriggerProps {
  /** Ref to attach to the trigger element */
  triggerRef: React.RefObject<HTMLDivElement | null>;
  /** Whether currently loading */
  isLoading: boolean;
}

export function InfiniteScrollTrigger({
  triggerRef,
  isLoading,
}: InfiniteScrollTriggerProps) {
  return (
    <div ref={triggerRef} className="flex justify-center py-4">
      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading more...</span>
        </div>
      )}
    </div>
  );
}
