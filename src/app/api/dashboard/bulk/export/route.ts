import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const includeFields = searchParams.getAll('include');

    // Build query
    let query = supabase
      .from('listings')
      .select(`
        id,
        title,
        description,
        price,
        price_type,
        condition,
        year,
        make,
        model,
        vin,
        mileage,
        hours,
        city,
        state,
        zip_code,
        stock_number,
        quantity,
        lot_location,
        acquired_date,
        acquisition_cost,
        status,
        views_count,
        created_at,
        category:categories(name, slug)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: listings, error } = await query;

    if (error) {
      console.error('Error fetching listings:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!listings || listings.length === 0) {
      return new NextResponse('No listings to export', { status: 404 });
    }

    // Build CSV based on included fields
    const headers: string[] = ['id'];

    // Basic fields
    if (includeFields.includes('basic') || includeFields.length === 0) {
      headers.push('title', 'category', 'condition', 'status', 'description');
    }

    // Pricing fields
    if (includeFields.includes('pricing') || includeFields.length === 0) {
      headers.push('price', 'price_type');
    }

    // Specs fields
    if (includeFields.includes('specs') || includeFields.length === 0) {
      headers.push('year', 'make', 'model', 'vin', 'mileage', 'hours');
    }

    // Location fields
    if (includeFields.includes('location') || includeFields.length === 0) {
      headers.push('city', 'state', 'zip_code');
    }

    // Inventory fields
    if (includeFields.includes('inventory') || includeFields.length === 0) {
      headers.push('stock_number', 'quantity', 'lot_location', 'acquired_date', 'acquisition_cost');
    }

    // Add metadata
    headers.push('views_count', 'created_at');

    // Build CSV rows
    const rows = listings.map((listing) => {
      const row: string[] = [listing.id];

      // Handle category which can be array or object depending on Supabase response
      const category = Array.isArray(listing.category)
        ? listing.category[0]
        : listing.category;

      if (includeFields.includes('basic') || includeFields.length === 0) {
        row.push(
          escapeCSV(listing.title),
          escapeCSV(category?.slug || ''),
          escapeCSV(listing.condition || ''),
          escapeCSV(listing.status),
          escapeCSV(listing.description || '')
        );
      }

      if (includeFields.includes('pricing') || includeFields.length === 0) {
        row.push(
          listing.price?.toString() || '',
          escapeCSV(listing.price_type || '')
        );
      }

      if (includeFields.includes('specs') || includeFields.length === 0) {
        row.push(
          listing.year?.toString() || '',
          escapeCSV(listing.make || ''),
          escapeCSV(listing.model || ''),
          escapeCSV(listing.vin || ''),
          listing.mileage?.toString() || '',
          listing.hours?.toString() || ''
        );
      }

      if (includeFields.includes('location') || includeFields.length === 0) {
        row.push(
          escapeCSV(listing.city || ''),
          escapeCSV(listing.state || ''),
          escapeCSV(listing.zip_code || '')
        );
      }

      if (includeFields.includes('inventory') || includeFields.length === 0) {
        row.push(
          escapeCSV(listing.stock_number || ''),
          listing.quantity?.toString() || '1',
          escapeCSV(listing.lot_location || ''),
          listing.acquired_date || '',
          listing.acquisition_cost?.toString() || ''
        );
      }

      row.push(
        listing.views_count?.toString() || '0',
        listing.created_at
      );

      return row.join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="listings-export-${
          new Date().toISOString().split('T')[0]
        }.csv"`,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/dashboard/bulk/export:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function escapeCSV(value: string): string {
  if (!value) return '';
  // If value contains comma, newline, or quote, wrap in quotes and escape internal quotes
  if (value.includes(',') || value.includes('\n') || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
