'use client';

import { Phone } from 'lucide-react';
import { useState } from 'react';

const PHONE_NUMBER = '+14694213536';
const DISPLAY_NUMBER = '(469) 421-3536';

export function FloatingCallButton() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <a
      href={`tel:${PHONE_NUMBER}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group"
      aria-label="Call Sal AI Assistant"
    >
      {/* Expanded state with number */}
      <div
        className={`overflow-hidden transition-all duration-300 ${
          isHovered ? 'max-w-[200px] pl-4' : 'max-w-0 pl-0'
        }`}
      >
        <div className="whitespace-nowrap">
          <p className="text-xs font-medium opacity-90">Talk to Sal</p>
          <p className="text-sm font-bold">{DISPLAY_NUMBER}</p>
        </div>
      </div>

      {/* Phone icon button */}
      <div className="p-4 flex items-center justify-center">
        <Phone className="w-6 h-6" />
      </div>

      {/* Pulse animation ring */}
      <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-20 pointer-events-none" />
    </a>
  );
}
