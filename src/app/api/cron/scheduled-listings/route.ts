import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Verify the request is from Vercel Cron or has correct secret
function verifyRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return true;
  }

  const vercelCron = request.headers.get('x-vercel-cron');
  if (vercelCron) {
    return true;
  }

  return false;
}

export async function GET(request: NextRequest) {
  if (!verifyRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Publish scheduled listings
    const { data: publishedCount, error: publishError } = await supabase
      .rpc('publish_scheduled_listings');

    if (publishError) {
      console.error('Error publishing scheduled listings:', publishError);
    }

    // Unpublish expired listings
    const { data: unpublishedCount, error: unpublishError } = await supabase
      .rpc('unpublish_expired_listings');

    if (unpublishError) {
      console.error('Error unpublishing expired listings:', unpublishError);
    }

    return NextResponse.json({
      success: true,
      published: publishedCount || 0,
      unpublished: unpublishedCount || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Scheduled listings cron error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
