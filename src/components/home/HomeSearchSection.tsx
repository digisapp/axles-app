'use client';

import { useState } from 'react';
import Image from 'next/image';
import { AISearchBar } from '@/components/search/AISearchBar';
import { cn } from '@/lib/utils';

export function HomeSearchSection() {
  const [isTyping, setIsTyping] = useState(false);

  return (
    <>
      {/* Logo with glow effect */}
      <div className={cn(
        "mb-6 md:mb-8 transition-all duration-500",
        isTyping && "logo-glow scale-105"
      )}>
        <Image
          src="/images/axlonai-logo-eyes.png"
          alt="AxlonAI"
          width={200}
          height={80}
          priority
          className={cn(
            "dark:brightness-110 w-36 md:w-44 transition-all duration-500",
            isTyping && "brightness-110"
          )}
        />
      </div>

      {/* Search Bar */}
      <div className="w-full max-w-2xl mb-4 md:mb-5 px-2">
        <AISearchBar
          size="large"
          autoFocus
          animatedPlaceholder
          onTypingChange={setIsTyping}
          showLanguageHint
        />
      </div>
    </>
  );
}
