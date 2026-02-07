import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/resend';
import { chatLeadCapturedEmail } from '@/lib/email/templates';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, rateLimitResponse } from '@/lib/security/rate-limit';
import { logger } from '@/lib/logger';
import { validateBody, ValidationError, chatLeadSchema } from '@/lib/validations/api';

export async function POST(request: NextRequest) {
  try {
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, {
      ...RATE_LIMITS.auth,
      prefix: 'ratelimit:chat-lead',
    });
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const body = await request.json();
    let validatedData;
    try {
      validatedData = validateBody(chatLeadSchema, body);
    } catch (err) {
      if (err instanceof ValidationError) {
        return NextResponse.json(
          { error: 'Validation failed', details: err.errors },
          { status: 400 }
        );
      }
      throw err;
    }
    const { dealerId, conversationId, name, email, phone } = validatedData;

    const supabase = await createClient();

    // Get dealer info for notification
    const { data: dealer } = await supabase
      .from('profiles')
      .select('email, company_name, notification_settings')
      .eq('id', dealerId)
      .single();

    // Update conversation with visitor info
    if (conversationId) {
      await supabase
        .from('chat_conversations')
        .update({
          visitor_name: name,
          visitor_email: email,
          visitor_phone: phone || null,
          status: 'converted',
        })
        .eq('id', conversationId);
    }

    // Create a lead record
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        user_id: dealerId, // Dealer receiving the lead
        buyer_name: name,
        buyer_email: email,
        buyer_phone: phone || null,
        message: 'Lead captured from AI chat widget',
        source: 'chat',
        status: 'new',
        priority: 'high', // Chat leads are high intent
      })
      .select('id')
      .single();

    if (leadError) {
      logger.error('Error creating lead', { leadError });
      // Still return success - conversation was updated
    }

    // Link lead to conversation if both exist
    if (lead && conversationId) {
      await supabase
        .from('chat_conversations')
        .update({ lead_id: lead.id })
        .eq('id', conversationId);
    }

    // Send notification email to dealer
    const notificationSettings = dealer?.notification_settings || {};
    const shouldNotifyLead = notificationSettings.new_lead !== false; // Default to true

    if (shouldNotifyLead && dealer?.email) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
      try {
        await sendEmail({
          to: dealer.email,
          subject: `New lead captured from chat: ${name}`,
          html: chatLeadCapturedEmail({
            dealerName: dealer.company_name || 'Dealer',
            visitorName: name,
            visitorEmail: email,
            visitorPhone: phone,
            conversationUrl: `${baseUrl}/dashboard/conversations/${conversationId}`,
            leadsUrl: `${baseUrl}/dashboard/leads`,
          }),
        });
      } catch (emailError) {
        logger.error('Failed to send lead notification', { emailError });
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({
      success: true,
      leadId: lead?.id,
    });
  } catch (error) {
    logger.error('Chat lead capture error', { error });
    return NextResponse.json(
      { error: 'Failed to capture lead' },
      { status: 500 }
    );
  }
}
