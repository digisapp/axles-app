import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      category,
      price,
      condition,
      year,
      make,
      model,
      mileage,
      vin,
      description,
      city,
      state,
      stock_number,
      acquisition_cost,
    } = body;

    // Validate required fields
    if (!title || !category || price === undefined || !condition) {
      return NextResponse.json(
        { error: 'Missing required fields: title, category, price, condition' },
        { status: 400 }
      );
    }

    // Get category ID from slug
    const { data: categoryData } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', category)
      .single();

    if (!categoryData) {
      return NextResponse.json(
        { error: `Category not found: ${category}` },
        { status: 400 }
      );
    }

    // Create the listing
    const { data: listing, error } = await supabase
      .from('listings')
      .insert({
        user_id: user.id,
        category_id: categoryData.id,
        title,
        price,
        condition,
        year,
        make,
        model,
        mileage,
        vin,
        description,
        city,
        state,
        stock_number,
        acquisition_cost,
        status: 'draft', // Start as draft so user can review
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating listing', { error });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(listing, { status: 201 });
  } catch (error) {
    logger.error('Error in POST /api/dashboard/bulk/import', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
