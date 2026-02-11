'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Truck } from 'lucide-react';
import { useImageFallback } from '@/hooks/useImageFallback';
import type { ManufacturerProduct } from '@/types';

interface ProductCardProps {
  product: ManufacturerProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  const primaryImage = product.images?.find((img) => img.is_primary) || product.images?.[0];
  const { hasError, handleError } = useImageFallback();

  const tonnageLabel = product.tonnage_min && product.tonnage_max && product.tonnage_min !== product.tonnage_max
    ? `${product.tonnage_min}-${product.tonnage_max} Ton`
    : product.tonnage_max
      ? `${product.tonnage_max} Ton`
      : null;

  const gooseneckLabel = product.gooseneck_type
    ? product.gooseneck_type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : null;

  return (
    <Link href={`/new-trailers/${product.manufacturer?.slug}/${product.slug}`}>
      <Card className="h-full overflow-hidden hover:shadow-lg transition-all duration-300 hover:border-primary/30 group cursor-pointer">
        <div className="aspect-[4/3] relative bg-muted">
          {primaryImage && !hasError ? (
            <Image
              src={primaryImage.url}
              alt={primaryImage.alt_text || product.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              unoptimized
              onError={handleError}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Truck className="w-12 h-12 text-muted-foreground/30" />
            </div>
          )}
          {product.manufacturer?.name && (
            <Badge variant="secondary" className="absolute top-2 left-2 bg-background/90 backdrop-blur-sm text-xs">
              {product.manufacturer.name}
            </Badge>
          )}
        </div>

        <CardContent className="p-4">
          <h3 className="font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
            {product.name}
          </h3>
          {product.series && (
            <p className="text-sm text-muted-foreground mt-0.5">{product.series} Series</p>
          )}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {tonnageLabel && (
              <Badge variant="outline" className="text-xs font-normal">{tonnageLabel}</Badge>
            )}
            {product.deck_height_inches && (
              <Badge variant="outline" className="text-xs font-normal">{product.deck_height_inches}&quot; Deck</Badge>
            )}
            {product.axle_count && (
              <Badge variant="outline" className="text-xs font-normal">{product.axle_count} Axle</Badge>
            )}
          </div>
          {gooseneckLabel && (
            <p className="text-xs text-muted-foreground mt-2">{gooseneckLabel} Gooseneck</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
