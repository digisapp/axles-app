import Stripe from 'stripe';

// Lazy initialization to avoid build-time errors
let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover',
      typescript: true,
    });
  }
  return stripeInstance;
}

// For backwards compatibility
export const stripe = {
  get instance() {
    return getStripe();
  }
};

// Product IDs (create these in Stripe Dashboard)
export const STRIPE_PRODUCTS = {
  FEATURED_LISTING_WEEK: 'price_featured_week', // $29/week
  FEATURED_LISTING_MONTH: 'price_featured_month', // $99/month
  BUMP_LISTING: 'price_bump', // $9.99 one-time
  DEALER_PRO_MONTHLY: 'price_dealer_pro_monthly', // $99/month
  DEALER_PRO_YEARLY: 'price_dealer_pro_yearly', // $999/year
} as const;

export const PRICING = {
  FEATURED_LISTING_WEEK: {
    amount: 2900, // cents
    label: 'Featured Listing (1 Week)',
    description: 'Your listing appears at the top of search results for 7 days',
  },
  FEATURED_LISTING_MONTH: {
    amount: 9900,
    label: 'Featured Listing (1 Month)',
    description: 'Your listing appears at the top of search results for 30 days',
  },
  BUMP_LISTING: {
    amount: 999,
    label: 'Bump Listing',
    description: 'Refresh your listing to appear as newly posted',
  },
  DEALER_PRO: {
    monthly: 9900,
    yearly: 99900,
    label: 'Dealer Pro',
    features: [
      'Unlimited featured listings',
      'Priority customer support',
      'Advanced analytics',
      'Verified dealer badge',
      'Bulk listing tools',
    ],
  },
};
