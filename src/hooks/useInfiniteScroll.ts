'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface UseInfiniteScrollOptions {
  /** Threshold in pixels before the end to trigger loading (default: 200) */
  threshold?: number;
  /** Whether infinite scroll is enabled */
  enabled?: boolean;
  /** Callback when the user scrolls near the bottom */
  onLoadMore: () => void;
  /** Whether there are more items to load */
  hasMore: boolean;
  /** Whether currently loading */
  isLoading: boolean;
}

export function useInfiniteScroll({
  threshold = 200,
  enabled = true,
  onLoadMore,
  hasMore,
  isLoading,
}: UseInfiniteScrollOptions) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled || isLoading || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          onLoadMore();
        }
      },
      {
        rootMargin: `${threshold}px`,
      }
    );

    observerRef.current = observer;

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [enabled, hasMore, isLoading, onLoadMore, threshold]);

  return { loadMoreRef };
}

interface UseLoadMoreOptions<T> {
  /** Initial data */
  initialData?: T[];
  /** Function to fetch more data */
  fetchMore: (page: number) => Promise<{ data: T[]; hasMore: boolean }>;
  /** Items per page */
  pageSize?: number;
}

export function useLoadMore<T>({
  initialData = [],
  fetchMore,
  pageSize = 20,
}: UseLoadMoreOptions<T>) {
  const [items, setItems] = useState<T[]>(initialData);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    setError(null);

    try {
      const nextPage = page + 1;
      const result = await fetchMore(nextPage);

      setItems((prev) => [...prev, ...result.data]);
      setHasMore(result.hasMore);
      setPage(nextPage);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load more'));
    } finally {
      setIsLoading(false);
    }
  }, [fetchMore, hasMore, isLoading, page]);

  const reset = useCallback((newData: T[] = []) => {
    setItems(newData);
    setPage(1);
    setHasMore(true);
    setError(null);
  }, []);

  return {
    items,
    page,
    hasMore,
    isLoading,
    error,
    loadMore,
    reset,
  };
}
