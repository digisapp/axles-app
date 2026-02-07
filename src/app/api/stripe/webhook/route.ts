import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getStripe } from '@/lib/stripe/config';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { logger } from '@/lib/logger';

// Lazy initialization for Supabase service client
function getSupabaseAdmin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase environment variables not configured');
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing signature' },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    logger.error('Webhook signature verification failed', { error });
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  // Idempotency check - prevent duplicate webhook processing
  const { data: existingEvent } = await supabase
    .from('stripe_webhook_events')
    .select('id')
    .eq('event_id', event.id)
    .single();

  if (existingEvent) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Record the event for idempotency
  try {
    await supabase.from('stripe_webhook_events').insert({
      event_id: event.id,
      event_type: event.type,
      processed_at: new Date().toISOString(),
    });
  } catch {
    // Table may not exist yet - continue processing
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const { user_id, product, listing_id } = session.metadata || {};

        // Validate required metadata fields
        const validProducts = ['featured_week', 'featured_month', 'bump', 'dealer_pro', 'dealer_pro_annual'];
        if (product && !validProducts.some(p => product.startsWith(p))) {
          logger.error('Invalid product in webhook metadata', { product });
          break;
        }

        // Validate UUID format for IDs
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (user_id && !uuidRegex.test(user_id)) {
          logger.error('Invalid user_id in webhook metadata', { user_id });
          break;
        }
        if (listing_id && !uuidRegex.test(listing_id)) {
          logger.error('Invalid listing_id in webhook metadata', { listing_id });
          break;
        }

        if (product?.startsWith('featured') && listing_id && user_id) {
          // Feature the listing
          const days = product === 'featured_week' ? 7 : 30;
          const featuredUntil = new Date();
          featuredUntil.setDate(featuredUntil.getDate() + days);

          await supabase
            .from('listings')
            .update({
              is_featured: true,
              featured_until: featuredUntil.toISOString(),
            })
            .eq('id', listing_id)
            .eq('user_id', user_id);
        }

        if (product === 'bump' && listing_id && user_id) {
          // Bump the listing (update timestamp)
          await supabase
            .from('listings')
            .update({
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', listing_id)
            .eq('user_id', user_id);
        }

        if (product?.startsWith('dealer_pro') && user_id) {
          // Update user to dealer status
          await supabase
            .from('profiles')
            .update({
              is_dealer: true,
            })
            .eq('id', user_id);
        }

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Find user by customer ID and revoke dealer status
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (profile) {
          await supabase
            .from('profiles')
            .update({ is_dealer: false })
            .eq('id', profile.id);
        }

        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        // Handle failed payment (send notification, etc.)
        logger.warn('Payment failed for invoice', { invoiceId: invoice.id });
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error('Webhook handler error', { error });
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
