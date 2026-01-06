'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArrowLeft,
  Heart,
  Loader2,
  ImageIcon,
  MapPin,
  Trash2,
} from 'lucide-react';

interface SavedListing {
  listing_id: string;
  created_at: string;
  listing: {
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
    images: Array<{ id: string; url: string; is_primary: boolean }>;
  };
}

export default function SavedListingsPage() {
  const [favorites, setFavorites] = useState<SavedListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchFavorites = async () => {
      const response = await fetch('/api/favorites');
      if (response.ok) {
        const { data } = await response.json();
        setFavorites(data || []);
      }
      setIsLoading(false);
    };

    fetchFavorites();
  }, []);

  const handleRemove = async (listingId: string) => {
    setRemovingId(listingId);

    try {
      const response = await fetch(`/api/favorites?listing_id=${listingId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setFavorites((prev) => prev.filter((f) => f.listing_id !== listingId));
      }
    } catch (error) {
      console.error('Remove error:', error);
    } finally {
      setRemovingId(null);
    }
  };

  const getPrimaryImage = (images: Array<{ url: string; is_primary: boolean }>) => {
    const primary = images?.find((img) => img.is_primary);
    return primary?.url || images?.[0]?.url || null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-xl font-bold">Saved Listings</h1>
              <p className="text-sm text-muted-foreground">
                {favorites.length} saved item{favorites.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {favorites.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {favorites.map((fav) => {
              const listing = fav.listing;
              const imageUrl = getPrimaryImage(listing.images || []);

              return (
                <Card key={listing.id} className="overflow-hidden group">
                  <Link href={`/listing/${listing.id}`}>
                    <div className="relative aspect-[4/3] bg-muted">
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={listing.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-12 h-12 text-muted-foreground" />
                        </div>
                      )}
                      {listing.status !== 'active' && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <span className="bg-white text-black px-3 py-1 rounded-full text-sm font-medium">
                            {listing.status === 'sold' ? 'Sold' : 'Unavailable'}
                          </span>
                        </div>
                      )}
                    </div>
                  </Link>

                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <Link href={`/listing/${listing.id}`}>
                          <h3 className="font-semibold truncate hover:text-primary">
                            {listing.title}
                          </h3>
                        </Link>
                        <p className="text-lg font-bold text-primary mt-1">
                          {listing.price
                            ? `$${listing.price.toLocaleString()}`
                            : 'Call for Price'}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-muted-foreground">
                          {listing.year && <span>{listing.year}</span>}
                          {listing.make && <span>{listing.make}</span>}
                          {listing.model && <span>{listing.model}</span>}
                        </div>
                        {(listing.city || listing.state) && (
                          <p className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
                            <MapPin className="w-3 h-3" />
                            {[listing.city, listing.state].filter(Boolean).join(', ')}
                          </p>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="flex-shrink-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => handleRemove(listing.id)}
                        disabled={removingId === listing.id}
                      >
                        {removingId === listing.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No saved listings</h3>
              <p className="text-muted-foreground mb-6">
                Save listings you&apos;re interested in to view them later
              </p>
              <Button asChild>
                <Link href="/search">
                  Browse Listings
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
