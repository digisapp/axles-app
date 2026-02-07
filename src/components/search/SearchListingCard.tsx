'use client';

import { memo } from 'react';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  MapPin,
  Calendar,
  Gauge,
  Heart,
  TrendingDown,
  Flame,
  Languages,
  ImageOff,
} from 'lucide-react';
import { CompareButton } from '@/components/listings/CompareButton';
import { ListingCardWrapper } from '@/components/listings/ListingCardWrapper';
import { getDealInfo } from '@/lib/deal-info';
import type { Listing } from '@/types';

interface SearchListingCardProps {
  listing: Listing;
  viewMode: 'grid' | 'list';
  translatedTitle?: string;
  translatedDescription?: string;
  isTranslated?: boolean;
}

export const SearchListingCard = memo(function SearchListingCard({
  listing,
  viewMode,
  translatedTitle,
  translatedDescription,
  isTranslated,
}: SearchListingCardProps) {
  const primaryImage = listing.images?.find((img) => img.is_primary) || listing.images?.[0];
  const dealInfo = getDealInfo(listing);
  const displayTitle = translatedTitle || listing.title;
  const displayDescription = translatedDescription || listing.description || '';

  if (viewMode === 'list') {
    return (
      <ListingCardWrapper listingId={listing.id} listingTitle={listing.title}>
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
              <div className="w-full h-full bg-muted flex flex-col items-center justify-center gap-2">
                <ImageOff className="w-8 h-8 text-muted-foreground/50" />
                <span className="text-muted-foreground text-xs">No Image</span>
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
                <div className="flex items-center gap-1.5">
                  <h3 className="font-semibold text-sm md:text-lg line-clamp-1">{displayTitle}</h3>
                  {isTranslated && (
                    <span title="Translated">
                      <Languages className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    </span>
                  )}
                </div>
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
                <Button variant="ghost" size="icon" className="flex-shrink-0" aria-label="Save to favorites">
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

            {displayDescription && (
              <p className="text-xs md:text-sm text-muted-foreground mt-2 line-clamp-2 hidden md:block">
                {displayDescription}
              </p>
            )}
          </div>
        </Card>
      </ListingCardWrapper>
    );
  }

  return (
    <ListingCardWrapper listingId={listing.id} listingTitle={listing.title}>
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
              <ImageOff className="w-6 h-6 md:w-8 md:h-8 text-muted-foreground/50" />
              <span className="text-muted-foreground text-[10px] md:text-xs">No Image</span>
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
              aria-label="Save to favorites"
            >
              <Heart className="w-3 h-3 md:w-4 md:h-4" />
            </Button>
          </div>
        </div>

        <div className="p-2 md:p-4">
          <div className="flex items-center gap-1">
            <h3 className="font-semibold text-sm md:text-base line-clamp-1">{displayTitle}</h3>
            {isTranslated && (
              <span title="Translated">
                <Languages className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              </span>
            )}
          </div>
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
    </ListingCardWrapper>
  );
});
