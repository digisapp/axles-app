'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Download, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(standalone);

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Check if dismissed recently
    const dismissed = localStorage.getItem('pwa-prompt-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed);
      // Don't show for 7 days after dismissal
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        return;
      }
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show after a short delay (let user browse first)
      setTimeout(() => setShowPrompt(true), 30000); // 30 seconds
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // For iOS, show manual instructions after delay
    if (iOS && !standalone) {
      setTimeout(() => setShowPrompt(true), 60000); // 1 minute
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
  };

  // Don't show if already installed or not showing
  if (isStandalone || !showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 animate-in slide-in-from-bottom-4">
      <div className="bg-card border rounded-xl shadow-lg p-4">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 hover:bg-muted rounded-full"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex gap-3">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">Install AxlesAI</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isIOS
                ? 'Tap the share button and "Add to Home Screen"'
                : 'Install the app for quick access and offline browsing'}
            </p>
          </div>
        </div>

        {!isIOS && deferredPrompt && (
          <div className="flex gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleDismiss}
            >
              Not Now
            </Button>
            <Button size="sm" className="flex-1" onClick={handleInstall}>
              <Download className="w-4 h-4 mr-1" />
              Install
            </Button>
          </div>
        )}

        {isIOS && (
          <div className="mt-3 p-2 bg-muted rounded-lg">
            <p className="text-xs text-center">
              Tap <span className="inline-block px-1">⎙</span> then &quot;Add to Home Screen&quot;
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Service worker registration
export function useServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // Register service worker
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration.scope);

        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000); // Every hour
      })
      .catch((error) => {
        console.error('SW registration failed:', error);
      });
  }, []);
}

// Combined provider component
export function PWAProvider({ children }: { children: React.ReactNode }) {
  useServiceWorker();

  return (
    <>
      {children}
      <PWAInstallPrompt />
    </>
  );
}
