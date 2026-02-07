import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, notify_email, notify_frequency } = body;

    const { data: search, error } = await supabase
      .from('saved_searches')
      .update({
        name,
        notify_email,
        notify_frequency,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating saved search', { error });
      return NextResponse.json({ error: 'Failed to update saved search' }, { status: 500 });
    }

    return NextResponse.json({ search });
  } catch (error) {
    logger.error('Update saved search error', { error });
    return NextResponse.json({ error: 'Failed to update saved search' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('saved_searches')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      logger.error('Error deleting saved search', { error });
      return NextResponse.json({ error: 'Failed to delete saved search' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Delete saved search error', { error });
    return NextResponse.json({ error: 'Failed to delete saved search' }, { status: 500 });
  }
}
