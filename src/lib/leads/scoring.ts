import { xai } from '@ai-sdk/xai';
import { generateText } from 'ai';
import { logger } from '@/lib/logger';

// Free email domains that indicate individual (not company) buyers
const FREE_EMAIL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'mail.com', 'protonmail.com', 'zoho.com', 'yandex.com',
];

// Keywords that indicate high purchase intent
const HIGH_INTENT_KEYWORDS = [
  'financing', 'finance', 'loan', 'payment plan', 'monthly payment',
  'budget', 'ready to buy', 'when can', 'available', 'test drive',
  'inspect', 'inspection', 'come see', 'visit', 'trade', 'trade-in',
  'trading', 'serious buyer', 'cash', 'wire transfer',
];

// Keywords that indicate medium intent
const MEDIUM_INTENT_KEYWORDS = [
  'interested', 'details', 'more info', 'questions', 'photos',
  'pictures', 'history', 'condition', 'miles', 'hours',
];

interface ScoreFactors {
  companyEmail: boolean;
  hasPhone: boolean;
  phoneMatchesState: boolean;
  highIntentMessage: boolean;
  mediumIntentMessage: boolean;
  messageLength: 'short' | 'medium' | 'long';
  aiSentiment?: 'very_positive' | 'positive' | 'neutral' | 'negative';
  aiIntent?: string;
}

interface ScoringResult {
  score: number;
  factors: ScoreFactors;
  priority: 'low' | 'medium' | 'high';
}

/**
 * Calculate lead score based on available signals
 */
export function calculateLeadScore(params: {
  buyerEmail: string;
  buyerPhone?: string | null;
  message?: string | null;
  listingState?: string | null;
}): ScoringResult {
  const { buyerEmail, buyerPhone, message, listingState } = params;

  let score = 0;
  const factors: ScoreFactors = {
    companyEmail: false,
    hasPhone: false,
    phoneMatchesState: false,
    highIntentMessage: false,
    mediumIntentMessage: false,
    messageLength: 'short',
  };

  // 1. Email domain analysis (+15 for company email)
  const emailDomain = buyerEmail.split('@')[1]?.toLowerCase();
  if (emailDomain && !FREE_EMAIL_DOMAINS.includes(emailDomain)) {
    score += 15;
    factors.companyEmail = true;
  }

  // 2. Phone number provided (+10)
  if (buyerPhone && buyerPhone.trim().length >= 10) {
    score += 10;
    factors.hasPhone = true;

    // 3. Phone area code matches listing state (+5)
    if (listingState) {
      const phoneMatch = checkPhoneAreaCodeMatch(buyerPhone, listingState);
      if (phoneMatch) {
        score += 5;
        factors.phoneMatchesState = true;
      }
    }
  }

  // 4. Message analysis
  if (message) {
    const lowerMessage = message.toLowerCase();

    // Check for high-intent keywords (+15)
    const hasHighIntent = HIGH_INTENT_KEYWORDS.some(keyword =>
      lowerMessage.includes(keyword)
    );
    if (hasHighIntent) {
      score += 15;
      factors.highIntentMessage = true;
    }

    // Check for medium-intent keywords (+5)
    const hasMediumIntent = MEDIUM_INTENT_KEYWORDS.some(keyword =>
      lowerMessage.includes(keyword)
    );
    if (hasMediumIntent && !hasHighIntent) {
      score += 5;
      factors.mediumIntentMessage = true;
    }

    // Message length analysis
    if (message.length > 200) {
      score += 10; // Detailed message = serious buyer
      factors.messageLength = 'long';
    } else if (message.length > 50) {
      score += 5;
      factors.messageLength = 'medium';
    } else {
      factors.messageLength = 'short';
    }
  }

  // Ensure score is between 0-100
  score = Math.min(100, Math.max(0, score));

  // Determine priority based on score
  let priority: 'low' | 'medium' | 'high' = 'medium';
  if (score >= 50) {
    priority = 'high';
  } else if (score < 25) {
    priority = 'low';
  }

  return { score, factors, priority };
}

/**
 * Enhanced scoring using AI for message sentiment/intent analysis
 */
