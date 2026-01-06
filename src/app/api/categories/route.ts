import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: categories, error } = await supabase
      .from('categories')
      .select('id, name, slug, parent_id, icon, sort_order')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching categories:', error);
      return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
    }

    // Build category tree structure
    const parentCategories = categories?.filter(c => !c.parent_id) || [];
    const tree = parentCategories.map(parent => ({
      ...parent,
      children: categories?.filter(c => c.parent_id === parent.id) || [],
    }));

    return NextResponse.json({
      data: categories,
      tree,
    });
  } catch (error) {
    console.error('Categories API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
