import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - List all active floor plan providers
export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('floor_plan_providers')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching floor plan providers:', error);
      return NextResponse.json({ error: 'Failed to fetch providers' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Floor plan providers error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
