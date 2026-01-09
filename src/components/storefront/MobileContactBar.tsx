'use client';

import { Phone, Mail, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MobileContactBarProps {
  phone?: string | null;
  email?: string | null;
  dealerName: string;
}

export function MobileContactBar({ phone, email, dealerName }: MobileContactBarProps) {
  if (!phone && !email) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden">
      {/* Gradient fade */}
      <div className="h-6 bg-gradient-to-t from-white to-transparent" />

      {/* Contact Bar */}
      <div className="bg-white border-t border-slate-200 px-4 py-3 flex gap-2 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        {phone && (
          <Button size="lg" className="flex-1 gap-2 shadow-md" asChild>
            <a href={`tel:${phone}`}>
              <Phone className="w-5 h-5" />
              Call Now
            </a>
          </Button>
        )}
        {email && (
          <Button size="lg" variant="outline" className="flex-1 gap-2" asChild>
            <a href={`mailto:${email}?subject=Inquiry from AxlesAI - ${dealerName}`}>
              <Mail className="w-5 h-5" />
              Email
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
