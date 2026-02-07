import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST - Dismiss an alert
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Update alert to dismissed
    const { error } = await supabase
      .from('floor_plan_alerts')
      .update({
        is_dismissed: true,
        dismissed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('dealer_id', user.id);

    if (error) {
      logger.error('Error dismissing alert', { error });
      return NextResponse.json({ error: 'Failed to dismiss alert' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Floor plan alert dismiss error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
