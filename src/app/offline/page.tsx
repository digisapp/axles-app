'use client';

import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
          <WifiOff className="w-10 h-10 text-muted-foreground" />
        </div>

        <h1 className="text-2xl font-bold mb-2">You&apos;re Offline</h1>
        <p className="text-muted-foreground mb-6">
          It looks like you&apos;ve lost your internet connection.
          Some features may not be available until you&apos;re back online.
        </p>

        <div className="space-y-3">
          <Button
            onClick={() => window.location.reload()}
            className="w-full"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>

          <Button variant="outline" asChild className="w-full">
            <Link href="/">Go to Homepage</Link>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mt-8">
          Previously viewed listings may still be available in your browser cache.
        </p>
      </div>
    </div>
  );
}
