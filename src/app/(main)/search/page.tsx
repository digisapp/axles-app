'use client';

import { useEffect, useState, Suspense, lazy } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { AISearchBar } from '@/components/search/AISearchBar';

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
  MapPin,
  Map,
  Calendar,
  Gauge,
  Sparkles,
  Filter,
  SlidersHorizontal,
  Heart,
  ChevronLeft,
  ChevronRight,
  X,
  TrendingDown,
  Flame,
} from 'lucide-react';
import { AdvancedFilters, FilterValues } from '@/components/search/AdvancedFilters';
import { CompareButton } from '@/components/listings/CompareButton';
import { SaveSearchButton } from '@/components/search/SaveSearchButton';
import type { Listing, AISearchResult, Category } from '@/types';

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
        console.error('Error fetching categories:', error);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
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
            const aiResponse = await fetch('/api/ai/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query }),
            });

            if (aiResponse.ok) {
              const { data } = await aiResponse.json();
              setAiInterpretation(data);
              currentAiFilters = data?.filters; // Use immediately, don't wait for state update
            }
          } catch (aiError) {
            console.error('AI search failed:', aiError);
          }

          // Fallback: if AI didn't return a category but we detected one, use it
          if (!currentAiFilters?.category_slug && detectedCategory) {
            currentAiFilters = { ...currentAiFilters, category_slug: detectedCategory };
          }
        }

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

        // Add AI-extracted filters (use currentAiFilters from this request, not stale state)
        const aiFilters = currentAiFilters || aiInterpretation?.filters;
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

        // HARDENING: Check ALL possible category sources
        const hasCategory = params.has('category') || !!advancedFilters.category || !!category || !!aiFilters?.category_slug || !!detectedCategory;

        // Only add text search if NO category filter exists from ANY source
        if (query && !hasCategory) {
          params.set('q', query);
        } else {
          params.delete('q'); // Force-remove if category is present
        }

        // Debug log (remove after fixing)
        console.log('LISTINGS REQUEST:', `/api/listings?${params.toString()}`);
        console.log('hasCategory:', hasCategory, '| category:', category, '| aiFilters:', aiFilters?.category_slug, '| detected:', detectedCategory);

        const response = await fetch(`/api/listings?${params.toString()}`);
        const data = await response.json();

        setListings(data.data || []);
        setTotalCount(data.total || 0);
        setTotalPages(data.total_pages || 1);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchListings();
  }, [query, category, page, sortBy, aiInterpretation?.filters, advancedFilters]);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`/search?${params.toString()}`);
  };

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

        {/* AI Interpretation Banner */}
        {aiInterpretation && (
          <div className="mb-4 md:mb-6 p-3 md:p-4 bg-primary/5 border border-primary/20 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="p-1.5 md:p-2 bg-primary/10 rounded-lg flex-shrink-0">
                <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm md:text-base line-clamp-2">{aiInterpretation.interpretation}</p>
                <p className="text-xs md:text-sm text-muted-foreground mt-1">
                  AI confidence: {Math.round(aiInterpretation.confidence * 100)}%
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Quick Filter Chips */}
        <div className="flex flex-wrap gap-2 mb-4 md:mb-6">
          <QuickFilterChip
            label="New Trailers"
            isActive={advancedFilters.category === 'trailers' && (advancedFilters.conditions?.includes('new') || false)}
            onClick={() => {
              const isActive = advancedFilters.category === 'trailers' && advancedFilters.conditions?.includes('new');
              if (isActive) {
                setAdvancedFilters({});
              } else {
                setAdvancedFilters({ category: 'trailers', conditions: ['new'] });
              }
            }}
          />
          <QuickFilterChip
            label="Used Trailers"
            isActive={advancedFilters.category === 'trailers' && (advancedFilters.conditions?.includes('used') || false)}
            onClick={() => {
              const isActive = advancedFilters.category === 'trailers' && advancedFilters.conditions?.includes('used');
              if (isActive) {
                setAdvancedFilters({});
              } else {
                setAdvancedFilters({ category: 'trailers', conditions: ['used'] });
              }
            }}
          />
          <QuickFilterChip
            label="New Trucks"
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
            label="Heavy Equipment"
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
            <Filter className="w-12 h-12 md:w-16 md:h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg md:text-xl font-semibold mb-2">No listings found</h2>
            <p className="text-sm md:text-base text-muted-foreground mb-4">
              Try adjusting your search or filters
            </p>
            <Button asChild>
              <Link href="/search">View All Listings</Link>
            </Button>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4' : 'space-y-4'}>
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} viewMode={viewMode} />
            ))}
          </div>
        )}

        {/* Pagination - hide when in map view */}
        {totalPages > 1 && viewMode !== 'map' && (
          <div className="flex items-center justify-center gap-2 mt-6 md:mt-8">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => handlePageChange(page - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Previous</span>
            </Button>

            <span className="text-sm text-muted-foreground px-2 md:px-4">
              {page} / {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => handlePageChange(page + 1)}
            >
              <span className="hidden sm:inline mr-1">Next</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Calculate deal percentage based on AI price estimate
function getDealInfo(listing: Listing): { type: 'hot' | 'good' | null; percentage: number } | null {
  if (!listing.price || !listing.ai_price_estimate) return null;

  const ratio = listing.price / listing.ai_price_estimate;

  // 15%+ below market = Hot Deal
  if (ratio <= 0.85) {
    return { type: 'hot', percentage: Math.round((1 - ratio) * 100) };
  }
  // 5-15% below market = Good Deal
  if (ratio <= 0.95) {
    return { type: 'good', percentage: Math.round((1 - ratio) * 100) };
  }

  return null;
}

function ListingCard({ listing, viewMode }: { listing: Listing; viewMode: 'grid' | 'list' }) {
  const primaryImage = listing.images?.find((img) => img.is_primary) || listing.images?.[0];
  const dealInfo = getDealInfo(listing);

  if (viewMode === 'list') {
    return (
      <Link href={`/listing/${listing.id}`}>
        <Card className="flex flex-col sm:flex-row overflow-hidden hover:shadow-lg transition-shadow">
          <div className="relative w-full sm:w-48 md:w-64 h-48 sm:h-40 md:h-48 flex-shrink-0">
            {primaryImage ? (
              <Image
                src={primaryImage.thumbnail_url || primaryImage.url}
                alt={listing.title}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <span className="text-muted-foreground text-sm">No Image</span>
              </div>
            )}
            {listing.is_featured && (
              <Badge className="absolute top-2 left-2 bg-secondary text-secondary-foreground text-xs">
                Featured
              </Badge>
            )}
            {dealInfo && (
              <Badge
                className={`absolute top-2 ${listing.is_featured ? 'left-20' : 'left-2'} text-xs ${
                  dealInfo.type === 'hot'
                    ? 'bg-red-500 text-white'
                    : 'bg-green-500 text-white'
                }`}
              >
                {dealInfo.type === 'hot' ? <Flame className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                {dealInfo.percentage}% Below Market
              </Badge>
            )}
          </div>

          <div className="flex-1 p-3 md:p-4">
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-sm md:text-lg line-clamp-1">{listing.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-lg md:text-2xl font-bold text-primary">
                    {listing.price ? `$${listing.price.toLocaleString()}` : 'Call'}
                  </p>
                  {dealInfo && (
                    <span className="text-xs text-muted-foreground line-through">
                      ${listing.ai_price_estimate?.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <CompareButton
                  listing={{
                    id: listing.id,
                    title: listing.title,
                    price: listing.price ?? null,
                    year: listing.year ?? null,
                    make: listing.make ?? null,
                    model: listing.model ?? null,
                    mileage: listing.mileage ?? null,
                    hours: listing.hours ?? null,
                    condition: listing.condition ?? null,
                    image_url: primaryImage?.thumbnail_url || primaryImage?.url || null,
                  }}
                  variant="icon"
                />
                <Button variant="ghost" size="icon" className="flex-shrink-0">
                  <Heart className="w-4 h-4 md:w-5 md:h-5" />
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 md:gap-3 mt-2 md:mt-3 text-xs md:text-sm text-muted-foreground">
              {listing.year && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 md:w-4 md:h-4" />
                  {listing.year}
                </span>
              )}
              {listing.mileage && (
                <span className="flex items-center gap-1">
                  <Gauge className="w-3 h-3 md:w-4 md:h-4" />
                  {listing.mileage.toLocaleString()} mi
                </span>
              )}
              {(listing.city || listing.state) && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 md:w-4 md:h-4" />
                  {[listing.city, listing.state].filter(Boolean).join(', ')}
                </span>
              )}
            </div>

            {listing.description && (
              <p className="text-xs md:text-sm text-muted-foreground mt-2 line-clamp-2 hidden md:block">
                {listing.description}
              </p>
            )}
          </div>
        </Card>
      </Link>
    );
  }

  return (
    <Link href={`/listing/${listing.id}`}>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full">
        <div className="relative aspect-[4/3]">
          {primaryImage ? (
            <Image
              src={primaryImage.thumbnail_url || primaryImage.url}
              alt={listing.title}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <span className="text-muted-foreground text-xs md:text-sm">No Image</span>
            </div>
          )}
          {listing.is_featured && (
            <Badge className="absolute top-2 left-2 bg-secondary text-secondary-foreground text-xs">
              Featured
            </Badge>
          )}
          {dealInfo && (
            <Badge
              className={`absolute ${listing.is_featured ? 'top-8' : 'top-2'} left-2 text-[10px] md:text-xs ${
                dealInfo.type === 'hot'
                  ? 'bg-red-500 text-white'
                  : 'bg-green-500 text-white'
              }`}
            >
              {dealInfo.type === 'hot' ? <Flame className="w-2.5 h-2.5 md:w-3 md:h-3 mr-0.5" /> : <TrendingDown className="w-2.5 h-2.5 md:w-3 md:h-3 mr-0.5" />}
              {dealInfo.percentage}% Off
            </Badge>
          )}
          <div className="absolute top-2 right-2 flex gap-1">
            <CompareButton
              listing={{
                id: listing.id,
                title: listing.title,
                price: listing.price ?? null,
                year: listing.year ?? null,
                make: listing.make ?? null,
                model: listing.model ?? null,
                mileage: listing.mileage ?? null,
                hours: listing.hours ?? null,
                condition: listing.condition ?? null,
                image_url: primaryImage?.thumbnail_url || primaryImage?.url || null,
              }}
              variant="icon"
              className="bg-white/80 hover:bg-white w-7 h-7 md:w-8 md:h-8"
            />
            <Button
              variant="ghost"
              size="icon"
              className="bg-white/80 hover:bg-white w-7 h-7 md:w-8 md:h-8"
            >
              <Heart className="w-3 h-3 md:w-4 md:h-4" />
            </Button>
          </div>
        </div>

        <div className="p-2 md:p-4">
          <h3 className="font-semibold text-sm md:text-base line-clamp-1">{listing.title}</h3>
          <div className="flex items-center gap-1.5 mt-0.5 md:mt-1">
            <p className="text-base md:text-xl font-bold text-primary">
              {listing.price ? `$${listing.price.toLocaleString()}` : 'Call'}
            </p>
            {dealInfo && (
              <span className="text-[10px] md:text-xs text-muted-foreground line-through">
                ${listing.ai_price_estimate?.toLocaleString()}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1 md:gap-2 mt-1 md:mt-2 text-xs text-muted-foreground">
            {listing.year && <span>{listing.year}</span>}
            {listing.year && listing.mileage && <span>-</span>}
            {listing.mileage && <span>{listing.mileage.toLocaleString()} mi</span>}
          </div>

          {(listing.city || listing.state) && (
            <p className="text-xs text-muted-foreground mt-1 md:mt-2 flex items-center gap-1 line-clamp-1">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              {[listing.city, listing.state].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
      </Card>
    </Link>
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

function QuickFilterChip({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs md:text-sm rounded-full border transition-colors ${
        isActive
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-background hover:bg-muted border-border'
      }`}
    >
      {label}
    </button>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
      <SearchPageContent />
    </Suspense>
  );
}
