'use client';

import { useCompare } from '@/context/CompareContext';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { X, Scale, ArrowRight } from 'lucide-react';

export function CompareBar() {
  const { listings, removeListing, clearAll } = useCompare();

  if (listings.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg z-50">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-primary" />
            <span className="font-medium">Compare ({listings.length}/4)</span>
          </div>

          <div className="flex-1 flex items-center gap-3 overflow-x-auto">
            {listings.map((listing) => (
              <div
                key={listing.id}
                className="flex items-center gap-2 bg-muted rounded-lg pl-2 pr-1 py-1 flex-shrink-0"
              >
                {listing.image_url && (
                  <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0">
                    <Image
                      src={listing.image_url}
                      alt={listing.title}
                      width={40}
                      height={40}
                      className="object-cover w-full h-full"
                      unoptimized
                    />
                  </div>
                )}
                <span className="text-sm font-medium truncate max-w-[120px]">
                  {listing.title}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0"
                  onClick={() => removeListing(listing.id)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="ghost" size="sm" onClick={clearAll}>
              Clear All
            </Button>
            <Link href="/compare">
              <Button size="sm" disabled={listings.length < 2}>
                Compare Now
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
