'use client';

import { useState, ReactNode } from 'react';
import { ListingContactModal } from './ListingContactModal';

interface ListingCardWrapperProps {
  listingId: string;
  listingTitle: string;
  children: ReactNode;
  className?: string;
}

export function ListingCardWrapper({
  listingId,
  listingTitle,
  children,
  className,
}: ListingCardWrapperProps) {
  const [showModal, setShowModal] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowModal(true);
  };

  return (
    <>
      <div onClick={handleClick} className={className} style={{ cursor: 'pointer' }}>
        {children}
      </div>
      <ListingContactModal
        open={showModal}
        onOpenChange={setShowModal}
        listingId={listingId}
        listingTitle={listingTitle}
      />
    </>
  );
}
