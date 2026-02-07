import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripe, PRICING } from '@/lib/stripe/config';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, rateLimitResponse } from '@/lib/security/rate-limit';
import { logger } from '@/lib/logger';
import { validateBody, ValidationError, stripeCheckoutSchema } from '@/lib/validations/api';

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, {
      ...RATE_LIMITS.auth,
      prefix: 'ratelimit:stripe',
    });
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const rawBody = await request.json();
    let validatedData;
    try {
      validatedData = validateBody(stripeCheckoutSchema, rawBody);
    } catch (err) {
      if (err instanceof ValidationError) {
        return NextResponse.json(
          { error: 'Validation failed', details: err.errors },
          { status: 400 }
        );
      }
      throw err;
    }
    const { product, listingId, successUrl, cancelUrl } = validatedData;

    // Get or create Stripe customer
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    let customerId = profile?.stripe_customer_id;

    const stripe = getStripe();

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;

      // Save customer ID to profile
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    // Determine pricing based on product
    let lineItems;
    let mode: 'payment' | 'subscription' = 'payment';

    switch (product) {
      case 'featured_week':
        lineItems = [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: PRICING.FEATURED_LISTING_WEEK.label,
              description: PRICING.FEATURED_LISTING_WEEK.description,
            },
            unit_amount: PRICING.FEATURED_LISTING_WEEK.amount,
          },
          quantity: 1,
        }];
        break;

      case 'featured_month':
        lineItems = [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: PRICING.FEATURED_LISTING_MONTH.label,
              description: PRICING.FEATURED_LISTING_MONTH.description,
            },
            unit_amount: PRICING.FEATURED_LISTING_MONTH.amount,
          },
          quantity: 1,
        }];
        break;

      case 'bump':
        lineItems = [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: PRICING.BUMP_LISTING.label,
              description: PRICING.BUMP_LISTING.description,
            },
            unit_amount: PRICING.BUMP_LISTING.amount,
          },
          quantity: 1,
        }];
        break;

      case 'dealer_pro_monthly':
        lineItems = [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: PRICING.DEALER_PRO.label,
              description: PRICING.DEALER_PRO.features.join(', '),
            },
            unit_amount: PRICING.DEALER_PRO.monthly,
            recurring: {
              interval: 'month' as const,
            },
          },
          quantity: 1,
        }];
        mode = 'subscription';
        break;

      case 'dealer_pro_yearly':
        lineItems = [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${PRICING.DEALER_PRO.label} (Annual)`,
              description: PRICING.DEALER_PRO.features.join(', '),
            },
            unit_amount: PRICING.DEALER_PRO.yearly,
            recurring: {
              interval: 'year' as const,
            },
          },
          quantity: 1,
        }];
        mode = 'subscription';
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid product' },
          { status: 400 }
        );
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: lineItems,
      mode,
      success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`,
      cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?canceled=true`,
      metadata: {
        user_id: user.id,
        product,
        listing_id: listingId || '',
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    logger.error('Stripe checkout error', { error });
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
