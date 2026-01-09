'use client';

import { useCompare } from '@/context/CompareContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Link from 'next/link';
import Image from 'next/image';
import { Scale, X, ArrowLeft, ExternalLink } from 'lucide-react';

export default function ComparePage() {
  const { listings, removeListing, clearAll } = useCompare();

  const specs = [
    { key: 'price', label: 'Price', format: (v: number | null) => v ? `$${v.toLocaleString()}` : 'Call' },
    { key: 'year', label: 'Year', format: (v: number | null) => v || '-' },
    { key: 'make', label: 'Make', format: (v: string | null) => v || '-' },
    { key: 'model', label: 'Model', format: (v: string | null) => v || '-' },
    { key: 'mileage', label: 'Mileage', format: (v: number | null) => v ? `${v.toLocaleString()} mi` : '-' },
    { key: 'hours', label: 'Hours', format: (v: number | null) => v ? `${v.toLocaleString()} hrs` : '-' },
    { key: 'condition', label: 'Condition', format: (v: string | null) => v ? v.charAt(0).toUpperCase() + v.slice(1) : '-' },
  ];

  if (listings.length === 0) {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="text-center py-16">
            <Scale className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">No Listings to Compare</h1>
            <p className="text-muted-foreground mb-6">
              Add listings to compare by clicking the compare button on listing cards.
            </p>
            <Link href="/search">
              <Button>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Browse Listings
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-background border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/search">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Scale className="w-5 h-5" />
                  Compare Listings
                </h1>
                <p className="text-sm text-muted-foreground">
                  {listings.length} listing{listings.length > 1 ? 's' : ''} selected
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={clearAll}>
              Clear All
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {listings.length < 2 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-4">
              Add at least 2 listings to compare them side by side.
            </p>
            <Link href="/search">
              <Button variant="outline">
                Add More Listings
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              {/* Listing Headers */}
              <thead>
                <tr>
                  <th className="w-40 p-4 text-left font-medium text-muted-foreground sticky left-0 bg-muted/30">

                  </th>
                  {listings.map((listing) => (
                    <th key={listing.id} className="p-4 min-w-[200px]">
                      <Card className="overflow-hidden">
                        <div className="relative">
                          {listing.image_url ? (
                            <div className="aspect-[4/3] relative">
                              <Image
                                src={listing.image_url}
                                alt={listing.title}
                                fill
                                className="object-cover"
                                unoptimized
                              />
                            </div>
                          ) : (
                            <div className="aspect-[4/3] bg-muted flex items-center justify-center">
                              <span className="text-muted-foreground text-sm">No Image</span>
                            </div>
                          )}
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2 h-7 w-7"
                            onClick={() => removeListing(listing.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="p-3">
                          <h3 className="font-semibold text-sm line-clamp-2 mb-2">
                            {listing.title}
                          </h3>
                          <Link href={`/listing/${listing.id}`} target="_blank">
                            <Button variant="outline" size="sm" className="w-full">
                              <ExternalLink className="w-3 h-3 mr-2" />
                              View Listing
                            </Button>
                          </Link>
                        </div>
                      </Card>
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Specs Rows */}
              <tbody>
                {specs.map((spec, index) => (
                  <tr key={spec.key} className={index % 2 === 0 ? 'bg-muted/30' : ''}>
                    <td className="p-4 font-medium text-muted-foreground sticky left-0 bg-inherit">
                      {spec.label}
                    </td>
                    {listings.map((listing) => {
                      const value = listing[spec.key as keyof typeof listing];
                      const formatted = spec.format(value as never);

                      // Highlight best price (lowest)
                      let isBest = false;
                      if (spec.key === 'price' && listing.price) {
                        const prices = listings.map(l => l.price).filter(Boolean) as number[];
                        isBest = listing.price === Math.min(...prices);
                      }

                      return (
                        <td
                          key={listing.id}
                          className={`p-4 text-center ${isBest ? 'text-green-600 font-semibold' : ''}`}
                        >
                          {formatted}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add More */}
        {listings.length < 4 && listings.length >= 2 && (
          <div className="mt-8 text-center">
            <Link href="/search">
              <Button variant="outline">
                Add More Listings ({4 - listings.length} slots available)
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
