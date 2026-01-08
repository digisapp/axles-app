import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

// Generate a simple session ID for anonymous tracking
async function getSessionId(req: NextRequest): Promise<string> {
  const cookieStore = await cookies();
  let sessionId = cookieStore.get('view_session')?.value;

  if (!sessionId) {
    sessionId = `anon_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  return sessionId;
}

// Hash IP for privacy-safe deduplication
function hashIP(ip: string): string {
  // Simple hash - in production you might use crypto
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    const char = ip.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    const supabase = await createClient();

    // Get user if authenticated
    const { data: { user } } = await supabase.auth.getUser();

    // Get session ID for deduplication
    const sessionId = await getSessionId(request);

    // Get IP hash for additional deduplication
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ip = forwardedFor?.split(',')[0] || 'unknown';
    const ipHash = hashIP(ip);

    // Get referrer and user agent
    const referrer = request.headers.get('referer') || null;
    const userAgent = request.headers.get('user-agent') || null;

    // Check if listing exists
    const { data: listing } = await supabase
      .from('listings')
      .select('id, user_id')
      .eq('id', listingId)
      .single();

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    // Don't count owner's own views
    if (user?.id === listing.user_id) {
      return NextResponse.json({ tracked: false, reason: 'owner_view' });
    }

    // Try to insert view (unique constraint will prevent duplicates)
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const { error: viewError } = await supabase
      .from('listing_views')
      .insert({
        listing_id: listingId,
        viewer_id: user?.id || null,
        session_id: sessionId,
        ip_hash: ipHash,
        user_agent: userAgent?.substring(0, 500), // Limit length
        referrer: referrer?.substring(0, 500),
        view_date: today,
      });

    if (viewError) {
      // Likely a duplicate view - that's okay
      if (viewError.code === '23505') {
        return NextResponse.json({ tracked: false, reason: 'duplicate' });
      }
      console.error('View tracking error:', viewError);
    }

    // Also increment the legacy views_count for backwards compatibility
    try {
      await supabase.rpc('increment_views', { listing_id: listingId });
    } catch {
      // Fallback if RPC doesn't exist - ignore errors
    }

    // Set session cookie for future tracking
    const response = NextResponse.json({ tracked: true });
    response.cookies.set('view_session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return response;
  } catch (error) {
    console.error('View tracking error:', error);
    return NextResponse.json({ error: 'Failed to track view' }, { status: 500 });
  }
}
