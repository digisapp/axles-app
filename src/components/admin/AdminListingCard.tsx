'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, ImageIcon, ExternalLink } from 'lucide-react';
import { useImageFallback } from '@/hooks/useImageFallback';

interface AdminListingCardProps {
  listing: {
    id: string;
    title: string;
    price: number | null;
    status: string;
    views_count: number | null;
    created_at: string;
  };
  imageUrl: string | null;
  sellerName: string;
  statusBadge: React.ReactNode;
}

export function AdminListingCard({ listing, imageUrl, sellerName, statusBadge }: AdminListingCardProps) {
  const { hasError, handleError } = useImageFallback();

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Image */}
          <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
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
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold">{listing.title}</h3>
                <p className="text-lg font-bold text-primary">
                  {listing.price
                    ? `$${listing.price.toLocaleString()}`
                    : 'No price'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  by {sellerName}
                </p>
              </div>

              <div className="flex flex-col items-end gap-2">
                {statusBadge}
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Eye className="w-4 h-4" />
                  {listing.views_count || 0}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/listing/${listing.id}`} target="_blank">
                  <ExternalLink className="w-4 h-4 mr-1" />
                  View
                </Link>
              </Button>
              <span className="text-xs text-muted-foreground">
                Created {new Date(listing.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
