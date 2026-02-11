import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    const { data: manufacturers, error } = await supabase
      .from('manufacturers')
      .select('id, name, slug, logo_url, short_description, product_count')
      .gt('product_count', 0)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching manufacturers with products', error);
      return NextResponse.json(
        { error: 'Failed to fetch manufacturers' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: manufacturers || [] });
  } catch (error) {
    console.error('New trailers manufacturers API error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
