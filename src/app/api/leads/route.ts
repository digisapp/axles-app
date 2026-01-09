import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { calculateLeadScoreWithAI } from '@/lib/leads/scoring';

const AXLESAI_ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'sales@axles.ai';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const {
      listing_id,
      seller_id,
      buyer_name,
      buyer_email,
      buyer_phone,
      message,
    } = body;

    // Check if routing to AxlesAI (no seller specified)
    const isAxlesAILead = !seller_id;

    // Validate required fields
    if (!buyer_name || !buyer_email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(buyer_email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Get listing info for scoring
    let listingState: string | null = null;
    let listingTitle: string | null = null;
    if (listing_id) {
      const { data: listing } = await supabase
        .from('listings')
        .select('title, state')
        .eq('id', listing_id)
        .single();
      if (listing) {
        listingState = listing.state;
        listingTitle = listing.title;
      }
    }

    // Calculate lead score with AI
    const { score, factors, priority } = await calculateLeadScoreWithAI({
      buyerEmail: buyer_email,
      buyerPhone: buyer_phone,
      message: message,
      listingState: listingState,
      listingTitle: listingTitle || undefined,
    });

    // Create the lead with score
    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        listing_id: listing_id || null,
        user_id: seller_id || null, // null for AxlesAI leads
        buyer_name,
        buyer_email,
        buyer_phone: buyer_phone || null,
        message: message || null,
        status: 'new',
        priority: priority,
        score: score,
        score_factors: factors,
        source: isAxlesAILead ? 'axlesai_contact' : 'contact_form',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating lead:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Use listing title from earlier fetch, or fallback
    const emailListingTitle = listingTitle || 'a listing';

    // Determine notification recipient
    let notificationEmail: string | null = null;

    if (isAxlesAILead) {
      // Send to AxlesAI admin
      notificationEmail = AXLESAI_ADMIN_EMAIL;
    } else if (seller_id) {
      // Get seller info for email notification
      const { data: seller } = await supabase
        .from('profiles')
        .select('email, company_name')
        .eq('id', seller_id)
        .single();
      notificationEmail = seller?.email || null;
    }

    // Send email notification (if Resend is configured)
    if (notificationEmail && process.env.RESEND_API_KEY) {
      try {
        const dashboardUrl = isAxlesAILead
          ? `${process.env.NEXT_PUBLIC_APP_URL}/admin/leads`
          : `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/leads`;

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'AxlesAI <leads@axles.ai>',
            to: notificationEmail,
            subject: `New Lead: ${buyer_name} interested in ${emailListingTitle}`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">New Lead Received!</h2>
                <p>You have a new inquiry about <strong>${emailListingTitle}</strong>.</p>

                <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="margin-top: 0;">Contact Information</h3>
                  <p><strong>Name:</strong> ${buyer_name}</p>
                  <p><strong>Email:</strong> <a href="mailto:${buyer_email}">${buyer_email}</a></p>
                  ${buyer_phone ? `<p><strong>Phone:</strong> <a href="tel:${buyer_phone}">${buyer_phone}</a></p>` : ''}
                </div>

                ${message ? `
                <div style="background: #fff; border: 1px solid #ddd; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="margin-top: 0;">Message</h3>
                  <p>${message}</p>
                </div>
                ` : ''}

                <p>
                  <a href="${dashboardUrl}"
                     style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                    View in ${isAxlesAILead ? 'Admin Panel' : 'Dashboard'}
                  </a>
                </p>

                <p style="color: #666; font-size: 14px; margin-top: 30px;">
                  This lead was generated through AxlesAI. Respond promptly to increase your chances of closing the sale.
                </p>
              </div>
            `,
          }),
        });
      } catch (emailError) {
        // Don't fail the request if email fails
        console.error('Failed to send email notification:', emailError);
      }
    }

    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/leads:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
