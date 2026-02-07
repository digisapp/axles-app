'use client';

import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Truck } from 'lucide-react';
import { ListingCardWrapper } from './ListingCardWrapper';
import { useImageFallback } from '@/hooks/useImageFallback';

interface ManufacturerListing {
  id: string;
  title: string;
  price: number | null;
  year: number | null;
  make: string | null;
  model: string | null;
  city: string | null;
  state: string | null;
  condition: string | null;
  is_featured: boolean;
  images: { url: string; thumbnail_url?: string; is_primary?: boolean }[] | null;
}

interface ManufacturerListingGridProps {
  listings: ManufacturerListing[];
}

function ManufacturerCard({ listing }: { listing: ManufacturerListing }) {
  const primaryImage = listing.images?.find((img) => img.is_primary) || listing.images?.[0];
  const { hasError, handleError } = useImageFallback();

  return (
    <ListingCardWrapper listingId={listing.id} listingTitle={listing.title}>
      <Card className="h-full overflow-hidden hover:shadow-lg transition-all duration-300 hover:border-slate-300 cursor-pointer">
        {/* Image */}
        <div className="aspect-[4/3] relative bg-slate-100">
          {primaryImage && !hasError ? (
            <Image
              src={primaryImage.thumbnail_url || primaryImage.url}
              alt={listing.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              unoptimized
              onError={handleError}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Truck className="w-12 h-12 text-slate-300" />
            </div>
          )}
          {listing.is_featured && (
            <Badge className="absolute top-2 left-2 bg-amber-500">Featured</Badge>
          )}
          {listing.condition && (
            <Badge
              variant="secondary"
              className="absolute top-2 right-2 capitalize"
            >
              {listing.condition}
            </Badge>
          )}
        </div>

        <CardContent className="p-4">
          <h3 className="font-semibold text-slate-900 line-clamp-1 group-hover:text-blue-600 transition-colors">
            {listing.title}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {[listing.year, listing.make, listing.model].filter(Boolean).join(' ')}
          </p>
          <div className="flex items-center justify-between mt-3">
            <span className="text-lg font-bold text-slate-900">
              {listing.price ? `$${listing.price.toLocaleString()}` : 'Call for Price'}
            </span>
            {(listing.city || listing.state) && (
              <span className="text-xs text-slate-400">
                {[listing.city, listing.state].filter(Boolean).join(', ')}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </ListingCardWrapper>
  );
}

export function ManufacturerListingGrid({ listings }: ManufacturerListingGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {listings.map((listing) => (
        <ManufacturerCard key={listing.id} listing={listing} />
      ))}
    </div>
  );
}
