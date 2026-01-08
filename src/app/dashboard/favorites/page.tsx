'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Heart,
  MapPin,
  Calendar,
  Gauge,
  ExternalLink,
  Trash2,
  Package,
} from 'lucide-react';
import { toast } from 'sonner';

interface FavoriteListing {
  id: string;
  title: string;
  price: number | null;
  price_type: string;
  condition: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  city: string | null;
  state: string | null;
  status: string;
  views_count: number;
  created_at: string;
  mileage?: number | null;
  images: { id: string; url: string; is_primary: boolean }[];
}

interface Favorite {
  listing_id: string;
  created_at: string;
  listing: FavoriteListing;
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    try {
      const response = await fetch('/api/favorites');
      if (response.ok) {
        const { data } = await response.json();
        setFavorites(data || []);
      }
    } catch (error) {
      console.error('Error fetching favorites:', error);
      toast.error('Failed to load favorites');
    } finally {
      setIsLoading(false);
    }
  };

  const removeFavorite = async (listingId: string) => {
    setRemovingId(listingId);
    try {
      const response = await fetch(`/api/favorites?listing_id=${listingId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setFavorites(favorites.filter((f) => f.listing_id !== listingId));
        toast.success('Removed from favorites');
      } else {
        throw new Error('Failed to remove');
      }
    } catch (error) {
      console.error('Error removing favorite:', error);
      toast.error('Failed to remove from favorites');
    } finally {
      setRemovingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Saved Listings</h1>
          <p className="text-muted-foreground mt-1">
            Your favorite trucks and equipment
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <Skeleton className="aspect-[4/3] w-full" />
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Heart className="w-7 h-7 text-red-500" />
            Saved Listings
          </h1>
          <p className="text-muted-foreground mt-1">
            {favorites.length} {favorites.length === 1 ? 'listing' : 'listings'} saved
          </p>
        </div>
      </div>

      {favorites.length === 0 ? (
        <Card>
          <CardContent className="py-16">
            <div className="text-center">
              <Heart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No saved listings yet</h3>
              <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                When you find trucks or equipment you like, click the heart icon to save them here for easy access.
              </p>
              <Button asChild>
                <Link href="/search">
                  Browse Listings
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {favorites.map((favorite) => {
            const listing = favorite.listing;
            const primaryImage = listing.images?.find((img) => img.is_primary) || listing.images?.[0];

            return (
              <Card key={favorite.listing_id} className="overflow-hidden group">
                <div className="relative aspect-[4/3] bg-muted">
                  {primaryImage ? (
                    <Image
                      src={primaryImage.url}
                      alt={listing.title}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-12 h-12 text-muted-foreground" />
                    </div>
                  )}

                  {/* Status Badge */}
                  {listing.status !== 'active' && (
                    <Badge
                      variant="secondary"
                      className="absolute top-2 left-2 bg-yellow-100 text-yellow-800"
                    >
                      {listing.status === 'sold' ? 'Sold' : listing.status}
                    </Badge>
                  )}

                  {/* Remove Button */}
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeFavorite(favorite.listing_id)}
                    disabled={removingId === favorite.listing_id}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>

                <CardContent className="p-4">
                  <Link href={`/listing/${listing.id}`} className="hover:underline">
                    <h3 className="font-semibold line-clamp-2">{listing.title}</h3>
                  </Link>

                  <p className="text-xl font-bold text-primary mt-1">
                    {listing.price
                      ? `$${listing.price.toLocaleString()}`
                      : listing.price_type === 'call'
                      ? 'Call for Price'
                      : 'Contact Seller'}
                  </p>

                  <div className="flex flex-wrap gap-2 mt-2 text-sm text-muted-foreground">
                    {listing.year && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {listing.year}
                      </span>
                    )}
                    {listing.mileage && (
                      <span className="flex items-center gap-1">
                        <Gauge className="w-3 h-3" />
                        {listing.mileage.toLocaleString()} mi
                      </span>
                    )}
                    {(listing.city || listing.state) && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {[listing.city, listing.state].filter(Boolean).join(', ')}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <span className="text-xs text-muted-foreground">
                      Saved {new Date(favorite.created_at).toLocaleDateString()}
                    </span>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/listing/${listing.id}`}>
                        View Details
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
