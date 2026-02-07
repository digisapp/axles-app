import { createClient } from '@/lib/supabase/server';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  MapPin,
  Phone,
  Package,
  Search,
  Store,
  ArrowRight,
  Shield,
  Building2,
} from 'lucide-react';

export const metadata = {
  title: 'Dealer Directory | AxlonAI',
  description: 'Browse trusted truck and equipment dealers on AxlonAI',
};

interface PageProps {
  searchParams: Promise<{ q?: string; state?: string }>;
}

export default async function DealersPage({ searchParams }: PageProps) {
  const { q, state } = await searchParams;
  const supabase = await createClient();

  // Fetch dealers with storefronts
  let query = supabase
    .from('profiles')
    .select(`
      id,
      company_name,
      slug,
      tagline,
      avatar_url,
      city,
      state,
      phone,
      storefront_views
    `)
    .eq('is_dealer', true)
    .not('slug', 'is', null)
    .order('storefront_views', { ascending: false });

  // Apply search filter
  if (q) {
    query = query.or(`company_name.ilike.%${q}%,city.ilike.%${q}%,tagline.ilike.%${q}%`);
  }

  // Apply state filter
  if (state) {
    query = query.eq('state', state.toUpperCase());
  }

  const { data: dealers } = await query;

  // Get listing counts for each dealer
  const dealerIds = dealers?.map(d => d.id) || [];
  const { data: listingCounts } = await supabase
    .from('listings')
    .select('user_id')
    .in('user_id', dealerIds)
    .eq('status', 'active');

  // Count listings per dealer
  const countMap: Record<string, number> = {};
  listingCounts?.forEach(l => {
    countMap[l.user_id] = (countMap[l.user_id] || 0) + 1;
  });

  // Get unique states for filter
  const { data: statesData } = await supabase
    .from('profiles')
    .select('state')
    .eq('is_dealer', true)
    .not('slug', 'is', null)
    .not('state', 'is', null);

  const states = [...new Set(statesData?.map(s => s.state).filter(Boolean))].sort();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-gray-50 to-white">
      {/* Background Pattern */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-slate-300/20 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-amber-200/10 rounded-full blur-[150px]" />
      </div>

      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 border-b border-slate-700">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div className="relative max-w-7xl mx-auto px-4 py-12 md:py-16">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Dealer Directory</h1>
          </div>
          <p className="text-slate-400 text-lg max-w-2xl">
            Browse verified truck and equipment dealers. Find quality inventory from trusted professionals.
          </p>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 py-8">
        {/* Search & Filters */}
        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          <form className="flex-1 relative" action="/dealers">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              name="q"
              placeholder="Search dealers by name or location..."
              defaultValue={q}
              className="h-12 pl-12 pr-4 bg-white border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all shadow-sm"
            />
            {state && <input type="hidden" name="state" value={state} />}
          </form>

          {/* State Filter */}
          <div className="flex flex-wrap gap-2 items-center">
            <Link href="/dealers">
              <Badge
                className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  !state
                    ? 'bg-slate-900 text-white border-0 shadow-md'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                All States
              </Badge>
            </Link>
            {states.slice(0, 10).map((s) => (
              <Link key={s} href={`/dealers?state=${s}${q ? `&q=${q}` : ''}`}>
                <Badge
                  className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    state === s
                      ? 'bg-slate-900 text-white border-0 shadow-md'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  {s}
                </Badge>
              </Link>
            ))}
          </div>
        </div>

        {/* Results Count */}
        <p className="text-slate-500 mb-6">
          <span className="text-slate-900 font-semibold">{dealers?.length || 0}</span> dealers found
          {q && ` matching "${q}"`}
          {state && ` in ${state}`}
        </p>

        {/* Dealers Grid */}
        {dealers && dealers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {dealers.map((dealer) => (
              <Link key={dealer.id} href={`/${dealer.slug}`} className="group">
                <div className="h-full bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-xl hover:border-slate-300 transition-all duration-300">
                  {/* Dealer Header */}
                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      {/* Logo */}
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-md">
                        {dealer.avatar_url ? (
                          <Image
                            src={dealer.avatar_url}
                            alt={dealer.company_name || 'Dealer'}
                            width={56}
                            height={56}
                            className="object-contain"
                          />
                        ) : (
                          <span className="text-xl font-bold text-white">
                            {dealer.company_name?.charAt(0) || 'D'}
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-900 truncate group-hover:text-amber-600 transition-colors">
                            {dealer.company_name || 'Dealer'}
                          </h3>
                          <Shield className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        </div>
                        {dealer.tagline && (
                          <p className="text-sm text-slate-500 line-clamp-2">
                            {dealer.tagline}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Location & Phone */}
                    <div className="flex flex-wrap gap-3 mt-4 text-sm text-slate-500">
                      {(dealer.city || dealer.state) && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" />
                          {[dealer.city, dealer.state].filter(Boolean).join(', ')}
                        </span>
                      )}
                      {dealer.phone && (
                        <span className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5" />
                          {dealer.phone}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center">
                        <Package className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                      <span className="text-sm font-medium text-slate-700">
                        {countMap[dealer.id] || 0} listings
                      </span>
                    </div>
                    <span className="text-sm font-medium text-slate-400 flex items-center gap-1 group-hover:text-amber-500 transition-colors">
                      View Inventory
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-slate-100 flex items-center justify-center">
              <Store className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">No dealers found</h2>
            <p className="text-slate-500">
              {q ? `No results for "${q}"` : 'No dealers have set up storefronts yet'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
