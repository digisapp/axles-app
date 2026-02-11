import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ manufacturer: string; product: string }> }
) {
  try {
    const { manufacturer, product } = await params;

    const { data, error } = await supabase
      .from('manufacturer_products')
      .select(`
        *,
        manufacturers!inner(id, name, slug, logo_url, website, description, short_description),
        manufacturer_product_images(id, url, alt_text, is_primary, sort_order),
        manufacturer_product_specs(id, spec_category, spec_key, spec_value, spec_unit, sort_order)
      `)
      .eq('slug', product)
      .eq('manufacturers.slug', manufacturer)
      .eq('is_active', true)
      .order('sort_order', { referencedTable: 'manufacturer_product_images', ascending: true })
      .order('spec_category', { referencedTable: 'manufacturer_product_specs', ascending: true })
      .order('sort_order', { referencedTable: 'manufacturer_product_specs', ascending: true })
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('New trailer product detail API error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
