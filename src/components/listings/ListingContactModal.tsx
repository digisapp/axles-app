'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MessageSquare, Phone, ExternalLink } from 'lucide-react';

interface ListingContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listingId: string;
  listingTitle: string;
}

const AI_PHONE_NUMBER = '+14694213536';
const AI_PHONE_DISPLAY = '(469) 421-3536';

export function ListingContactModal({
  open,
  onOpenChange,
  listingId,
  listingTitle,
}: ListingContactModalProps) {
  const router = useRouter();

  const handleChat = () => {
    // Navigate to homepage with the listing context for AI chat
    router.push(`/?ask=${encodeURIComponent(`Tell me about listing ${listingTitle}`)}`);
    onOpenChange(false);
  };

  const handleCall = () => {
    window.location.href = `tel:${AI_PHONE_NUMBER}`;
    onOpenChange(false);
  };

  const handleViewDetails = () => {
    router.push(`/listing/${listingId}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Interested in this listing?</DialogTitle>
          <DialogDescription>
            Chat with our AI assistant or call us to learn more about this equipment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <Button
            className="w-full h-14 text-base gap-3"
            onClick={handleChat}
          >
            <MessageSquare className="w-5 h-5" />
            Chat with AI
          </Button>

          <Button
            variant="outline"
            className="w-full h-14 text-base gap-3"
            onClick={handleCall}
          >
            <Phone className="w-5 h-5" />
            Call AI: {AI_PHONE_DISPLAY}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <Button
            variant="ghost"
            className="w-full gap-2 text-muted-foreground"
            onClick={handleViewDetails}
          >
            <ExternalLink className="w-4 h-4" />
            View Full Details
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
