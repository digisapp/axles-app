import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    // Fetch all active products for aggregation
    const { data: products, error } = await supabase
      .from('manufacturer_products')
      .select('product_type, gooseneck_type, tonnage_min, tonnage_max, axle_count, deck_height_inches')
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching filter data', error);
      return NextResponse.json(
        { error: 'Failed to fetch filter options' },
        { status: 500 }
      );
    }

    const items = products || [];

    // Product types with counts
    const productTypeCounts = new Map<string, number>();
    for (const p of items) {
      if (p.product_type) {
        productTypeCounts.set(p.product_type, (productTypeCounts.get(p.product_type) || 0) + 1);
      }
    }
    const product_types = Array.from(productTypeCounts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value));

    // Gooseneck types with counts
    const gooseneckCounts = new Map<string, number>();
    for (const p of items) {
      if (p.gooseneck_type) {
        gooseneckCounts.set(p.gooseneck_type, (gooseneckCounts.get(p.gooseneck_type) || 0) + 1);
      }
    }
    const gooseneck_types = Array.from(gooseneckCounts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value));

    // Tonnage range
    let tonnageMinVal: number | null = null;
    let tonnageMaxVal: number | null = null;
    for (const p of items) {
      if (p.tonnage_min !== null && p.tonnage_min !== undefined) {
        tonnageMinVal = tonnageMinVal === null ? p.tonnage_min : Math.min(tonnageMinVal, p.tonnage_min);
      }
      if (p.tonnage_max !== null && p.tonnage_max !== undefined) {
        tonnageMaxVal = tonnageMaxVal === null ? p.tonnage_max : Math.max(tonnageMaxVal, p.tonnage_max);
      }
    }
    const tonnage_range = { min: tonnageMinVal, max: tonnageMaxVal };

    // Distinct axle counts sorted
    const axleSet = new Set<number>();
    for (const p of items) {
      if (p.axle_count !== null && p.axle_count !== undefined) {
        axleSet.add(p.axle_count);
      }
    }
    const axle_counts = Array.from(axleSet).sort((a, b) => a - b);

    // Distinct deck heights sorted
    const deckHeightSet = new Set<number>();
    for (const p of items) {
      if (p.deck_height_inches !== null && p.deck_height_inches !== undefined) {
        deckHeightSet.add(p.deck_height_inches);
      }
    }
    const deck_heights = Array.from(deckHeightSet).sort((a, b) => a - b);

    return NextResponse.json({
      data: {
        product_types,
        gooseneck_types,
        tonnage_range,
        axle_counts,
        deck_heights,
      },
    });
  } catch (error) {
    console.error('New trailers filters API error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
