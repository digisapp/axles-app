'use client';

import { ReactNode } from 'react';
import Link from 'next/link';

interface ListingCardWrapperProps {
  listingId: string;
  listingTitle: string;
  children: ReactNode;
  className?: string;
}

export function ListingCardWrapper({
  listingId,
  children,
  className,
}: ListingCardWrapperProps) {
  return (
    <Link href={`/listing/${listingId}`} className={className}>
      {children}
    </Link>
  );
}
