'use client';

import { Button } from '@/components/ui/button';
import { useCompare } from '@/context/CompareContext';
import { Scale, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CompareButtonProps {
  listing: {
    id: string;
    title: string;
    price: number | null;
    year: number | null;
    make: string | null;
    model: string | null;
    mileage: number | null;
    hours: number | null;
    condition: string | null;
    image_url?: string | null;
  };
  variant?: 'default' | 'icon';
  className?: string;
}

export function CompareButton({ listing, variant = 'default', className }: CompareButtonProps) {
  const { addListing, removeListing, isInCompare, canAddMore } = useCompare();

  const inCompare = isInCompare(listing.id);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (inCompare) {
      removeListing(listing.id);
    } else if (canAddMore) {
      addListing({
        id: listing.id,
        title: listing.title,
        price: listing.price,
        year: listing.year,
        make: listing.make,
        model: listing.model,
        mileage: listing.mileage,
        hours: listing.hours,
        condition: listing.condition,
        image_url: listing.image_url || null,
      });
    }
  };

  const getTitle = () => {
    if (inCompare) return 'Remove from compare';
    if (!canAddMore) return 'Compare list full (max 4 items)';
    return 'Add to compare';
  };

  if (variant === 'icon') {
    return (
      <Button
        variant={inCompare ? 'default' : 'outline'}
        size="icon"
        onClick={handleClick}
        disabled={!inCompare && !canAddMore}
        className={cn('h-8 w-8', className)}
        title={getTitle()}
      >
        {inCompare ? <Check className="w-4 h-4" /> : <Scale className="w-4 h-4" />}
      </Button>
    );
  }

  return (
    <Button
      variant={inCompare ? 'default' : 'outline'}
      size="sm"
      onClick={handleClick}
      disabled={!inCompare && !canAddMore}
      className={className}
      title={getTitle()}
    >
      {inCompare ? (
        <>
          <Check className="w-4 h-4 mr-2" />
          In Compare
        </>
      ) : (
        <>
          <Scale className="w-4 h-4 mr-2" />
          Compare
        </>
      )}
    </Button>
  );
}
