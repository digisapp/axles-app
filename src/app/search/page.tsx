'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { AISearchBar } from '@/components/search/AISearchBar';
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
  ArrowLeft,
  Grid3X3,
  List,
  MapPin,
  Calendar,
  Gauge,
  Sparkles,
  Filter,
  SlidersHorizontal,
  Heart,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { Listing, AISearchResult } from '@/types';

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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState('created_at');

  useEffect(() => {
    const fetchListings = async () => {
      setIsLoading(true);

      try {
        // If there's a natural language query, parse it with AI first
        if (query && !category) {
          const aiResponse = await fetch('/api/ai/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query }),
          });

          if (aiResponse.ok) {
            const { data } = await aiResponse.json();
            setAiInterpretation(data);
          }
        }

        // Build the API URL with filters
        const params = new URLSearchParams();
        params.set('page', page.toString());
        params.set('sort', sortBy);
        if (query) params.set('q', query);
        if (category) params.set('category', category);

        // Add AI-extracted filters if available
        if (aiInterpretation?.filters) {
          const f = aiInterpretation.filters;
          if (f.min_price) params.set('min_price', f.min_price.toString());
          if (f.max_price) params.set('max_price', f.max_price.toString());
          if (f.min_year) params.set('min_year', f.min_year.toString());
          if (f.max_year) params.set('max_year', f.max_year.toString());
          if (f.make) params.set('make', f.make);
          if (f.state) params.set('state', f.state);
          if (f.max_mileage) params.set('max_mileage', f.max_mileage.toString());
        }

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
  }, [query, category, page, sortBy, aiInterpretation?.filters]);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`/search?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/" className="flex-shrink-0">
            <Image
              src="/images/axlesai-logo.png"
              alt="AxlesAI"
              width={80}
              height={60}
              className="dark:brightness-110"
            />
          </Link>

          <div className="flex-1 max-w-2xl">
            <AISearchBar defaultValue={query} />
          </div>

          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Sign Up</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* AI Interpretation Banner */}
        {aiInterpretation && (
          <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{aiInterpretation.interpretation}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  AI confidence: {Math.round(aiInterpretation.confidence * 100)}%
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Results Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">
              {query ? `Results for "${query}"` : category ? `${category.replace(/-/g, ' ')}` : 'All Listings'}
            </h1>
            <p className="text-muted-foreground">
              {totalCount.toLocaleString()} listings found
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="gap-2">
              <SlidersHorizontal className="w-4 h-4" />
              Filters
            </Button>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40">
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

            <div className="flex border rounded-lg overflow-hidden">
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

        {/* Results Grid */}
        {isLoading ? (
          <div className={viewMode === 'grid' ? 'grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' : 'space-y-4'}>
            {[...Array(8)].map((_, i) => (
              <ListingCardSkeleton key={i} viewMode={viewMode} />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-16">
            <Filter className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No listings found</h2>
            <p className="text-muted-foreground mb-4">
              Try adjusting your search or filters
            </p>
            <Button asChild>
              <Link href="/search">View All Listings</Link>
            </Button>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' : 'space-y-4'}>
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} viewMode={viewMode} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => handlePageChange(page - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>

            <span className="text-sm text-muted-foreground px-4">
              Page {page} of {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => handlePageChange(page + 1)}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

function ListingCard({ listing, viewMode }: { listing: Listing; viewMode: 'grid' | 'list' }) {
  const primaryImage = listing.images?.find((img) => img.is_primary) || listing.images?.[0];

  if (viewMode === 'list') {
    return (
      <Link href={`/listing/${listing.id}`}>
        <Card className="flex overflow-hidden hover:shadow-lg transition-shadow">
          <div className="relative w-64 h-48 flex-shrink-0">
            {primaryImage ? (
              <Image
                src={primaryImage.thumbnail_url || primaryImage.url}
                alt={listing.title}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <span className="text-muted-foreground">No Image</span>
              </div>
            )}
            {listing.is_featured && (
              <Badge className="absolute top-2 left-2 bg-secondary text-secondary-foreground">
                Featured
              </Badge>
            )}
          </div>

          <div className="flex-1 p-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-lg line-clamp-1">{listing.title}</h3>
                <p className="text-2xl font-bold text-primary mt-1">
                  {listing.price ? `$${listing.price.toLocaleString()}` : 'Call for Price'}
                </p>
              </div>
              <Button variant="ghost" size="icon">
                <Heart className="w-5 h-5" />
              </Button>
            </div>

            <div className="flex flex-wrap gap-3 mt-3 text-sm text-muted-foreground">
              {listing.year && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {listing.year}
                </span>
              )}
              {listing.mileage && (
                <span className="flex items-center gap-1">
                  <Gauge className="w-4 h-4" />
                  {listing.mileage.toLocaleString()} mi
                </span>
              )}
              {(listing.city || listing.state) && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {[listing.city, listing.state].filter(Boolean).join(', ')}
                </span>
              )}
            </div>

            {listing.description && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
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
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <span className="text-muted-foreground">No Image</span>
            </div>
          )}
          {listing.is_featured && (
            <Badge className="absolute top-2 left-2 bg-secondary text-secondary-foreground">
              Featured
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 bg-white/80 hover:bg-white"
          >
            <Heart className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-4">
          <h3 className="font-semibold line-clamp-1">{listing.title}</h3>
          <p className="text-xl font-bold text-primary mt-1">
            {listing.price ? `$${listing.price.toLocaleString()}` : 'Call'}
          </p>

          <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
            {listing.year && <span>{listing.year}</span>}
            {listing.mileage && <span>{listing.mileage.toLocaleString()} mi</span>}
          </div>

          {(listing.city || listing.state) && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {[listing.city, listing.state].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
      </Card>
    </Link>
  );
}

function ListingCardSkeleton({ viewMode }: { viewMode: 'grid' | 'list' }) {
  if (viewMode === 'list') {
    return (
      <Card className="flex overflow-hidden">
        <Skeleton className="w-64 h-48" />
        <div className="flex-1 p-4 space-y-3">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <Skeleton className="aspect-[4/3] w-full" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </Card>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SearchPageContent />
    </Suspense>
  );
}
