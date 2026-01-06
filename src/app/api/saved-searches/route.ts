import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: searches, error } = await supabase
      .from('saved_searches')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching saved searches:', error);
      return NextResponse.json({ error: 'Failed to fetch saved searches' }, { status: 500 });
    }

    return NextResponse.json({ searches });
  } catch (error) {
    console.error('Saved searches API error:', error);
    return NextResponse.json({ error: 'Failed to fetch saved searches' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, query, filters, notify_email, notify_frequency } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const { data: search, error } = await supabase
      .from('saved_searches')
      .insert({
        user_id: user.id,
        name,
        query: query || null,
        filters: filters || {},
        notify_email: notify_email !== false,
        notify_frequency: notify_frequency || 'daily',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating saved search:', error);
      return NextResponse.json({ error: 'Failed to save search' }, { status: 500 });
    }

    return NextResponse.json({ search });
  } catch (error) {
    console.error('Create saved search error:', error);
    return NextResponse.json({ error: 'Failed to save search' }, { status: 500 });
  }
}
