'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, Edit, ImageIcon } from 'lucide-react';
import { useImageFallback } from '@/hooks/useImageFallback';

interface DashboardListingCardProps {
  listing: {
    id: string;
    title: string;
    price: number | null;
    status: string;
    views_count: number | null;
    created_at: string;
  };
  imageUrl: string | null;
  statusBadgeClass: string;
}

export function DashboardListingCard({ listing, imageUrl, statusBadgeClass }: DashboardListingCardProps) {
  const { hasError, handleError } = useImageFallback();

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col md:flex-row">
        {/* Image */}
        <div className="relative w-full md:w-48 h-48 md:h-32 bg-muted flex-shrink-0">
          {imageUrl && !hasError ? (
            <Image
              src={imageUrl}
              alt={listing.title}
              fill
              className="object-cover"
              unoptimized
              onError={handleError}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold">{listing.title}</h3>
              <span
                className={`px-2 py-0.5 text-xs rounded-full ${statusBadgeClass}`}
              >
                {listing.status}
              </span>
            </div>
            <p className="text-lg font-bold text-primary">
              {listing.price
                ? `$${listing.price.toLocaleString()}`
                : 'No price set'}
            </p>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                {listing.views_count || 0} views
              </span>
              <span>
                Created {new Date(listing.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/listing/${listing.id}`} target="_blank">
                <Eye className="w-4 h-4 mr-2" />
                View
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href={`/dashboard/listings/${listing.id}/edit`}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
