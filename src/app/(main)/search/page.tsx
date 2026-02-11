'use client';

import { useEffect, useState, useMemo, Suspense, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { AISearchBar } from '@/components/search/AISearchBar';
import { useListingTranslations } from '@/hooks/useListingTranslations';

// Dynamically import MapView to avoid SSR issues with Leaflet
const MapView = dynamic(
  () => import('@/components/search/MapView').then((mod) => mod.MapViewWrapper),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[500px] md:h-[600px] bg-muted rounded-lg flex items-center justify-center">
        <span className="text-muted-foreground">Loading map...</span>
      </div>
    ),
  }
);
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Grid3X3,
  List,
  Map,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Loader2,
  DollarSign,
  Truck,
  Clock,
  Sparkles,
  Gauge,
} from 'lucide-react';
import { AdvancedFilters, FilterValues } from '@/components/search/AdvancedFilters';
import { SaveSearchButton } from '@/components/search/SaveSearchButton';
import { ScrollToTop } from '@/components/ui/scroll-to-top';
import { SearchListingCard } from '@/components/search/SearchListingCard';
import { QuickFilterChip } from '@/components/search/QuickFilterChip';
import type { Listing, AISearchResult, Category } from '@/types';
import { logger } from '@/lib/logger';

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get('q') || '';
  const category = searchParams.get('category') || '';
  const page = parseInt(searchParams.get('page') || '1');

  const [listings, setListings] = useState<Listing[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [aiInterpretation, setAiInterpretation] = useState<AISearchResult | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'map'>('grid');
  const [sortBy, setSortBy] = useState('created_at');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [advancedFilters, setAdvancedFilters] = useState<FilterValues>({});
  const [totalWithoutPriceFilter, setTotalWithoutPriceFilter] = useState<number | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [useInfiniteMode, setUseInfiniteMode] = useState(false);

  // Refs to prevent infinite loops
  const fetchIdRef = useRef(0);
  const lastFetchParamsRef = useRef<string>('');

  // Memoize listing data for translation hook to prevent unnecessary re-renders
  const translationInput = useMemo(
    () => listings.map((l) => ({ id: l.id, title: l.title, description: l.description })),
    [listings]
  );

  // Translation hook for non-English users
  const { getTranslatedListing, isTranslating, needsTranslation, locale } = useListingTranslations(
    translationInput
  );

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/categories');
        if (response.ok) {
          const data = await response.json();
          setCategories(data.data || []);
        }
      } catch (error) {
        logger.error('Error fetching categories', { error });
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    // Create a stable key for this set of params to prevent duplicate fetches
    const filterKey = JSON.stringify(advancedFilters);
    const paramsKey = `${query}|${category}|${page}|${sortBy}|${filterKey}`;

    // Skip if we already fetched with these exact params
    if (paramsKey === lastFetchParamsRef.current) {
      return;
    }
    lastFetchParamsRef.current = paramsKey;

    const currentFetchId = ++fetchIdRef.current;

    const fetchListings = async () => {
      setIsLoading(true);

      try {
        // Simple category detection for common searches (fallback if AI fails)
        const categoryKeywords: Record<string, string> = {
          'trailers': 'trailers',
          'trailer': 'trailers',
          'trucks': 'trucks',
          'truck': 'trucks',
          'equipment': 'heavy-equipment',
          'heavy equipment': 'heavy-equipment',
        };
        const queryLower = query?.toLowerCase().trim() || '';
        const detectedCategory = categoryKeywords[queryLower];

        // If there's a natural language query, parse it with AI first
        let currentAiFilters = null;
        if (query && !category) {
          try {
            logger.debug('Search page calling AI search', { query });
            const aiResponse = await fetch('/api/ai/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query }),
            });

            if (aiResponse.ok) {
              const { data } = await aiResponse.json();
              logger.debug('Search page AI response', { data });
              // Only update state if this is still the current fetch
              if (currentFetchId === fetchIdRef.current) {
                setAiInterpretation(data);
              }
              currentAiFilters = data?.filters;
            } else {
              logger.error('Search page AI search returned error', { status: aiResponse.status });
            }
          } catch (aiError) {
            logger.error('Search page AI search failed', { error: aiError });
          }

          // Fallback: if AI didn't return a category but we detected one, use it
          if (!currentAiFilters?.category_slug && detectedCategory) {
            currentAiFilters = { ...currentAiFilters, category_slug: detectedCategory };
          }
        }

        // Abort if a newer fetch was started
        if (currentFetchId !== fetchIdRef.current) return;

        // Build the API URL with filters
        const params = new URLSearchParams();
        params.set('page', page.toString());
        params.set('sort', sortBy);
        if (category) params.set('category', category);

        // Add advanced filters
        if (advancedFilters.priceMin) params.set('min_price', advancedFilters.priceMin.toString());
        if (advancedFilters.priceMax) params.set('max_price', advancedFilters.priceMax.toString());
        if (advancedFilters.yearMin) params.set('min_year', advancedFilters.yearMin.toString());
        if (advancedFilters.yearMax) params.set('max_year', advancedFilters.yearMax.toString());
        if (advancedFilters.mileageMax) params.set('max_mileage', advancedFilters.mileageMax.toString());
        if (advancedFilters.makes?.length) params.set('make', advancedFilters.makes.join(','));
        if (advancedFilters.conditions?.length) params.set('condition', advancedFilters.conditions.join(','));
        if (advancedFilters.states?.length) params.set('state', advancedFilters.states.join(','));
        if (advancedFilters.category) params.set('category', advancedFilters.category);

        // Add AI-extracted filters
        const aiFilters = currentAiFilters;
        if (aiFilters) {
          const f = aiFilters;
          if (!advancedFilters.category && !category && f.category_slug) params.set('category', f.category_slug);
          if (!advancedFilters.priceMin && f.min_price) params.set('min_price', f.min_price.toString());
          if (!advancedFilters.priceMax && f.max_price) params.set('max_price', f.max_price.toString());
          if (!advancedFilters.yearMin && f.min_year) params.set('min_year', f.min_year.toString());
          if (!advancedFilters.yearMax && f.max_year) params.set('max_year', f.max_year.toString());
          if (!advancedFilters.makes?.length && f.make) params.set('make', f.make);
          if (!advancedFilters.states?.length && f.state) params.set('state', f.state);
          if (!advancedFilters.mileageMax && f.max_mileage) params.set('max_mileage', f.max_mileage.toString());
          if (!advancedFilters.conditions?.length && f.condition) params.set('condition', f.condition.join(','));
        }

        // Check ALL possible category sources
        const hasCategory = params.has('category') || !!advancedFilters.category || !!category || !!aiFilters?.category_slug || !!detectedCategory;

        // Only add text search if NO category filter exists
        if (query && !hasCategory) {
          params.set('q', query);
        } else {
          params.delete('q');
        }

        const response = await fetch(`/api/listings?${params.toString()}`);
        const data = await response.json();

        // If we got 0 results but had AI filters (especially price), retry without strict filters
        const hasPriceFilter = params.has('min_price') || params.has('max_price');
        const hasAIFilters = aiFilters && Object.keys(aiFilters).length > 0;

        if ((data.data?.length === 0 || data.total === 0) && hasAIFilters && hasPriceFilter) {
          // Retry without price filter to see if there are results
          const fallbackParams = new URLSearchParams(params);
          fallbackParams.delete('min_price');
          fallbackParams.delete('max_price');

          const fallbackResponse = await fetch(`/api/listings?${fallbackParams.toString()}`);
          const fallbackData = await fallbackResponse.json();

          if (currentFetchId === fetchIdRef.current) {
            if (fallbackData.total > 0) {
              // Show results without price filter, with a note
              setListings(fallbackData.data || []);
              setTotalCount(fallbackData.total || 0);
              setTotalPages(fallbackData.total_pages || 1);
              setTotalWithoutPriceFilter(fallbackData.total);
            } else {
              // No results either way
              setListings([]);
              setTotalCount(0);
              setTotalPages(1);
              setTotalWithoutPriceFilter(null);
            }
          }
        } else {
          // Only update state if this is still the current fetch
          if (currentFetchId === fetchIdRef.current) {
            setListings(data.data || []);
            setTotalCount(data.total || 0);
            setTotalPages(data.total_pages || 1);
            setTotalWithoutPriceFilter(null);
          }
        }
      } catch (error) {
        logger.error('Search error', { error });
      } finally {
        if (currentFetchId === fetchIdRef.current) {
          setIsLoading(false);
        }
      }
    };

    fetchListings();
  }, [query, category, page, sortBy, advancedFilters]);

  const handlePageChange = (newPage: number) => {
    if (useInfiniteMode) {
      setUseInfiniteMode(false);
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`/search?${params.toString()}`);
    // Scroll to top when changing pages
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Load more handler for infinite scroll mode
  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || page >= totalPages) return;

    setIsLoadingMore(true);
    setUseInfiniteMode(true);

    try {
      const nextPage = page + 1;

      // Build the API URL with current filters
      const params = new URLSearchParams();
      params.set('page', nextPage.toString());
      params.set('sort', sortBy);
      if (category) params.set('category', category);

      // Add advanced filters
      if (advancedFilters.priceMin) params.set('min_price', advancedFilters.priceMin.toString());
      if (advancedFilters.priceMax) params.set('max_price', advancedFilters.priceMax.toString());
      if (advancedFilters.yearMin) params.set('min_year', advancedFilters.yearMin.toString());
      if (advancedFilters.yearMax) params.set('max_year', advancedFilters.yearMax.toString());
      if (advancedFilters.mileageMax) params.set('max_mileage', advancedFilters.mileageMax.toString());
      if (advancedFilters.makes?.length) params.set('make', advancedFilters.makes.join(','));
      if (advancedFilters.conditions?.length) params.set('condition', advancedFilters.conditions.join(','));
      if (advancedFilters.states?.length) params.set('state', advancedFilters.states.join(','));
      if (advancedFilters.category) params.set('category', advancedFilters.category);

      const response = await fetch(`/api/listings?${params.toString()}`);
      const data = await response.json();

      if (data.data?.length > 0) {
        setListings((prev) => [...prev, ...data.data]);
        // Update URL without full navigation
        const urlParams = new URLSearchParams(searchParams.toString());
        urlParams.set('page', nextPage.toString());
        window.history.replaceState(null, '', `/search?${urlParams.toString()}`);
      }
    } catch (error) {
      logger.error('Load more error', { error });
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, page, totalPages, sortBy, category, advancedFilters, searchParams]);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Search Bar */}
      <div className="md:hidden sticky top-14 z-40 bg-background border-b px-4 py-3">
        <AISearchBar defaultValue={query} size="small" />
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 md:py-6">
        {/* Desktop Search Bar */}
        <div className="hidden md:block mb-6">
          <AISearchBar defaultValue={query} />
        </div>

        {/* Price filter fallback notice - only show when relevant */}
        {totalWithoutPriceFilter !== null && (
          <div className="mb-4 md:mb-6 p-3 md:p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
            <p className="text-xs md:text-sm text-amber-700 dark:text-amber-400">
              No listings found with that price range. Showing all {totalWithoutPriceFilter} matching listings (most are &quot;Call for Price&quot;).
            </p>
          </div>
        )}

        {/* Quick Filter Chips */}
        <div className="flex flex-wrap gap-2 mb-4 md:mb-6 overflow-x-auto pb-1">
          {/* Price filters */}
          <QuickFilterChip
            label="Under $50K"
            icon={<DollarSign className="w-3 h-3" />}
            isActive={advancedFilters.priceMax === 50000 && !advancedFilters.category}
            onClick={() => {
              const isActive = advancedFilters.priceMax === 50000 && !advancedFilters.category;
              if (isActive) {
                setAdvancedFilters({});
              } else {
                setAdvancedFilters({ priceMax: 50000 });
              }
            }}
          />
          <QuickFilterChip
            label="Under $100K"
            icon={<DollarSign className="w-3 h-3" />}
            isActive={advancedFilters.priceMax === 100000 && !advancedFilters.category}
            onClick={() => {
              const isActive = advancedFilters.priceMax === 100000 && !advancedFilters.category;
              if (isActive) {
                setAdvancedFilters({});
              } else {
                setAdvancedFilters({ priceMax: 100000 });
              }
            }}
          />

          {/* Year filter */}
          <QuickFilterChip
            label="2020+"
            icon={<Clock className="w-3 h-3" />}
            isActive={advancedFilters.yearMin === 2020 && !advancedFilters.category}
            onClick={() => {
              const isActive = advancedFilters.yearMin === 2020 && !advancedFilters.category;
              if (isActive) {
                setAdvancedFilters({});
              } else {
                setAdvancedFilters({ yearMin: 2020 });
              }
            }}
          />

          {/* Low mileage */}
          <QuickFilterChip
            label="Low Miles"
            icon={<Gauge className="w-3 h-3" />}
            isActive={advancedFilters.mileageMax === 200000 && !advancedFilters.category}
            onClick={() => {
              const isActive = advancedFilters.mileageMax === 200000 && !advancedFilters.category;
              if (isActive) {
                setAdvancedFilters({});
              } else {
                setAdvancedFilters({ mileageMax: 200000 });
              }
            }}
          />

          {/* Divider */}
          <div className="w-px h-6 bg-border self-center hidden sm:block" />

          {/* Category filters */}
          <QuickFilterChip
            label="New Trucks"
            icon={<Sparkles className="w-3 h-3" />}
            isActive={advancedFilters.category === 'trucks' && (advancedFilters.conditions?.includes('new') || false)}
            onClick={() => {
              const isActive = advancedFilters.category === 'trucks' && advancedFilters.conditions?.includes('new');
              if (isActive) {
                setAdvancedFilters({});
              } else {
                setAdvancedFilters({ category: 'trucks', conditions: ['new'] });
              }
            }}
          />
          <QuickFilterChip
            label="Used Trucks"
            icon={<Truck className="w-3 h-3" />}
            isActive={advancedFilters.category === 'trucks' && (advancedFilters.conditions?.includes('used') || false)}
            onClick={() => {
              const isActive = advancedFilters.category === 'trucks' && advancedFilters.conditions?.includes('used');
              if (isActive) {
                setAdvancedFilters({});
              } else {
                setAdvancedFilters({ category: 'trucks', conditions: ['used'] });
              }
            }}
          />
          <QuickFilterChip
            label="Trailers"
            isActive={advancedFilters.category === 'trailers' && !advancedFilters.conditions?.length}
            onClick={() => {
              const isActive = advancedFilters.category === 'trailers' && !advancedFilters.conditions?.length;
              if (isActive) {
                setAdvancedFilters({});
              } else {
                setAdvancedFilters({ category: 'trailers' });
              }
            }}
          />
          <QuickFilterChip
            label="Equipment"
            isActive={advancedFilters.category === 'heavy-equipment'}
            onClick={() => {
              const isActive = advancedFilters.category === 'heavy-equipment';
              if (isActive) {
                setAdvancedFilters({});
              } else {
                setAdvancedFilters({ category: 'heavy-equipment' });
              }
            }}
          />

          {/* Clear all button when filters are active */}
          {Object.keys(advancedFilters).length > 0 && (
            <button
              onClick={() => setAdvancedFilters({})}
              className="px-3 py-1.5 text-xs md:text-sm rounded-full border border-destructive/50 text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1.5"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Results Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 md:mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold line-clamp-1">
              {query ? `Results for "${query}"` : category ? `${category.replace(/-/g, ' ')}` : 'All Listings'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {totalCount.toLocaleString()} listings found
            </p>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
            {/* Save Search Button */}
            {(query || Object.keys(advancedFilters).length > 0) && (
              <SaveSearchButton
                query={query}
                filters={advancedFilters as Record<string, unknown>}
              />
            )}
            {/* Mobile Filter Button */}
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 flex-shrink-0 md:hidden">
                  <SlidersHorizontal className="w-4 h-4" />
                  Filters
                  {Object.keys(advancedFilters).length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs px-1.5">
                      {Object.keys(advancedFilters).length}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[85vh] rounded-t-xl overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="mt-4">
                  <AdvancedFilters
                    filters={advancedFilters}
                    onFiltersChange={setAdvancedFilters}
                    categories={categories}
                    onClose={() => setFiltersOpen(false)}
                  />
                </div>
              </SheetContent>
            </Sheet>

            {/* Desktop Filter Sheet */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 hidden md:flex">
                  <SlidersHorizontal className="w-4 h-4" />
                  Filters
                  {Object.keys(advancedFilters).length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs px-1.5">
                      {Object.keys(advancedFilters).length}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[400px] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="mt-4">
                  <AdvancedFilters
                    filters={advancedFilters}
                    onFiltersChange={setAdvancedFilters}
                    categories={categories}
                  />
                </div>
              </SheetContent>
            </Sheet>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-32 md:w-40 flex-shrink-0">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Newest First</SelectItem>
                <SelectItem value="price">Price: Low to High</SelectItem>
                <SelectItem value="price_desc">Price: High to Low</SelectItem>
                <SelectItem value="year">Year: Newest</SelectItem>
                <SelectItem value="mileage">Mileage: Lowest</SelectItem>
              </SelectContent>
            </Select>

            <div className="hidden sm:flex border rounded-lg overflow-hidden flex-shrink-0">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-none"
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-none"
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'map' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-none"
                onClick={() => setViewMode('map')}
              >
                <Map className="w-4 h-4" />
              </Button>
            </div>

            {/* Mobile Map Toggle */}
            <Button
              variant={viewMode === 'map' ? 'secondary' : 'outline'}
              size="sm"
              className="sm:hidden flex-shrink-0"
              onClick={() => setViewMode(viewMode === 'map' ? 'grid' : 'map')}
            >
              <Map className="w-4 h-4 mr-1" />
              Map
            </Button>
          </div>
        </div>

        {/* Results Grid / Map */}
        {viewMode === 'map' ? (
          <MapView
            listings={listings}
            isLoading={isLoading}
            onClose={() => setViewMode('grid')}
          />
        ) : isLoading ? (
          <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4' : 'space-y-4'}>
            {[...Array(8)].map((_, i) => (
              <ListingCardSkeleton key={i} viewMode={viewMode} />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-12 md:py-16">
            <div className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-8 h-8 md:w-10 md:h-10 text-primary" />
            </div>
            <h2 className="text-lg md:text-xl font-semibold mb-2">Axlon couldn&apos;t find a match</h2>
            <p className="text-sm md:text-base text-muted-foreground mb-4 max-w-md mx-auto">
              No listings match your search. Try different keywords or adjust your filters.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button asChild variant="outline">
                <Link href="/search">Browse All Listings</Link>
              </Button>
              <Button asChild>
                <Link href="/">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Ask Axlon
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4' : 'space-y-4'}>
            {listings.map((listing) => {
              const translated = getTranslatedListing(listing);
              return (
                <SearchListingCard
                  key={listing.id}
                  listing={listing}
                  viewMode={viewMode}
                  translatedTitle={translated.title}
                  translatedDescription={translated.description}
                  isTranslated={translated.isTranslated}
                />
              );
            })}
          </div>
        )}

        {/* Pagination / Load More - hide when in map view */}
        {totalPages > 1 && viewMode !== 'map' && (
          <div className="flex flex-col items-center gap-4 mt-6 md:mt-8">
            {/* Load More Button */}
            {page < totalPages && (
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  Showing {listings.length} of {totalCount.toLocaleString()} results
                </p>
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="min-w-[200px]"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </Button>
              </div>
            )}

            {/* Traditional Pagination */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">Previous</span>
              </Button>

              <span className="text-sm text-muted-foreground px-2 md:px-4">
                Page {page} of {totalPages}
              </span>

              <Button
                variant="ghost"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
              >
                <span className="hidden sm:inline mr-1">Next</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Show count when on last page or single page */}
        {(totalPages === 1 || page >= totalPages) && listings.length > 0 && viewMode !== 'map' && (
          <p className="text-center text-sm text-muted-foreground mt-6">
            Showing all {listings.length} results
          </p>
        )}
      </div>

      {/* Scroll to top button */}
      <ScrollToTop />
    </div>
  );
}

function ListingCardSkeleton({ viewMode }: { viewMode: 'grid' | 'list' | 'map' }) {
  if (viewMode === 'list') {
    return (
      <Card className="flex flex-col sm:flex-row overflow-hidden">
        <Skeleton className="w-full sm:w-48 md:w-64 h-48 sm:h-40 md:h-48" />
        <div className="flex-1 p-3 md:p-4 space-y-2 md:space-y-3">
          <Skeleton className="h-5 md:h-6 w-3/4" />
          <Skeleton className="h-6 md:h-8 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3 hidden md:block" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <Skeleton className="aspect-[4/3] w-full" />
      <div className="p-2 md:p-4 space-y-2 md:space-y-3">
        <Skeleton className="h-4 md:h-5 w-3/4" />
        <Skeleton className="h-5 md:h-6 w-24" />
        <Skeleton className="h-3 md:h-4 w-1/2" />
      </div>
    </Card>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
      <SearchPageContent />
    </Suspense>
  );
}
