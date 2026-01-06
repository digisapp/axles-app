import Image from 'next/image';
import Link from 'next/link';
import { AISearchBar } from '@/components/search/AISearchBar';
import { Button } from '@/components/ui/button';
import { Truck, Container, HardHat, MapPin, TrendingUp, Shield, Zap } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="w-full px-4 py-3 md:py-4 flex justify-end gap-2">
        <Link href="/login">
          <Button variant="ghost" size="sm">
            Sign In
          </Button>
        </Link>
        <Link href="/signup">
          <Button size="sm">Sign Up</Button>
        </Link>
      </header>

      {/* Main Content - Google-style centered */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 -mt-8 md:-mt-20">
        {/* Logo */}
        <div className="mb-4 md:mb-8">
          <Image
            src="/images/axlesai-logo.png"
            alt="AxlesAI"
            width={280}
            height={200}
            priority
            className="dark:brightness-110 w-48 md:w-auto"
          />
        </div>

        {/* Tagline */}
        <p className="text-base md:text-lg text-muted-foreground mb-6 md:mb-8 text-center max-w-md px-4">
          The AI-powered marketplace for trucks, trailers & heavy equipment
        </p>

        {/* Search Bar */}
        <div className="w-full max-w-2xl mb-6 md:mb-8 px-2">
          <AISearchBar size="large" autoFocus placeholder='Try "2020 Peterbilt 579 under $100k"' />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 mb-8 md:mb-12 w-full sm:w-auto px-4">
          <Button variant="secondary" size="lg" className="gap-2 w-full sm:w-auto" asChild>
            <Link href="/search">
              <Zap className="w-4 h-4" />
              Browse All Listings
            </Link>
          </Button>
          <Button variant="outline" size="lg" className="gap-2 w-full sm:w-auto" asChild>
            <Link href="/dashboard/listings/new">
              <TrendingUp className="w-4 h-4" />
              Sell Your Equipment
            </Link>
          </Button>
        </div>

        {/* Quick Category Links */}
        <div className="flex flex-wrap justify-center gap-2 md:gap-3 max-w-2xl px-4">
          <CategoryPill
            href="/search?category=heavy-duty-trucks"
            icon={<Truck className="w-4 h-4" />}
            label="Heavy Duty"
          />
          <CategoryPill
            href="/search?category=trailers"
            icon={<Container className="w-4 h-4" />}
            label="Trailers"
          />
          <CategoryPill
            href="/search?category=heavy-equipment"
            icon={<HardHat className="w-4 h-4" />}
            label="Equipment"
          />
          <CategoryPill
            href="/search?location=near"
            icon={<MapPin className="w-4 h-4" />}
            label="Near Me"
          />
        </div>
      </main>

      {/* Features Section */}
      <section className="py-12 md:py-16 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-xl md:text-2xl font-bold text-center mb-8 md:mb-12">
            Why Choose <span className="gradient-text">AxlesAI</span>?
          </h2>

          <div className="grid md:grid-cols-3 gap-4 md:gap-8">
            <FeatureCard
              icon={<Zap className="w-5 h-5 md:w-6 md:h-6" />}
              title="AI-Powered Search"
              description="Just describe what you're looking for in plain English. Our AI understands your needs."
            />
            <FeatureCard
              icon={<TrendingUp className="w-5 h-5 md:w-6 md:h-6" />}
              title="Smart Pricing"
              description="Get instant AI-powered price estimates based on market data and equipment specs."
            />
            <FeatureCard
              icon={<Shield className="w-5 h-5 md:w-6 md:h-6" />}
              title="Verified Listings"
              description="AI analyzes photos to verify equipment condition and detect potential issues."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 md:py-8 px-4 border-t">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs md:text-sm text-muted-foreground text-center md:text-left">
            &copy; {new Date().getFullYear()} AxlesAI. All rights reserved.
          </p>
          <div className="flex flex-wrap justify-center gap-4 md:gap-6">
            <Link
              href="/about"
              className="text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              About
            </Link>
            <Link
              href="/privacy"
              className="text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Terms
            </Link>
            <Link
              href="/contact"
              className="text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function CategoryPill({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-white dark:bg-card border border-border rounded-full text-xs md:text-sm hover:bg-muted hover:border-primary/30 transition-all"
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center text-center p-4 md:p-6 bg-white dark:bg-card rounded-xl md:rounded-2xl border border-border">
      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3 md:mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-sm md:text-base mb-1 md:mb-2">{title}</h3>
      <p className="text-xs md:text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
