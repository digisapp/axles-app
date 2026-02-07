import { NextRequest, NextResponse } from 'next/server';
import { flushAllViewBatches } from '@/lib/cache';

// Verify the request is from Vercel Cron or has correct secret
import { logger } from '@/lib/logger'
function verifyRequest(request: NextRequest): boolean {
  // Check for Vercel Cron header
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return true;
  }

  // Check for Vercel internal cron
  const vercelCron = request.headers.get('x-vercel-cron');
  if (vercelCron) {
    return true;
  }

  return false;
}

export async function GET(request: NextRequest) {
  // Verify the request is authorized
  if (!verifyRequest(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const result = await flushAllViewBatches();

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Cron flush views error', { error });
    return NextResponse.json(
      { error: 'Failed to flush views' },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
