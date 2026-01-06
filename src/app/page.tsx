'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AISearchBar } from '@/components/search/AISearchBar';
import { Button } from '@/components/ui/button';
import { Truck, Container, HardHat, MapPin, TrendingUp, Shield, Zap, Sparkles, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function HomePage() {
  const [isTyping, setIsTyping] = useState(false);

  return (
    <div className="min-h-screen flex flex-col gradient-bg relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      {/* Noise texture */}
      <div className="noise-overlay" />

      {/* Header */}
      <header className="relative z-10 w-full px-4 py-3 md:py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm hidden sm:block">AxlesAI</span>
          </div>
          <div className="flex gap-2">
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
          </div>
        </div>
      </header>

      {/* Main Content - Google-style centered */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 -mt-16">
        {/* Logo with glow effect */}
        <div className={cn(
          "mb-6 md:mb-8 transition-all duration-500",
          isTyping && "logo-glow scale-105"
        )}>
          <Image
            src="/images/axlesai-logo.png"
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

        {/* Tagline */}
        <p className="text-base md:text-lg text-muted-foreground mb-8 md:mb-10 text-center max-w-lg px-4">
          The <span className="text-foreground font-medium">AI-powered</span> marketplace for trucks, trailers & heavy equipment
        </p>

        {/* Search Bar - Glass Effect */}
        <div className="w-full max-w-2xl mb-8 md:mb-10 px-2">
          <div className="search-glass rounded-2xl p-1">
            <AISearchBar
              size="large"
              autoFocus
              placeholder='Try "2020 Peterbilt 579 under $100k"'
              onTypingChange={setIsTyping}
              className="!bg-transparent !border-none !shadow-none"
            />
          </div>
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
      <section className="relative z-10 py-16 md:py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              Why Choose <span className="gradient-text">AxlesAI</span>?
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              The future of equipment marketplace is here
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 md:gap-6">
            <FeatureCard
              icon={<Zap className="w-5 h-5 md:w-6 md:h-6" />}
              title="AI-Powered Search"
              description="Describe what you need in plain English. Our AI instantly understands and finds matches."
            />
            <FeatureCard
              icon={<TrendingUp className="w-5 h-5 md:w-6 md:h-6" />}
              title="Smart Pricing"
              description="Get instant market value estimates powered by real-time data analysis."
            />
            <FeatureCard
              icon={<Shield className="w-5 h-5 md:w-6 md:h-6" />}
              title="Verified Listings"
              description="AI analyzes photos to verify condition and detect potential issues."
            />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative z-10 py-12 md:py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="glass-card rounded-3xl p-8 md:p-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <StatItem value="10K+" label="Listings" />
              <StatItem value="500+" label="Dealers" />
              <StatItem value="50" label="States" />
              <StatItem value="24/7" label="AI Support" />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-8 md:py-10 px-4 border-t border-white/10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <p className="text-xs md:text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} AxlesAI. All rights reserved.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-4 md:gap-6">
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
      className="pill-glass flex items-center gap-1.5 md:gap-2 px-4 md:px-5 py-2 md:py-2.5 rounded-full text-xs md:text-sm font-medium"
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
    <div className="feature-glass flex flex-col items-center text-center p-6 md:p-8 rounded-2xl md:rounded-3xl">
      <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4 md:mb-5">
        {icon}
      </div>
      <h3 className="font-semibold text-base md:text-lg mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl md:text-4xl font-bold gradient-text mb-1">{value}</p>
      <p className="text-xs md:text-sm text-muted-foreground">{label}</p>
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
