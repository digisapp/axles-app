import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, rateLimitResponse } from '@/lib/security/rate-limit';
import { logger } from '@/lib/logger';

// POST - Query internal dealer data (for authenticated staff via AI)
export async function POST(request: NextRequest) {
  try {
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, {
      ...RATE_LIMITS.standard,
      prefix: 'ratelimit:dealer-internal',
    });
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const supabase = await createClient();
    const body = await request.json();

    const {
      dealer_id,
      staff_id,
      query_type, // 'inventory', 'lead', 'leads', 'customer', 'pricing', 'stats'
      query, // Natural language query or specific lookup
      filters, // Optional filters
    } = body;

    // Validate required fields
    if (!dealer_id || !staff_id || !query_type) {
      return NextResponse.json(
        { error: 'Dealer ID, staff ID, and query type are required' },
        { status: 400 }
      );
    }

    // Verify staff member exists and is active
    const { data: staff } = await supabase
      .from('dealer_staff')
      .select('*')
      .eq('id', staff_id)
      .eq('dealer_id', dealer_id)
      .eq('is_active', true)
      .single();

    if (!staff) {
      return NextResponse.json(
        { error: 'Invalid staff credentials' },
        { status: 401 }
      );
    }

    let result: Record<string, unknown> = {};

    switch (query_type) {
      case 'inventory':
        result = await queryInventory(supabase, dealer_id, staff, query, filters);
        break;

      case 'lead':
      case 'leads':
        result = await queryLeads(supabase, dealer_id, staff, query, filters);
        break;

      case 'customer':
        result = await queryCustomer(supabase, dealer_id, staff, query);
        break;

      case 'pricing':
        result = await queryPricing(supabase, dealer_id, staff, query);
        break;

      case 'stats':
        result = await queryStats(supabase, dealer_id, staff);
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid query type' },
          { status: 400 }
        );
    }

    // Log the access
    await supabase.from('dealer_staff_access_logs').insert({
      dealer_id,
      staff_id,
      query_type,
      query: query?.substring(0, 500),
      response_summary: result.summary || `${query_type} query`,
      auth_success: true,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Error querying internal data', { error });
    return NextResponse.json(
      { error: 'Failed to query data' },
      { status: 500 }
    );
  }
}

// Query inventory
async function queryInventory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dealerId: string,
  staff: Record<string, unknown>,
  query?: string,
  filters?: Record<string, unknown>
) {
  let dbQuery = supabase
    .from('listings')
    .select(`
      id, title, price, year, make, model, condition, status,
      stock_number, vin, mileage, hours, city, state,
      acquisition_cost, created_at,
      category:categories(name)
    `)
    .eq('user_id', dealerId)
    .order('created_at', { ascending: false });

  // Apply filters
  if (filters?.status) {
    dbQuery = dbQuery.eq('status', filters.status);
  }
  if (filters?.make) {
    dbQuery = dbQuery.ilike('make', `%${filters.make}%`);
  }
  if (filters?.stock_number) {
    dbQuery = dbQuery.eq('stock_number', filters.stock_number);
  }
  if (filters?.max_price) {
    dbQuery = dbQuery.lte('price', filters.max_price);
  }

  dbQuery = dbQuery.limit(20);

  const { data: listings, error } = await dbQuery;

  if (error) throw error;

  // Format listings based on permissions
  const formattedListings = listings?.map(listing => {
    const base: Record<string, unknown> = {
      id: listing.id,
      title: listing.title,
      stock_number: listing.stock_number,
      year: listing.year,
      make: listing.make,
      model: listing.model,
      price: listing.price ? `$${listing.price.toLocaleString()}` : 'Call for price',
      condition: listing.condition,
      status: listing.status,
      mileage: listing.mileage ? `${listing.mileage.toLocaleString()} miles` : null,
      location: [listing.city, listing.state].filter(Boolean).join(', '),
    };

    // Include cost if permitted
    if (staff.can_view_costs && listing.acquisition_cost) {
      base.acquisition_cost = `$${(listing.acquisition_cost as number).toLocaleString()}`;
    }

    // Include margin if permitted
    if (staff.can_view_margins && listing.acquisition_cost && listing.price) {
      const margin = (listing.price as number) - (listing.acquisition_cost as number);
      const marginPct = ((margin / (listing.acquisition_cost as number)) * 100).toFixed(1);
      base.margin = `$${margin.toLocaleString()} (${marginPct}%)`;
    }

    return base;
  });

  return {
    type: 'inventory',
    count: listings?.length || 0,
    listings: formattedListings,
    summary: `Found ${listings?.length || 0} listings`,
  };
}

