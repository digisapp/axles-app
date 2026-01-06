import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { dealerId, conversationId, name, email, phone } = await request.json();

    if (!dealerId || !name || !email) {
      return NextResponse.json(
        { error: 'Dealer ID, name, and email are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

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
      console.error('Error creating lead:', leadError);
      // Still return success - conversation was updated
    }

    // Link lead to conversation if both exist
    if (lead && conversationId) {
      await supabase
        .from('chat_conversations')
        .update({ lead_id: lead.id })
        .eq('id', conversationId);
    }

    return NextResponse.json({
      success: true,
      leadId: lead?.id,
    });
  } catch (error) {
    console.error('Chat lead capture error:', error);
    return NextResponse.json(
      { error: 'Failed to capture lead' },
      { status: 500 }
    );
  }
}
