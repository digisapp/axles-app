import { createClient } from '@/lib/supabase/server';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  MapPin,
  Phone,
  Package,
  Search,
  Store,
  ArrowRight,
} from 'lucide-react';

export const metadata = {
  title: 'Dealer Directory | AxlesAI',
  description: 'Browse trusted truck and equipment dealers on AxlesAI',
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
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-background border-b">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-2">
            <Store className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">Dealer Directory</h1>
          </div>
          <p className="text-muted-foreground">
            Browse trusted truck and equipment dealers
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Search & Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <form className="flex-1 relative" action="/dealers">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              name="q"
              placeholder="Search dealers by name or location..."
              defaultValue={q}
              className="pl-10 h-12"
            />
            {state && <input type="hidden" name="state" value={state} />}
          </form>

          {/* State Filter */}
          <div className="flex flex-wrap gap-2">
            <Link href="/dealers">
              <Badge
                variant={!state ? 'default' : 'secondary'}
                className="cursor-pointer px-3 py-1.5"
              >
                All States
              </Badge>
            </Link>
            {states.slice(0, 10).map((s) => (
              <Link key={s} href={`/dealers?state=${s}${q ? `&q=${q}` : ''}`}>
                <Badge
                  variant={state === s ? 'default' : 'secondary'}
                  className="cursor-pointer px-3 py-1.5"
                >
                  {s}
                </Badge>
              </Link>
            ))}
          </div>
        </div>

        {/* Results Count */}
        <p className="text-muted-foreground mb-6">
          {dealers?.length || 0} dealers found
          {q && ` matching "${q}"`}
          {state && ` in ${state}`}
        </p>

        {/* Dealers Grid */}
        {dealers && dealers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dealers.map((dealer) => (
              <Link key={dealer.id} href={`/${dealer.slug}`}>
                <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer overflow-hidden">
                  <CardContent className="p-0">
                    {/* Dealer Header */}
                    <div className="p-6">
                      <div className="flex items-start gap-4">
                        {/* Logo */}
                        <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                          {dealer.avatar_url ? (
                            <Image
                              src={dealer.avatar_url}
                              alt={dealer.company_name || 'Dealer'}
                              width={64}
                              height={64}
                              className="object-contain"
                            />
                          ) : (
                            <span className="text-2xl font-bold text-muted-foreground">
                              {dealer.company_name?.charAt(0) || 'D'}
                            </span>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-lg truncate">
                            {dealer.company_name || 'Dealer'}
                          </h3>
                          {dealer.tagline && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                              {dealer.tagline}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Location & Stats */}
                      <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
                        {(dealer.city || dealer.state) && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {[dealer.city, dealer.state].filter(Boolean).join(', ')}
                          </span>
                        )}
                        {dealer.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-4 h-4" />
                            {dealer.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 bg-muted/50 border-t flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <Package className="w-4 h-4 text-primary" />
                        <span className="font-medium">
                          {countMap[dealer.id] || 0} listings
                        </span>
                      </div>
                      <span className="text-sm text-primary flex items-center gap-1">
                        View Inventory
                        <ArrowRight className="w-4 h-4" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Store className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No dealers found</h2>
            <p className="text-muted-foreground">
              {q ? `No results for "${q}"` : 'No dealers have set up storefronts yet'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
