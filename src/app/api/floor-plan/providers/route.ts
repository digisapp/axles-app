import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, rateLimitResponse } from '@/lib/security/rate-limit';
import { logger } from '@/lib/logger';

// GET - List all active floor plan providers
export async function GET(request: NextRequest) {
  try {
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, {
      ...RATE_LIMITS.standard,
      prefix: 'ratelimit:floor-plan-providers',
    });
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('floor_plan_providers')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      logger.error('Error fetching floor plan providers', { error });
      return NextResponse.json({ error: 'Failed to fetch providers' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Floor plan providers error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
