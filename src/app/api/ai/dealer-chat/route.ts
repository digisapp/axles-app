import { NextRequest, NextResponse } from 'next/server';
import { createXai } from '@ai-sdk/xai';
import { generateText } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, rateLimitResponse } from '@/lib/security/rate-limit';
import { logger } from '@/lib/logger';

// Types
interface DealerAISettings {
  assistant_name: string;
  greeting_message: string;
  about_dealer: string;
  specialties: string[];
  value_propositions: string[];
  service_areas: string[];
  financing_info: string;
  warranty_info: string;
  faqs: Array<{ question: string; answer: string }>;
  tone: string;
  language_style: string;
  include_pricing: boolean;
  include_financing_cta: boolean;
  capture_leads: boolean;
  lead_capture_message: string;
}

interface DealerProfile {
  id: string;
  company_name: string | null;
  email: string;
  phone: string | null;
  location: string | null;
  city: string | null;
  state: string | null;
  website: string | null;
  about: string | null;
}

interface ListingResult {
  id: string;
  title: string;
  price: number | null;
  year: number | null;
  make: string | null;
  model: string | null;
  condition: string | null;
  city: string | null;
  state: string | null;
  mileage: number | null;
  hours: number | null;
  description: string | null;
  ai_price_estimate: number | null;
  category: { name: string; slug: string }[] | null;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

function getXai() {
  if (!process.env.XAI_API_KEY) {
    return null;
  }
  return createXai({
    apiKey: process.env.XAI_API_KEY,
  });
}

// Query dealer's inventory
async function queryDealerListings(
  dealerId: string,
  query: string
): Promise<{ listings: ListingResult[]; stats: { total: number; avgPrice: number; minPrice: number; maxPrice: number } | null }> {
  const supabase = await createClient();
  const q = query.toLowerCase();

  let dbQuery = supabase
    .from('listings')
    .select(`
      id, title, price, year, make, model, condition, city, state, mileage, hours, description, ai_price_estimate,
      category:categories!left(name, slug)
    `)
    .eq('user_id', dealerId)
    .eq('status', 'active');

  // Apply search filters based on query
  const categoryPatterns: Record<string, string[]> = {
    'lowboy': ['lowboy'],
    'flatbed': ['flatbed'],
    'reefer': ['reefer', 'refrigerated'],
    'dry van': ['dry van', 'dry-van'],
    'dump': ['dump'],
    'tank': ['tank', 'tanker'],
    'trailer': ['trailer'],
    'truck': ['truck', 'semi', 'sleeper', 'day cab'],
  };

  for (const [category, keywords] of Object.entries(categoryPatterns)) {
    if (keywords.some(kw => q.includes(kw))) {
      dbQuery = dbQuery.or(`title.ilike.%${category}%,description.ilike.%${category}%`);
      break;
    }
  }

  // Price filters
  const priceMatch = q.match(/under\s*\$?\s*([\d,]+)\s*k?/i);
  if (priceMatch) {
    let price = parseInt(priceMatch[1].replace(/,/g, ''));
    if (price < 1000) price *= 1000;
    dbQuery = dbQuery.lte('price', price);
  }

  // Sort by relevance/price
  if (q.includes('cheapest') || q.includes('lowest price')) {
    dbQuery = dbQuery.order('price', { ascending: true });
  } else if (q.includes('newest')) {
    dbQuery = dbQuery.order('year', { ascending: false });
  } else {
    dbQuery = dbQuery.order('created_at', { ascending: false });
  }

  dbQuery = dbQuery.limit(10);

  const { data: listings, error } = await dbQuery;

  if (error || !listings) {
    logger.error('Dealer listing query error', { error });
    return { listings: [], stats: null };
  }

  // Calculate stats for dealer's inventory
  const { data: allListings } = await supabase
    .from('listings')
    .select('price')
    .eq('user_id', dealerId)
    .eq('status', 'active')
    .not('price', 'is', null);

  let stats = null;
  if (allListings && allListings.length > 0) {
    const prices = allListings.map(p => p.price).filter((p): p is number => p !== null);
    if (prices.length > 0) {
      stats = {
        total: prices.length,
        avgPrice: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
      };
    }
  }

  return { listings: listings as ListingResult[], stats };
}

// Format listings for AI context
function formatListingsForAI(listings: ListingResult[]): string {
  if (listings.length === 0) {
    return 'No matching equipment found in current inventory.';
  }

  let context = 'AVAILABLE INVENTORY:\n';
  listings.forEach((listing, i) => {
    context += `${i + 1}. ${listing.title}\n`;
    context += `   Price: ${listing.price ? '$' + listing.price.toLocaleString() : 'Call for price'}\n`;
    if (listing.year || listing.make || listing.model) {
      context += `   ${[listing.year, listing.make, listing.model].filter(Boolean).join(' ')}\n`;
    }
    if (listing.condition) {
      context += `   Condition: ${listing.condition}\n`;
    }
    if (listing.mileage) {
      context += `   Mileage: ${listing.mileage.toLocaleString()} miles\n`;
    }
    if (listing.hours) {
      context += `   Hours: ${listing.hours.toLocaleString()}\n`;
    }
    context += `   View: axlon.ai/listing/${listing.id}\n\n`;
  });

  return context;
}

// Build custom system prompt for dealer
function buildDealerSystemPrompt(
  settings: DealerAISettings,
  dealer: DealerProfile,
  inventoryStats: { total: number; avgPrice: number; minPrice: number; maxPrice: number } | null
): string {
  const dealerName = dealer.company_name || 'this dealership';
  const toneInstructions = {
    professional: 'Maintain a professional, knowledgeable tone.',
    friendly: 'Be warm, friendly, and approachable while staying professional.',
    casual: 'Be casual and conversational, like a helpful friend.',
  };

  const styleInstructions = {
    concise: 'Keep responses brief and to the point (2-3 sentences per topic).',
    detailed: 'Provide thorough, detailed information.',
    conversational: 'Write in a natural, conversational style.',
  };

  let prompt = `You are ${settings.assistant_name}, the AI sales assistant for ${dealerName}.

CRITICAL RULES:
1. You ONLY represent ${dealerName}. NEVER mention, recommend, or compare to other dealers or competitors.
2. You ONLY have knowledge of ${dealerName}'s inventory. If asked about equipment you don't have, say "We don't currently have that in stock, but let me tell you about similar options we do have."
3. NEVER say "check other dealers" or suggest going elsewhere.
4. Always try to guide the conversation toward the dealer's available inventory.
5. If you can't help with something, offer to connect them with a team member.

IMPORTANT: Always respond in the SAME LANGUAGE as the user's question.

${toneInstructions[settings.tone as keyof typeof toneInstructions] || toneInstructions.professional}
${styleInstructions[settings.language_style as keyof typeof styleInstructions] || styleInstructions.concise}

ABOUT ${dealerName.toUpperCase()}:
${settings.about_dealer || `${dealerName} is a trusted equipment dealer.`}

`;

  if (settings.value_propositions.length > 0) {
    prompt += `\nWHY CHOOSE US:\n`;
    settings.value_propositions.forEach(prop => {
      prompt += `- ${prop}\n`;
    });
  }

  if (settings.specialties.length > 0) {
    prompt += `\nWE SPECIALIZE IN:\n${settings.specialties.join(', ')}\n`;
  }

  if (settings.service_areas.length > 0) {
    prompt += `\nSERVICE AREAS:\n${settings.service_areas.join(', ')}\n`;
  }

  if (dealer.city || dealer.state) {
    prompt += `\nLOCATION: ${[dealer.city, dealer.state].filter(Boolean).join(', ')}\n`;
  }

  if (dealer.phone) {
    prompt += `PHONE: ${dealer.phone}\n`;
  }

  if (settings.financing_info) {
    prompt += `\nFINANCING OPTIONS:\n${settings.financing_info}\n`;
  }

  if (settings.warranty_info) {
    prompt += `\nWARRANTY INFO:\n${settings.warranty_info}\n`;
  }

  if (settings.faqs.length > 0) {
    prompt += `\nFREQUENTLY ASKED QUESTIONS:\n`;
    settings.faqs.forEach(faq => {
      prompt += `Q: ${faq.question}\nA: ${faq.answer}\n\n`;
    });
  }

  if (inventoryStats) {
    prompt += `\nINVENTORY OVERVIEW:\n`;
    prompt += `- ${inventoryStats.total} units currently available\n`;
    prompt += `- Price range: $${inventoryStats.minPrice.toLocaleString()} - $${inventoryStats.maxPrice.toLocaleString()}\n`;
  }

  prompt += `\nRESPONSE GUIDELINES:
- ${settings.include_pricing ? 'Include specific prices when discussing equipment.' : 'Do not mention specific prices; suggest contacting us for pricing.'}
- ${settings.include_financing_cta ? 'Mention financing options when discussing purchases.' : ''}
- When customers show strong interest, encourage them to schedule a visit or call.
- If the customer seems ready to buy, offer to have a team member reach out.
- Don't use markdown formatting like ** or ## - use plain text with line breaks.
- Keep responses focused on helping the customer find the right equipment.

Remember: You are the voice of ${dealerName}. Be helpful, knowledgeable, and always guide toward our inventory.`;

  return prompt;
}

// Detect if AI should capture a lead
function shouldCaptureLead(
  messages: ConversationMessage[],
  query: string
): boolean {
  const q = query.toLowerCase();

  // Strong buying signals
  const buyingSignals = [
    'interested', 'want to buy', 'ready to', 'how do i purchase',
    'what\'s the process', 'can i finance', 'down payment', 'monthly payment',
    'when can i', 'available for pickup', 'delivery', 'test drive',
    'come see', 'schedule', 'appointment', 'call me', 'contact me',
    'phone number', 'email', 'reach me', 'serious buyer', 'ready to deal',
  ];

  // Check current message
  if (buyingSignals.some(signal => q.includes(signal))) {
    return true;
  }

  // Check conversation length (after 3+ exchanges, try to capture)
  if (messages.length >= 6) {
    return true;
  }

  return false;
}

// Detect if question is about a specific listing
function extractListingId(query: string): string | null {
  const match = query.match(/listing[\/\s]+([a-f0-9-]+)/i);
  return match ? match[1] : null;
}

export async function POST(request: NextRequest) {
  try {
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, {
      ...RATE_LIMITS.ai,
      prefix: 'ratelimit:ai-dealer-chat',
    });
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const body = await request.json();
    const {
      dealerId,
      query,
      conversationId,
      listingId,
      messages = [],
      visitorInfo,
    } = body;

    if (!dealerId || !query) {
      return NextResponse.json(
        { error: 'Dealer ID and query are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Fetch dealer's AI settings
    const { data: aiSettings, error: settingsError } = await supabase
      .from('dealer_ai_settings')
      .select('*')
      .eq('dealer_id', dealerId)
      .eq('is_enabled', true)
      .single();

    if (settingsError || !aiSettings) {
      return NextResponse.json(
        { error: 'Dealer AI assistant is not enabled' },
        { status: 404 }
      );
    }

    // Fetch dealer profile
    const { data: dealer, error: dealerError } = await supabase
      .from('profiles')
      .select('id, company_name, email, phone, location, city, state, website, about')
      .eq('id', dealerId)
      .single();

    if (dealerError || !dealer) {
      return NextResponse.json(
        { error: 'Dealer not found' },
        { status: 404 }
      );
    }

    // Query dealer's inventory
    const { listings, stats } = await queryDealerListings(dealerId, query);

    // If asking about a specific listing, fetch its details
    let specificListing: ListingResult | null = null;
    const queryListingId = listingId || extractListingId(query);
    if (queryListingId) {
      const { data: listing } = await supabase
        .from('listings')
        .select(`
          id, title, price, year, make, model, condition, city, state,
          mileage, hours, description, ai_price_estimate,
          category:categories!left(name, slug)
        `)
        .eq('id', queryListingId)
        .eq('user_id', dealerId)
        .single();

      if (listing) {
        specificListing = listing as ListingResult;
      }
    }

    // Check if we should capture a lead
    const conversationMessages = messages as ConversationMessage[];
    const shouldCapture = aiSettings.capture_leads && shouldCaptureLead(conversationMessages, query);

    // Build the AI prompt
    const xai = getXai();

    if (!xai) {
      // Fallback response without AI
      return NextResponse.json({
        type: 'dealer_chat',
        response: `Thanks for your interest! We have ${stats?.total || 'many'} units available. ${aiSettings.lead_capture_message} Our team can help you find exactly what you need.`,
        dealerName: dealer.company_name,
        shouldCaptureLead: true,
        suggestedListings: listings.slice(0, 3).map(l => ({
          id: l.id,
          title: l.title,
          price: l.price,
          year: l.year,
          make: l.make,
          model: l.model,
        })),
      });
    }

    // Build system prompt with dealer context
    const systemPrompt = buildDealerSystemPrompt(
      aiSettings as DealerAISettings,
      dealer as DealerProfile,
      stats
    );

    // Build user prompt with inventory context
    let userPrompt = query;

    if (specificListing) {
      userPrompt = `[Customer is asking about this specific listing:]
${specificListing.title}
Price: ${specificListing.price ? '$' + specificListing.price.toLocaleString() : 'Call for price'}
${specificListing.year} ${specificListing.make} ${specificListing.model}
Condition: ${specificListing.condition}
${specificListing.mileage ? 'Mileage: ' + specificListing.mileage.toLocaleString() + ' miles' : ''}
${specificListing.description ? 'Description: ' + specificListing.description.substring(0, 500) : ''}

Customer question: ${query}`;
    } else if (listings.length > 0) {
      const inventoryContext = formatListingsForAI(listings);
      userPrompt = `${query}

[DEALER'S AVAILABLE INVENTORY:]
${inventoryContext}

Based on this inventory, help the customer find what they need. Only recommend equipment from this list.`;
    }

    // Include conversation history
    const messageHistory = conversationMessages.slice(-10).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Generate AI response
    const { text } = await generateText({
      model: xai('grok-3-mini'),
      system: systemPrompt,
      messages: [
        ...messageHistory,
        { role: 'user' as const, content: userPrompt },
      ],
    });

    // Add lead capture message if appropriate
    let finalResponse = text;
    if (shouldCapture && aiSettings.capture_leads) {
      finalResponse += `\n\n${aiSettings.lead_capture_message}`;
    }

    // Prepare suggested listings for the response
    const suggestedListings = (specificListing ? [specificListing] : listings.slice(0, 3)).map(l => ({
      id: l.id,
      title: l.title,
      price: l.price,
      year: l.year,
      make: l.make,
      model: l.model,
      location: [l.city, l.state].filter(Boolean).join(', '),
    }));

    // Update conversation stats
    if (conversationId) {
      try {
        await supabase.rpc('increment_dealer_ai_messages', {
          p_dealer_id: dealerId,
        });
      } catch {
        // Ignore errors for stats update
      }
    }

    return NextResponse.json({
      type: 'dealer_chat',
      response: finalResponse,
      dealerName: dealer.company_name,
      assistantName: aiSettings.assistant_name,
      shouldCaptureLead: shouldCapture,
      suggestedListings,
      inventoryStats: stats,
      conversationId,
    });

  } catch (error) {
    logger.error('Dealer AI Chat error', { error });
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

// Create or update conversation
export async function PUT(request: NextRequest) {
  try {
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, {
      ...RATE_LIMITS.ai,
      prefix: 'ratelimit:ai-dealer-chat',
    });
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const body = await request.json();
    const {
      dealerId,
      conversationId,
      visitorName,
      visitorEmail,
      visitorPhone,
      visitorIntent,
      listingId,
    } = body;

    if (!dealerId) {
      return NextResponse.json(
        { error: 'Dealer ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    if (conversationId) {
      // Update existing conversation with visitor info
      const { error } = await supabase
        .from('chat_conversations')
        .update({
          visitor_name: visitorName,
          visitor_email: visitorEmail,
          visitor_phone: visitorPhone,
          visitor_intent: visitorIntent,
          lead_captured: !!(visitorEmail || visitorPhone),
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId);

      if (error) {
        logger.error('Update conversation error', { error });
      }

      // Create lead if contact info provided
      if (visitorEmail || visitorPhone) {
        const { data: lead, error: leadError } = await supabase
          .from('dealer_ai_leads')
          .insert({
            conversation_id: conversationId,
            dealer_id: dealerId,
            visitor_name: visitorName,
            visitor_email: visitorEmail,
            visitor_phone: visitorPhone,
            equipment_interest: visitorIntent,
            status: 'new',
          })
          .select()
          .single();

        if (!leadError && lead) {
          // Update dealer's lead count
          try {
            await supabase.rpc('increment_dealer_ai_leads', {
              p_dealer_id: dealerId,
            });
          } catch {
            // Ignore stats update errors
          }

          return NextResponse.json({
            success: true,
            conversationId,
            leadId: lead.id,
            leadCaptured: true,
          });
        }
      }

      return NextResponse.json({
        success: true,
        conversationId,
        leadCaptured: !!(visitorEmail || visitorPhone),
      });
    } else {
      // Create new conversation
      const { data: conversation, error } = await supabase
        .from('chat_conversations')
        .insert({
          dealer_id: dealerId,
          listing_id: listingId,
          is_ai_conversation: true,
          visitor_name: visitorName,
          visitor_email: visitorEmail,
          visitor_phone: visitorPhone,
          visitor_intent: visitorIntent,
          status: 'active',
        })
        .select()
        .single();

      if (error) {
        logger.error('Create conversation error', { error });
        return NextResponse.json(
          { error: 'Failed to create conversation' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        conversationId: conversation.id,
        isNew: true,
      });
    }
  } catch (error) {
    logger.error('Conversation update error', { error });
    return NextResponse.json(
      { error: 'Failed to update conversation' },
      { status: 500 }
    );
  }
}
