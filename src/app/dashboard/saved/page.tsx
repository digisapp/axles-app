import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, MapPin, ImageOff, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Saved Listings | AxlonAI',
  description: 'View your saved trucks, trailers, and equipment listings.',
};

export default async function SavedListingsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/dashboard/saved');
  }

  // Get saved listing IDs
  const { data: favorites } = await supabase
    .from('favorites')
    .select('listing_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const listingIds = (favorites || []).map((f) => f.listing_id);

  // Fetch full listing data
  let savedListings: Array<{
    id: string;
    title: string;
    price: number | null;
    year: number | null;
    make: string | null;
    model: string | null;
    city: string | null;
    state: string | null;
    status: string;
    images: Array<{ url: string; thumbnail_url?: string; is_primary?: boolean }>;
  }> = [];

  if (listingIds.length > 0) {
    const { data: listings } = await supabase
      .from('listings')
      .select(`
        id, title, price, year, make, model, city, state, status,
        images:listing_images (url, thumbnail_url, is_primary)
      `)
      .in('id', listingIds);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    savedListings = (listings as any) || [];
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Saved Listings</h1>
          <p className="text-muted-foreground">
            {savedListings.length} saved listing{savedListings.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/search">Browse More</Link>
        </Button>
      </div>

      {savedListings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Heart className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-2">No saved listings yet</h2>
            <p className="text-muted-foreground text-center max-w-sm mb-6">
              Save listings you&apos;re interested in to keep track of them here.
            </p>
            <Button asChild>
              <Link href="/search">
                <Sparkles className="w-4 h-4 mr-2" />
                Browse Listings
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {savedListings.map((listing) => {
            const primaryImage = listing.images?.find((img) => img.is_primary) || listing.images?.[0];

            return (
              <Link key={listing.id} href={`/listing/${listing.id}`}>
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
                      <div className="w-full h-full bg-muted flex flex-col items-center justify-center gap-1">
                        <ImageOff className="w-8 h-8 text-muted-foreground/50" />
                        <span className="text-muted-foreground text-xs">No Image</span>
                      </div>
                    )}
                    {listing.status === 'sold' && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white font-bold text-lg">SOLD</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="font-semibold text-sm line-clamp-1">{listing.title}</h3>
                    <p className="text-lg font-bold text-primary mt-1">
                      {listing.price ? `$${listing.price.toLocaleString()}` : 'Call'}
                    </p>
                    {(listing.city || listing.state) && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {[listing.city, listing.state].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
