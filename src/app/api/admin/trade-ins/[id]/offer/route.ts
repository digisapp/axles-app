import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, rateLimitResponse } from '@/lib/security/rate-limit';
import { logger } from '@/lib/logger';
import { validateBody, ValidationError, tradeInOfferSchema } from '@/lib/validations/api';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, {
      ...RATE_LIMITS.standard,
      prefix: 'ratelimit:admin-trade-ins',
    });
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const supabase = await createClient();
    const { id } = await params;
    const body = await request.json();

    // Check if user is admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let validatedData;
    try {
      validatedData = validateBody(tradeInOfferSchema, body);
    } catch (err) {
      if (err instanceof ValidationError) {
        return NextResponse.json(
          { error: 'Validation failed', details: err.errors },
          { status: 400 }
        );
      }
      throw err;
    }
    const { offer_amount, message, email } = validatedData;

    // Send email
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'AxlonAI <noreply@axlon.ai>',
      to: email,
      subject: 'Trade-In Offer from AxlonAI',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #0066cc; padding: 20px; text-align: center;">
            <img src="https://axlon.ai/images/axlonai-logo.png" alt="AxlonAI" height="40" />
          </div>
          <div style="padding: 30px; background: #ffffff;">
            <h2 style="color: #333; margin-bottom: 20px;">Trade-In Valuation</h2>
            <div style="white-space: pre-line; color: #555; line-height: 1.6;">
              ${(message || '').replace(/\n/g, '<br/>')}
            </div>
            <div style="margin-top: 30px; padding: 20px; background: #f5f5f5; border-radius: 8px; text-align: center;">
              <p style="color: #666; margin-bottom: 10px;">Our Offer</p>
              <p style="font-size: 32px; font-weight: bold; color: #0066cc; margin: 0;">
                $${offer_amount.toLocaleString()}
              </p>
            </div>
            <div style="margin-top: 30px; text-align: center;">
              <a href="https://axlon.ai"
                 style="display: inline-block; background: #0066cc; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                Browse Equipment
              </a>
            </div>
          </div>
          <div style="padding: 20px; background: #f9f9f9; text-align: center; color: #888; font-size: 12px;">
            <p>Questions? Reply to this email or call us at (469) 421-3536</p>
            <p>© ${new Date().getFullYear()} AxlonAI. All rights reserved.</p>
          </div>
        </div>
      `,
    });

    // Update trade-in request with offer
    await supabase
      .from('trade_in_requests')
      .update({
        status: 'offered',
        offer_amount,
        offer_sent_at: new Date().toISOString(),
      })
      .eq('id', id);

    return NextResponse.json({ success: true, message: 'Offer sent successfully' });
  } catch (error) {
    logger.error('Error sending offer', { error });
    return NextResponse.json(
      { error: 'Failed to send offer' },
      { status: 500 }
    );
  }
}
