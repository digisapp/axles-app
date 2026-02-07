'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
  Flame,
  TrendingDown,
  MapPin,
  Calendar,
  Gauge,
  Heart,
  Grid3X3,
  List,
} from 'lucide-react';
import { CompareButton } from '@/components/listings/CompareButton';
import { ListingCardWrapper } from '@/components/listings/ListingCardWrapper';
import { useImageFallback } from '@/hooks/useImageFallback';
import { logger } from '@/lib/logger';

interface DealListing {
  id: string;
  title: string;
  price: number;
  ai_price_estimate: number;
  discount_percent: number;
  savings: number;
  year?: number;
  make?: string;
  model?: string;
  mileage?: number;
  city?: string;
  state?: string;
  condition?: string;
  images?: { url: string; thumbnail_url?: string; is_primary?: boolean }[];
  category?: { name: string; slug: string };
}

export default function DealsPage() {
  const [deals, setDeals] = useState<DealListing[]>([]);
  const [filteredDeals, setFilteredDeals] = useState<DealListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('discount');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        const response = await fetch('/api/deals?limit=100&min_discount=5');
        if (response.ok) {
          const data = await response.json();
          setDeals(data.data || []);
          setFilteredDeals(data.data || []);
        }
      } catch (error) {
        logger.error('Error fetching deals', { error });
      } finally {
        setIsLoading(false);
      }
    };

    fetchDeals();
  }, []);

  // Apply filters and sorting
  useEffect(() => {
    let result = [...deals];

    // Category filter
    if (categoryFilter !== 'all') {
      result = result.filter(deal => {
        const slug = deal.category?.slug || '';
        if (categoryFilter === 'trailers') {
          return slug.includes('trailer');
        } else if (categoryFilter === 'trucks') {
          return slug.includes('truck');
        } else if (categoryFilter === 'equipment') {
          return slug.includes('equipment');
        }
        return true;
      });
    }

    // Sorting
    if (sortBy === 'discount') {
      result.sort((a, b) => b.discount_percent - a.discount_percent);
    } else if (sortBy === 'price_low') {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price_high') {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'savings') {
      result.sort((a, b) => b.savings - a.savings);
    }

    setFilteredDeals(result);
  }, [deals, categoryFilter, sortBy]);

  // Get category counts
  const categoryCounts = {
    all: deals.length,
    trailers: deals.filter(d => d.category?.slug?.includes('trailer')).length,
    trucks: deals.filter(d => d.category?.slug?.includes('truck')).length,
    equipment: deals.filter(d => d.category?.slug?.includes('equipment')).length,
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6 md:py-8">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Flame className="w-8 h-8 text-orange-500" />
            <h1 className="text-2xl md:text-3xl font-bold">Deals</h1>
          </div>
          <p className="text-muted-foreground">
            Listings priced below market value based on similar equipment
          </p>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Category Filter Chips */}
          <div className="flex flex-wrap gap-2 flex-1">
            <FilterChip
              label={`All (${categoryCounts.all})`}
              isActive={categoryFilter === 'all'}
              onClick={() => setCategoryFilter('all')}
            />
            <FilterChip
              label={`Trailers (${categoryCounts.trailers})`}
              isActive={categoryFilter === 'trailers'}
              onClick={() => setCategoryFilter('trailers')}
            />
            <FilterChip
              label={`Trucks (${categoryCounts.trucks})`}
              isActive={categoryFilter === 'trucks'}
              onClick={() => setCategoryFilter('trucks')}
            />
            <FilterChip
              label={`Equipment (${categoryCounts.equipment})`}
              isActive={categoryFilter === 'equipment'}
              onClick={() => setCategoryFilter('equipment')}
            />
          </div>

          {/* Sort & View Controls */}
          <div className="flex items-center gap-2">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="discount">Biggest Discount</SelectItem>
                <SelectItem value="savings">Most Savings ($)</SelectItem>
                <SelectItem value="price_low">Price: Low to High</SelectItem>
                <SelectItem value="price_high">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>

            <div className="hidden sm:flex border rounded-lg overflow-hidden">
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
            </div>
          </div>
        </div>

        {/* Results Count */}
        <p className="text-sm text-muted-foreground mb-4">
          {filteredDeals.length} deals found
        </p>

        {/* Deals Grid */}
        {isLoading ? (
          <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4' : 'space-y-4'}>
            {[...Array(8)].map((_, i) => (
              <DealCardSkeleton key={i} viewMode={viewMode} />
            ))}
          </div>
        ) : filteredDeals.length === 0 ? (
          <div className="text-center py-12 md:py-16">
            <Flame className="w-12 h-12 md:w-16 md:h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg md:text-xl font-semibold mb-2">No deals found</h2>
            <p className="text-sm md:text-base text-muted-foreground mb-4">
              Try selecting a different category
            </p>
            <Button asChild>
              <Link href="/search">Browse All Listings</Link>
            </Button>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4' : 'space-y-4'}>
            {filteredDeals.map((deal) => (
              <DealCard key={deal.id} deal={deal} viewMode={viewMode} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterChip({
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

function DealCard({ deal, viewMode }: { deal: DealListing; viewMode: 'grid' | 'list' }) {
  const primaryImage = deal.images?.find((img) => img.is_primary) || deal.images?.[0];
  const { hasError, handleError } = useImageFallback();
  const isHotDeal = deal.discount_percent >= 15;

  if (viewMode === 'list') {
    return (
      <ListingCardWrapper listingId={deal.id} listingTitle={deal.title}>
        <Card className="flex flex-col sm:flex-row overflow-hidden hover:shadow-lg transition-shadow">
          <div className="relative w-full sm:w-48 md:w-64 h-48 sm:h-40 md:h-48 flex-shrink-0">
            {primaryImage && !hasError ? (
              <Image
                src={primaryImage.thumbnail_url || primaryImage.url}
                alt={deal.title}
                fill
                className="object-cover"
                unoptimized
                onError={handleError}
              />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <span className="text-muted-foreground text-sm">No Image</span>
              </div>
            )}
            <Badge
              className={`absolute top-2 left-2 text-xs ${
                isHotDeal ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
              }`}
            >
              {isHotDeal ? <Flame className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
              {deal.discount_percent}% Off
            </Badge>
          </div>

          <div className="flex-1 p-3 md:p-4">
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-sm md:text-lg line-clamp-1">{deal.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-lg md:text-2xl font-bold text-primary">
                    ${deal.price.toLocaleString()}
                  </p>
                  <span className="text-xs md:text-sm text-muted-foreground line-through">
                    ${deal.ai_price_estimate.toLocaleString()}
                  </span>
                </div>
                <p className="text-xs md:text-sm text-green-600 dark:text-green-400 mt-1">
                  Save ${deal.savings.toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <CompareButton
                  listing={{
                    id: deal.id,
                    title: deal.title,
                    price: deal.price,
                    year: deal.year ?? null,
                    make: deal.make ?? null,
                    model: deal.model ?? null,
                    mileage: deal.mileage ?? null,
                    hours: null,
                    condition: deal.condition ?? null,
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
              {deal.year && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 md:w-4 md:h-4" />
                  {deal.year}
                </span>
              )}
              {deal.mileage && (
                <span className="flex items-center gap-1">
                  <Gauge className="w-3 h-3 md:w-4 md:h-4" />
                  {deal.mileage.toLocaleString()} mi
                </span>
              )}
              {(deal.city || deal.state) && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 md:w-4 md:h-4" />
                  {[deal.city, deal.state].filter(Boolean).join(', ')}
                </span>
              )}
            </div>
          </div>
        </Card>
      </ListingCardWrapper>
    );
  }

  return (
    <ListingCardWrapper listingId={deal.id} listingTitle={deal.title}>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full">
        <div className="relative aspect-[4/3]">
          {primaryImage && !hasError ? (
            <Image
              src={primaryImage.thumbnail_url || primaryImage.url}
              alt={deal.title}
              fill
              className="object-cover"
              unoptimized
              onError={handleError}
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <span className="text-muted-foreground text-xs md:text-sm">No Image</span>
            </div>
          )}
          <Badge
            className={`absolute top-2 left-2 text-[10px] md:text-xs ${
              isHotDeal ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
            }`}
          >
            {isHotDeal ? <Flame className="w-2.5 h-2.5 md:w-3 md:h-3 mr-0.5" /> : <TrendingDown className="w-2.5 h-2.5 md:w-3 md:h-3 mr-0.5" />}
            {deal.discount_percent}% Off
          </Badge>
          <div className="absolute top-2 right-2 flex gap-1">
            <CompareButton
              listing={{
                id: deal.id,
                title: deal.title,
                price: deal.price,
                year: deal.year ?? null,
                make: deal.make ?? null,
                model: deal.model ?? null,
                mileage: deal.mileage ?? null,
                hours: null,
                condition: deal.condition ?? null,
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
          <h3 className="font-semibold text-sm md:text-base line-clamp-1">{deal.title}</h3>
          <div className="flex items-center gap-1.5 mt-0.5 md:mt-1">
            <p className="text-base md:text-xl font-bold text-primary">
              ${deal.price.toLocaleString()}
            </p>
            <span className="text-[10px] md:text-xs text-muted-foreground line-through">
              ${deal.ai_price_estimate.toLocaleString()}
            </span>
          </div>
          <p className="text-[10px] md:text-xs text-green-600 dark:text-green-400 mt-0.5">
            Save ${deal.savings.toLocaleString()}
          </p>

          <div className="flex flex-wrap gap-1 md:gap-2 mt-1 md:mt-2 text-xs text-muted-foreground">
            {deal.year && <span>{deal.year}</span>}
            {deal.year && deal.mileage && <span>-</span>}
            {deal.mileage && <span>{deal.mileage.toLocaleString()} mi</span>}
          </div>

          {(deal.city || deal.state) && (
            <p className="text-xs text-muted-foreground mt-1 md:mt-2 flex items-center gap-1 line-clamp-1">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              {[deal.city, deal.state].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
      </Card>
    </ListingCardWrapper>
  );
}

function DealCardSkeleton({ viewMode }: { viewMode: 'grid' | 'list' }) {
  if (viewMode === 'list') {
    return (
      <Card className="flex flex-col sm:flex-row overflow-hidden">
        <Skeleton className="w-full sm:w-48 md:w-64 h-48 sm:h-40 md:h-48" />
        <div className="flex-1 p-3 md:p-4 space-y-2 md:space-y-3">
          <Skeleton className="h-5 md:h-6 w-3/4" />
          <Skeleton className="h-6 md:h-8 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-full" />
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
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 md:h-4 w-1/2" />
      </div>
    </Card>
  );
}