// Query leads
async function queryLeads(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dealerId: string,
  staff: Record<string, unknown>,
  query?: string,
  filters?: Record<string, unknown>
) {
  let dbQuery = supabase
    .from('leads')
    .select(`
      id, buyer_name, buyer_email, buyer_phone, message,
      status, priority, intent, created_at,
      listings(id, title, price)
    `)
    .eq('user_id', dealerId)
    .order('created_at', { ascending: false });

  // Apply filters
  if (filters?.status) {
    dbQuery = dbQuery.eq('status', filters.status);
  }
  if (filters?.today) {
    const today = new Date().toISOString().split('T')[0];
    dbQuery = dbQuery.gte('created_at', today);
  }

  dbQuery = dbQuery.limit(20);

  const { data: leads, error } = await dbQuery;

  if (error) throw error;

  const formattedLeads = leads?.map(lead => {
    const listing = Array.isArray(lead.listings) ? lead.listings[0] : lead.listings;
    return {
      id: lead.id,
      name: lead.buyer_name,
      email: lead.buyer_email,
      phone: lead.buyer_phone,
      message: lead.message?.substring(0, 100),
      status: lead.status,
      priority: lead.priority,
      intent: lead.intent,
      listing: listing?.title,
      received: new Date(lead.created_at).toLocaleString(),
    };
  });

  return {
    type: 'leads',
    count: leads?.length || 0,
    leads: formattedLeads,
    summary: `Found ${leads?.length || 0} leads`,
  };
}

// Query specific customer
async function queryCustomer(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dealerId: string,
  staff: Record<string, unknown>,
  query?: string
) {
  if (!query) {
    return { type: 'customer', error: 'Customer name or phone required' };
  }

  // Search leads for customer info
  const { data: leads } = await supabase
    .from('leads')
    .select(`
      id, buyer_name, buyer_email, buyer_phone, message,
      status, intent, created_at,
      listings(id, title, price)
    `)
    .eq('user_id', dealerId)
    .or(`buyer_name.ilike.%${query}%,buyer_phone.ilike.%${query}%,buyer_email.ilike.%${query}%`)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!leads || leads.length === 0) {
    return {
      type: 'customer',
      found: false,
      summary: `No customer found matching "${query}"`,
    };
  }

  // Group by customer
  const customer = leads[0];
  const history = leads.map(l => {
    const listing = Array.isArray(l.listings) ? l.listings[0] : l.listings;
    return {
      date: new Date(l.created_at).toLocaleDateString(),
      listing: listing?.title,
      status: l.status,
      intent: l.intent,
    };
  });

  return {
    type: 'customer',
    found: true,
    customer: {
      name: customer.buyer_name,
      email: customer.buyer_email,
      phone: customer.buyer_phone,
      total_inquiries: leads.length,
      last_contact: new Date(customer.created_at).toLocaleDateString(),
      history,
    },
    summary: `Found ${customer.buyer_name} with ${leads.length} inquiries`,
  };
}

// Query pricing info for a listing
async function queryPricing(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dealerId: string,
  staff: Record<string, unknown>,
  query?: string
) {
  if (!query) {
    return { type: 'pricing', error: 'Stock number or listing ID required' };
  }

  const { data: listing } = await supabase
    .from('listings')
    .select('id, title, price, ai_price_estimate, acquisition_cost, stock_number')
    .eq('user_id', dealerId)
    .or(`stock_number.eq.${query},id.eq.${query}`)
    .single();

  if (!listing) {
    return {
      type: 'pricing',
      found: false,
      summary: `No listing found for "${query}"`,
    };
  }

  const result: Record<string, unknown> = {
    type: 'pricing',
    found: true,
    listing: {
      title: listing.title,
      stock_number: listing.stock_number,
      asking_price: listing.price ? `$${listing.price.toLocaleString()}` : 'Not set',
      market_value: listing.ai_price_estimate
        ? `$${listing.ai_price_estimate.toLocaleString()}`
        : 'Unknown',
    },
  };

  // Add cost info if permitted
  if (staff.can_view_costs && listing.acquisition_cost) {
    (result.listing as Record<string, unknown>).acquisition_cost = `$${listing.acquisition_cost.toLocaleString()}`;
  }

  // Add margin if permitted
  if (staff.can_view_margins && listing.acquisition_cost && listing.price) {
    const margin = listing.price - listing.acquisition_cost;
    const marginPct = ((margin / listing.acquisition_cost) * 100).toFixed(1);
    (result.listing as Record<string, unknown>).margin = `$${margin.toLocaleString()} (${marginPct}%)`;
    (result.listing as Record<string, unknown>).min_price = `$${(listing.acquisition_cost * 1.1).toLocaleString()} (10% margin)`;
  }

  result.summary = `Pricing for ${listing.title}`;

  return result;
}

// Query dealer stats
async function queryStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dealerId: string,
  staff: Record<string, unknown>
) {
  // Get listing counts
  const { count: totalListings } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', dealerId);

  const { count: activeListings } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', dealerId)
    .eq('status', 'active');

  // Get lead counts
  const { count: totalLeads } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', dealerId);

  const { count: newLeads } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', dealerId)
    .eq('status', 'new');

  const today = new Date().toISOString().split('T')[0];
  const { count: todayLeads } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', dealerId)
    .gte('created_at', today);

  return {
    type: 'stats',
    stats: {
      inventory: {
        total: totalListings || 0,
        active: activeListings || 0,
      },
      leads: {
        total: totalLeads || 0,
        new: newLeads || 0,
        today: todayLeads || 0,
      },
    },
    summary: `${activeListings} active listings, ${newLeads} new leads (${todayLeads} today)`,
  };
}
