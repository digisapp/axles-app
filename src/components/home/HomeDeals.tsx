'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Flame, TrendingDown } from 'lucide-react';

interface DealListing {
  id: string;
  title: string;
  price: number;
  ai_price_estimate: number;
  discount_percent: number;
  savings: number;
  year?: number;
  make?: string;
  model?: string;
  images?: { url: string; thumbnail_url?: string; is_primary?: boolean }[];
  category?: { name: string; slug: string };
}

export function HomeDeals() {
  const [deals, setDeals] = useState<DealListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    const fetchDeals = async () => {
      try {
        const response = await fetch('/api/deals?limit=4&min_discount=5&shuffle=true', {
          signal: controller.signal,
        });
        if (response.ok) {
          const data = await response.json();
          setDeals(data.data || []);
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Error fetching deals:', error);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchDeals();

    return () => controller.abort();
  }, []);

  if (!isLoading && deals.length === 0) return null;

  if (isLoading) {
    return (
      <div className="w-full max-w-4xl px-4 mb-8 md:mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            Hot Deals
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="overflow-hidden bg-white/90 dark:bg-zinc-900/90 backdrop-blur">
              <div className="aspect-[4/3] bg-muted animate-pulse" />
              <div className="p-2 md:p-3 space-y-2">
                <div className="h-4 bg-muted animate-pulse rounded" />
                <div className="h-5 w-20 bg-muted animate-pulse rounded" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl px-4 mb-8 md:mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-500" />
          Hot Deals
        </h2>
        <Link
          href="/deals"
          className="text-sm text-primary hover:underline"
        >
          View All &rarr;
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} />
        ))}
      </div>
    </div>
  );
}

function DealCard({ deal }: { deal: DealListing }) {
  const primaryImage = deal.images?.find((img) => img.is_primary) || deal.images?.[0];

  return (
    <Link href={`/listing/${deal.id}`}>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur">
        <div className="relative aspect-[4/3]">
          {primaryImage ? (
            <Image
              src={primaryImage.thumbnail_url || primaryImage.url}
              alt={deal.title}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <span className="text-muted-foreground text-xs">No Image</span>
            </div>
          )}
          <Badge className="absolute top-2 left-2 bg-red-500 text-white text-[10px] md:text-xs">
            <TrendingDown className="w-3 h-3 mr-1" />
            {deal.discount_percent}% Off
          </Badge>
        </div>
        <div className="p-2 md:p-3">
          <h3 className="font-semibold text-xs md:text-sm line-clamp-1">{deal.title}</h3>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-sm md:text-base font-bold text-primary">
              ${deal.price.toLocaleString()}
            </span>
            <span className="text-[10px] md:text-xs text-muted-foreground line-through">
              ${deal.ai_price_estimate.toLocaleString()}
            </span>
          </div>
          <p className="text-[10px] md:text-xs text-green-600 dark:text-green-400 mt-0.5">
            Save ${deal.savings.toLocaleString()}
          </p>
        </div>
      </Card>
    </Link>
  );
}
