import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Zap, ArrowRight, RefreshCw, CalendarDays, Calculator, Truck, Store } from 'lucide-react';
import { HomeHeader } from '@/components/home/HomeHeader';
import { HomeSearchSection } from '@/components/home/HomeSearchSection';
import { HomeDeals } from '@/components/home/HomeDeals';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col gradient-bg relative overflow-hidden">
      {/* Subtle noise texture */}
      <div className="noise-overlay" />

      {/* Top Banner - SSR for SEO */}
      <div className="relative z-10 w-full bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-b border-primary/20 py-2.5 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent)] animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
        <div className="relative flex items-center justify-center gap-2">
          <div className="hidden sm:flex items-center justify-center w-5 h-5 rounded-full bg-primary/20">
            <Zap className="w-3 h-3 text-primary" />
          </div>
          <p className="text-center text-sm text-foreground/90">
            The <span className="font-semibold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">AI-powered</span> marketplace for trucks, trailers & equipment
          </p>
        </div>
      </div>

      {/* Header - SSR shell + client auth */}
      <header className="relative z-10 w-full px-4 py-3 md:py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/images/axlonai-logo.png"
              alt="AxlonAI"
              width={28}
              height={28}
              className="w-7 h-7"
            />
            <span className="font-semibold text-sm">AxlonAI</span>
          </Link>
          <HomeHeader />
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center pt-8 md:pt-16 px-4">
        {/* Client: Logo animation + Search Bar */}
        <HomeSearchSection />

        {/* Quick Search Chips - SSR for SEO crawlability */}
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
            href="/new-trailers"
            className="px-3 py-1.5 text-xs md:text-sm bg-white/80 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20 rounded-full border border-zinc-200 dark:border-zinc-700 transition-colors"
          >
            🏭 New Trailers
          </Link>
          <Link
            href="/deals"
            className="px-3 py-1.5 text-xs md:text-sm bg-white/80 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20 rounded-full border border-zinc-200 dark:border-zinc-700 transition-colors"
          >
            💰 View All Deals
          </Link>
        </div>

        {/* Action Buttons - SSR for SEO */}
        <div className="flex flex-wrap justify-center gap-3 md:gap-4 mb-10 md:mb-12 w-full sm:w-auto px-4">
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
            <Link href="/new-trailers">
              <Truck className="w-4 h-4" />
              New Trailers
            </Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="gap-2 w-full sm:w-auto rounded-full glass-button !bg-white/80 dark:!bg-white/10"
            asChild
          >
            <Link href="/dealers">
              <Store className="w-4 h-4" />
              Dealers
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

        {/* Client: Hot Deals Section */}
        <HomeDeals />

        {/* SEO: Hidden crawlable content for search engines */}
        <section className="sr-only" aria-label="About AxlonAI">
          <h1>AxlonAI - AI-Powered Truck & Equipment Marketplace</h1>
          <p>
            Find and buy trucks, trailers, and heavy equipment with AI-powered search.
            Browse lowboy trailers, semi trucks, flatbed trailers, sleeper trucks, dump trucks,
            and more from dealers and private sellers across the United States.
          </p>
          <h2>Popular Categories</h2>
          <ul>
            <li><Link href="/search?category=lowboy-trailers">Lowboy Trailers</Link></li>
            <li><Link href="/search?category=sleeper-trucks">Sleeper Trucks</Link></li>
            <li><Link href="/search?category=flatbed-trailers">Flatbed Trailers</Link></li>
            <li><Link href="/search?category=day-cab-trucks">Day Cab Trucks</Link></li>
            <li><Link href="/search?category=heavy-equipment">Heavy Equipment</Link></li>
            <li><Link href="/categories">All Categories</Link></li>
          </ul>
          <h2>Services</h2>
          <ul>
            <li><Link href="/finance">Commercial Truck & Trailer Financing</Link></li>
            <li><Link href="/trade-in">Trade-In Your Equipment</Link></li>
            <li><Link href="/new-trailers">New Trailer Catalog</Link></li>
            <li><Link href="/deals">Below Market Deals</Link></li>
          </ul>
        </section>
      </main>

      {/* Footer - SSR for SEO crawlability */}
      <footer className="relative z-10 py-8 md:py-10 px-4 border-t border-white/10 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Image
              src="/images/axlonai-logo.png"
              alt="AxlonAI"
              width={20}
              height={20}
              className="w-5 h-5"
            />
            <p className="text-xs md:text-sm text-muted-foreground">
              &copy; 2025 AxlonAI. All rights reserved.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-4 md:gap-6">
            <FooterLink href="/trade-in">Trade-In</FooterLink>
            <FooterLink href="/tools/axle-weight-calculator">Weight Calculator</FooterLink>
            <FooterLink href="/become-a-dealer">Dealer Login</FooterLink>
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