export async function calculateLeadScoreWithAI(params: {
  buyerEmail: string;
  buyerPhone?: string | null;
  message?: string | null;
  listingState?: string | null;
  listingTitle?: string;
}): Promise<ScoringResult> {
  // Start with basic scoring
  const basicResult = calculateLeadScore(params);

  // If no message or AI not configured, return basic score
  if (!params.message || !process.env.XAI_API_KEY) {
    return basicResult;
  }

  try {
    // Use Grok to analyze message sentiment and intent
    const { text } = await generateText({
      model: xai('grok-3-mini'),
      prompt: `Analyze this buyer inquiry for a truck/equipment listing and respond with ONLY a JSON object:

Listing: "${params.listingTitle || 'Equipment listing'}"
Message: "${params.message}"

Respond with this exact JSON format (no other text):
{
  "sentiment": "very_positive" | "positive" | "neutral" | "negative",
  "intent": "ready_to_buy" | "serious_inquiry" | "gathering_info" | "tire_kicker",
  "reasoning": "one sentence explanation"
}`,
    });

    // Parse AI response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const aiAnalysis = JSON.parse(jsonMatch[0]);

      // Adjust score based on AI analysis
      let aiBonus = 0;

      if (aiAnalysis.sentiment === 'very_positive') {
        aiBonus += 15;
        basicResult.factors.aiSentiment = 'very_positive';
      } else if (aiAnalysis.sentiment === 'positive') {
        aiBonus += 10;
        basicResult.factors.aiSentiment = 'positive';
      } else if (aiAnalysis.sentiment === 'negative') {
        aiBonus -= 10;
        basicResult.factors.aiSentiment = 'negative';
      } else {
        basicResult.factors.aiSentiment = 'neutral';
      }

      if (aiAnalysis.intent === 'ready_to_buy') {
        aiBonus += 20;
      } else if (aiAnalysis.intent === 'serious_inquiry') {
        aiBonus += 10;
      } else if (aiAnalysis.intent === 'tire_kicker') {
        aiBonus -= 10;
      }

      basicResult.factors.aiIntent = aiAnalysis.intent;
      basicResult.score = Math.min(100, Math.max(0, basicResult.score + aiBonus));

      // Recalculate priority
      if (basicResult.score >= 50) {
        basicResult.priority = 'high';
      } else if (basicResult.score < 25) {
        basicResult.priority = 'low';
      } else {
        basicResult.priority = 'medium';
      }
    }
  } catch (error) {
    logger.error('AI scoring failed, using basic score', { error });
  }

  return basicResult;
}

/**
 * Check if phone area code matches the listing's state
 */
function checkPhoneAreaCodeMatch(phone: string, state: string): boolean {
  // Extract area code from phone (first 3 digits after cleaning)
  const cleanPhone = phone.replace(/\D/g, '');
  const areaCode = cleanPhone.slice(0, 3);

  // State to area code mapping (partial - major codes)
  const stateAreaCodes: Record<string, string[]> = {
    'TX': ['210', '214', '254', '281', '325', '361', '409', '430', '432', '469', '512', '682', '713', '737', '806', '817', '830', '832', '903', '915', '936', '940', '956', '972', '979'],
    'CA': ['209', '213', '310', '323', '408', '415', '424', '510', '530', '559', '562', '619', '626', '650', '657', '661', '707', '714', '760', '805', '818', '831', '858', '909', '916', '925', '949', '951'],
    'FL': ['239', '305', '321', '352', '386', '407', '561', '727', '754', '772', '786', '813', '850', '863', '904', '941', '954'],
    'NY': ['212', '315', '347', '516', '518', '585', '607', '631', '646', '716', '718', '845', '914', '917', '929'],
    'IL': ['217', '224', '309', '312', '331', '618', '630', '708', '773', '779', '815', '847', '872'],
    'PA': ['215', '267', '272', '412', '484', '570', '610', '717', '724', '814', '878'],
    'OH': ['216', '234', '330', '380', '419', '440', '513', '567', '614', '740', '937'],
    'GA': ['229', '404', '470', '478', '678', '706', '762', '770', '912'],
    'NC': ['252', '336', '704', '743', '828', '910', '919', '980', '984'],
    'MI': ['231', '248', '269', '313', '517', '586', '616', '734', '810', '906', '947', '989'],
  };

  const stateCodes = stateAreaCodes[state.toUpperCase()];
  if (!stateCodes) return false;

  return stateCodes.includes(areaCode);
}

/**
 * Get score label for display
 */
export function getScoreLabel(score: number): { label: string; color: string } {
  if (score >= 70) return { label: 'Hot Lead', color: 'text-red-600 bg-red-100' };
  if (score >= 50) return { label: 'Warm Lead', color: 'text-orange-600 bg-orange-100' };
  if (score >= 30) return { label: 'Cool Lead', color: 'text-blue-600 bg-blue-100' };
  return { label: 'Cold Lead', color: 'text-gray-600 bg-gray-100' };
}
