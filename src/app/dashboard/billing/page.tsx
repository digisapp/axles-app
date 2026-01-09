import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Check,
  X,
  Star,
  Zap,
  Building2,
  Mail,
  Phone,
  Package,
  Bot,
  BarChart3,
  Crown,
} from 'lucide-react';
import Link from 'next/link';

// Plan limits
const PLAN_LIMITS = {
  free: {
    listings: 5,
    aiPriceEstimates: 5,
    featuredListings: 0,
    aiAssistant: false,
    advancedAnalytics: false,
    customStorefront: false,
  },
  pro: {
    listings: -1, // unlimited
    aiPriceEstimates: -1,
    featuredListings: 3,
    aiAssistant: true,
    advancedAnalytics: true,
    customStorefront: true,
  },
  enterprise: {
    listings: -1,
    aiPriceEstimates: -1,
    featuredListings: -1,
    aiAssistant: true,
    advancedAnalytics: true,
    customStorefront: true,
  },
};

export default async function BillingPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/dashboard/billing');
  }

  // Check if user is a dealer
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_dealer, subscription_tier, company_name')
    .eq('id', user.id)
    .single();

  if (!profile?.is_dealer) {
    redirect('/become-a-dealer');
  }

  const currentTier = (profile?.subscription_tier || 'free') as keyof typeof PLAN_LIMITS;
  const limits = PLAN_LIMITS[currentTier];

  // Get current usage
  const { count: listingCount } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const usage = {
    listings: listingCount || 0,
  };

  const listingPercentage = limits.listings === -1
    ? 0
    : Math.min(100, (usage.listings / limits.listings) * 100);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Plans & Billing</h1>
        <p className="text-muted-foreground mt-1">
          Manage your subscription and view usage
        </p>
      </div>

      {/* Current Plan & Usage */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Current Plan
                {currentTier === 'pro' && <Crown className="w-5 h-5 text-primary" />}
              </CardTitle>
              <CardDescription>
                {currentTier === 'free' && 'You are on the Free plan'}
                {currentTier === 'pro' && 'You are on the Pro plan'}
                {currentTier === 'enterprise' && 'You are on the Enterprise plan'}
              </CardDescription>
            </div>
            <Badge
              variant={currentTier === 'free' ? 'secondary' : 'default'}
              className={currentTier === 'pro' ? 'bg-primary' : ''}
            >
              {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Usage Stats */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground">Usage This Month</h4>

            {/* Listings */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span>Active Listings</span>
                </div>
                <span className="font-medium">
                  {usage.listings} / {limits.listings === -1 ? '∞' : limits.listings}
                </span>
              </div>
              {limits.listings !== -1 && (
                <Progress value={listingPercentage} className="h-2" />
              )}
              {limits.listings !== -1 && usage.listings >= limits.listings && (
                <p className="text-xs text-destructive">
                  You&apos;ve reached your listing limit. Upgrade to add more.
                </p>
              )}
            </div>
          </div>

          {/* Current Plan Features */}
          <div className="pt-4 border-t">
            <h4 className="font-medium text-sm text-muted-foreground mb-3">Your Plan Includes</h4>
            <ul className="grid sm:grid-cols-2 gap-2 text-sm">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                {limits.listings === -1 ? 'Unlimited' : `Up to ${limits.listings}`} listings
              </li>
              <li className="flex items-center gap-2">
                {limits.aiAssistant ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <X className="w-4 h-4 text-muted-foreground" />
                )}
                <span className={!limits.aiAssistant ? 'text-muted-foreground' : ''}>
                  AI Sales Assistant
                </span>
              </li>
              <li className="flex items-center gap-2">
                {limits.advancedAnalytics ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <X className="w-4 h-4 text-muted-foreground" />
                )}
                <span className={!limits.advancedAnalytics ? 'text-muted-foreground' : ''}>
                  Advanced Analytics
                </span>
              </li>
              <li className="flex items-center gap-2">
                {limits.customStorefront ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <X className="w-4 h-4 text-muted-foreground" />
                )}
                <span className={!limits.customStorefront ? 'text-muted-foreground' : ''}>
                  Custom Storefront
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                Lead Management
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                Basic Analytics
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Upgrade Options - Only show if not on enterprise */}
      {currentTier !== 'enterprise' && (
        <>
          <h2 className="text-xl font-bold pt-4">
            {currentTier === 'free' ? 'Upgrade Your Plan' : 'Available Plans'}
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Pro Plan */}
            <Card className={`relative ${currentTier === 'free' ? 'border-primary/50' : ''}`}>
              {currentTier === 'free' && (
                <div className="absolute -top-3 left-4">
                  <Badge className="bg-primary">Recommended</Badge>
                </div>
              )}
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-primary" />
                  <CardTitle>Pro</CardTitle>
                  {currentTier === 'pro' && (
                    <Badge variant="outline" className="ml-2">Current</Badge>
                  )}
                </div>
                <CardDescription>For growing dealers</CardDescription>
                <div className="mt-4">
                  <span className="text-3xl font-bold">$79</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <strong>Unlimited</strong> listings
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    AI Sales Assistant (24/7 lead capture)
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    Advanced analytics & trends
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    3 featured listings/month
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    Priority search placement
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    Custom branded storefront
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    Unlimited AI price estimates
                  </li>
                </ul>
                {currentTier === 'free' ? (
                  <Button className="w-full" asChild>
                    <Link href="/contact?plan=pro">
                      <Zap className="w-4 h-4 mr-2" />
                      Upgrade to Pro
                    </Link>
                  </Button>
                ) : (
                  <Button className="w-full" variant="outline" disabled>
                    Current Plan
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Enterprise Plan */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-muted-foreground" />
                  <CardTitle>Enterprise</CardTitle>
                </div>
                <CardDescription>For large dealerships</CardDescription>
                <div className="mt-4">
                  <span className="text-3xl font-bold">Custom</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    Everything in Pro
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    Multi-location support
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    API access & integrations
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    Dedicated account manager
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    Custom onboarding
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    Priority support
                  </li>
                </ul>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/contact?plan=enterprise">
                    Contact Sales
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Contact */}
      <Card className="bg-muted/50">
        <CardContent className="p-6">
          <div className="text-center">
            <h3 className="font-semibold mb-2">Have questions?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Our team is here to help you choose the right plan
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="outline" asChild>
                <a href="mailto:sales@axles.ai">
                  <Mail className="w-4 h-4 mr-2" />
                  sales@axles.ai
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href="tel:+1234567890">
                  <Phone className="w-4 h-4 mr-2" />
                  Contact Us
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
