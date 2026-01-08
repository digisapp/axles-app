'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AISearchBar } from '@/components/search/AISearchBar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TrendingUp, Zap, ArrowRight, LayoutDashboard, Package, Settings, LogOut, RefreshCw, CalendarDays, Flame, TrendingDown, Calculator } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

interface UserProfile {
  id: string;
  email: string;
  company_name?: string;
  avatar_url?: string;
}

interface DealListing {
  id: string;
  title: string;
  price: number;
  ai_price_estimate: number;
  discount_percent: number;
  savings: number;
  year?: number;
  make?: string;
  model?: string;
  images?: { url: string; thumbnail_url?: string; is_primary?: boolean }[];
  category?: { name: string; slug: string };
}

export default function HomePage() {
  const [isTyping, setIsTyping] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deals, setDeals] = useState<DealListing[]>([]);

  useEffect(() => {
    const supabase = createClient();

    const fetchUser = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();

        if (authUser) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, email, company_name, avatar_url')
            .eq('id', authUser.id)
            .single();

          if (profile) {
            setUser(profile);
          }
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      }
      setIsLoading(false);
    };

    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchUser();
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch hot deals
  useEffect(() => {
    const fetchDeals = async () => {
      try {
        const response = await fetch('/api/deals?limit=4&min_discount=5');
        if (response.ok) {
          const data = await response.json();
          setDeals(data.data || []);
        }
      } catch (error) {
        console.error('Error fetching deals:', error);
      }
    };

    fetchDeals();
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <div className="min-h-screen flex flex-col gradient-bg relative overflow-hidden">
      {/* Subtle noise texture */}
      <div className="noise-overlay" />

      {/* Top Banner */}
      <div className="relative z-10 w-full bg-primary/10 border-b border-primary/20 py-2 px-4">
        <p className="text-center text-sm text-foreground/80">
          The <span className="font-semibold text-primary">AI-powered</span> marketplace for trucks, trailers & heavy equipment
        </p>
      </div>

      {/* Header */}
      <header className="relative z-10 w-full px-4 py-3 md:py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/images/axlesai-logo.png"
              alt="AxlesAI"
              width={28}
              height={28}
              className="w-7 h-7"
            />
            <span className="font-semibold text-sm">AxlesAI</span>
          </Link>
          <div className="flex gap-2 items-center">
            {isLoading ? (
              <div className="w-20 h-8" />
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback>
                        {(user.company_name || user.email)?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user.company_name || 'User'}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="flex items-center">
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/listings" className="flex items-center">
                      <Package className="w-4 h-4 mr-2" />
                      My Listings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/settings" className="flex items-center">
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="glass-button rounded-full">
                    Sign In
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm" className="rounded-full shadow-lg shadow-primary/25">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content - Google-style centered */}
      <main className="relative z-10 flex-1 flex flex-col items-center pt-8 md:pt-16 px-4">
        {/* Logo with glow effect - eyes version for light shine-through */}
        <div className={cn(
          "mb-6 md:mb-8 transition-all duration-500",
          isTyping && "logo-glow scale-105"
        )}>
          <Image
            src="/images/axlesai-logo-eyes.png"
            alt="AxlesAI"
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
          />
        </div>

        {/* Quick Search Chips */}
        <div className="flex flex-wrap justify-center gap-2 mb-8 md:mb-10 px-4">
          <Link
            href="/search?category=lowboy-trailers&sort=price"
            className="px-3 py-1.5 text-xs md:text-sm bg-white/80 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20 rounded-full border border-zinc-200 dark:border-zinc-700 transition-colors"
          >
            🔥 Lowboy Deals
          </Link>
          <Link
            href="/search?category=sleeper-trucks&sort=price"
            className="px-3 py-1.5 text-xs md:text-sm bg-white/80 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20 rounded-full border border-zinc-200 dark:border-zinc-700 transition-colors"
          >
            🚛 Sleeper Deals
          </Link>
          <Link
            href="/search?category=flatbed-trailers&sort=price"
            className="px-3 py-1.5 text-xs md:text-sm bg-white/80 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20 rounded-full border border-zinc-200 dark:border-zinc-700 transition-colors"
          >
            📦 Flatbed Deals
          </Link>
          <Link
            href="/deals"
            className="px-3 py-1.5 text-xs md:text-sm bg-white/80 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20 rounded-full border border-zinc-200 dark:border-zinc-700 transition-colors"
          >
            💰 View All Deals
          </Link>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 mb-10 md:mb-12 w-full sm:w-auto px-4">
          <Button
            size="lg"
            className="gap-2 w-full sm:w-auto rounded-full shadow-lg shadow-primary/20 group"
            asChild
          >
            <Link href="/search">
              <Zap className="w-4 h-4" />
              Browse Listings
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="gap-2 w-full sm:w-auto rounded-full glass-button !bg-white/80 dark:!bg-white/10"
            asChild
          >
            <Link href="/dashboard/listings/new">
              <TrendingUp className="w-4 h-4" />
              Sell Equipment
            </Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="gap-2 w-full sm:w-auto rounded-full glass-button !bg-white/80 dark:!bg-white/10"
            asChild
          >
            <Link href="/finance">
              <Calculator className="w-4 h-4" />
              Finance
            </Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="gap-2 w-full sm:w-auto rounded-full glass-button !bg-white/80 dark:!bg-white/10"
            asChild
          >
            <Link href="/trade-in">
              <RefreshCw className="w-4 h-4" />
              Trade-In
            </Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="gap-2 w-full sm:w-auto rounded-full glass-button !bg-white/80 dark:!bg-white/10"
            asChild
          >
            <Link href="/search?listing_type=rent">
              <CalendarDays className="w-4 h-4" />
              Rentals
            </Link>
          </Button>
        </div>

        {/* Hot Deals Section */}
        {deals.length > 0 && (
          <div className="w-full max-w-4xl px-4 mb-8 md:mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" />
                Hot Deals
              </h2>
              <Link
                href="/deals"
                className="text-sm text-primary hover:underline"
              >
                View All →
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {deals.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="relative z-10 py-8 md:py-10 px-4 border-t border-white/10 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Image
              src="/images/axlesai-logo.png"
              alt="AxlesAI"
              width={20}
              height={20}
              className="w-5 h-5"
            />
            <p className="text-xs md:text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} AxlesAI. All rights reserved.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-4 md:gap-6">
            <FooterLink href="/trade-in">Trade-In</FooterLink>
            <FooterLink href="/tools/axle-weight-calculator">Weight Calculator</FooterLink>
            <FooterLink href="/dealers">Dealers</FooterLink>
            <FooterLink href="/about">About</FooterLink>
            <FooterLink href="/privacy">Privacy</FooterLink>
            <FooterLink href="/terms">Terms</FooterLink>
            <FooterLink href="/contact">Contact</FooterLink>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      {children}
    </Link>
  );
}

function DealCard({ deal }: { deal: DealListing }) {
  const primaryImage = deal.images?.find((img) => img.is_primary) || deal.images?.[0];

  return (
    <Link href={`/listing/${deal.id}`}>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur">
        <div className="relative aspect-[4/3]">
          {primaryImage ? (
            <Image
              src={primaryImage.thumbnail_url || primaryImage.url}
              alt={deal.title}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <span className="text-muted-foreground text-xs">No Image</span>
            </div>
          )}
          <Badge className="absolute top-2 left-2 bg-red-500 text-white text-[10px] md:text-xs">
            <TrendingDown className="w-3 h-3 mr-1" />
            {deal.discount_percent}% Off
          </Badge>
        </div>
        <div className="p-2 md:p-3">
          <h3 className="font-semibold text-xs md:text-sm line-clamp-1">{deal.title}</h3>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-sm md:text-base font-bold text-primary">
              ${deal.price.toLocaleString()}
            </span>
            <span className="text-[10px] md:text-xs text-muted-foreground line-through">
              ${deal.ai_price_estimate.toLocaleString()}
            </span>
          </div>
          <p className="text-[10px] md:text-xs text-green-600 dark:text-green-400 mt-0.5">
            Save ${deal.savings.toLocaleString()}
          </p>
        </div>
      </Card>
    </Link>
  );
}
