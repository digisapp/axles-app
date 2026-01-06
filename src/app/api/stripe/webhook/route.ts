import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getStripe } from '@/lib/stripe/config';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

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
    console.error('Webhook signature verification failed:', error);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const { user_id, product, listing_id } = session.metadata || {};

        if (product?.startsWith('featured') && listing_id) {
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

        if (product === 'bump' && listing_id) {
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
        console.log('Payment failed for invoice:', invoice.id);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
