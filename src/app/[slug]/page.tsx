import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  MapPin,
  Phone,
  Mail,
  Globe,
  Clock,
  Facebook,
  Instagram,
  Search,
  Calendar,
  Gauge,
  MessageCircle,
} from 'lucide-react';
import { ChatWidget } from '@/components/storefront/ChatWidget';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ category?: string; q?: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: dealer } = await supabase
    .from('profiles')
    .select('company_name, tagline, city, state')
    .eq('slug', slug)
    .eq('is_dealer', true)
    .single();

  if (!dealer) {
    return { title: 'Not Found' };
  }

  return {
    title: `${dealer.company_name} | AxlesAI`,
    description: dealer.tagline || `Browse inventory from ${dealer.company_name} in ${dealer.city}, ${dealer.state}`,
  };
}

export default async function DealerStorefrontPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { category, q } = await searchParams;
  const supabase = await createClient();

  // Fetch dealer profile
  const { data: dealer } = await supabase
    .from('profiles')
    .select('*')
    .eq('slug', slug)
    .eq('is_dealer', true)
    .single();

  if (!dealer) {
    notFound();
  }

  // Increment view count (fire and forget)
  supabase
    .from('profiles')
    .update({ storefront_views: (dealer.storefront_views || 0) + 1 })
    .eq('id', dealer.id)
    .then(() => {});

  // Fetch dealer's listings
  let listingsQuery = supabase
    .from('listings')
    .select(`
      *,
      images:listing_images(id, url, thumbnail_url, is_primary, sort_order),
      category:categories(name, slug)
    `)
    .eq('user_id', dealer.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  // Apply search filter
  if (q) {
    listingsQuery = listingsQuery.or(`title.ilike.%${q}%,make.ilike.%${q}%,model.ilike.%${q}%`);
  }

  const { data: listings } = await listingsQuery;

  // Get unique categories from listings
  const categorySet = new Set<string>();
  listings?.forEach((listing) => {
    const cat = Array.isArray(listing.category) ? listing.category[0] : listing.category;
    if (cat?.name) categorySet.add(cat.name);
  });
  const categories = Array.from(categorySet);

  // Filter by category if selected
  const filteredListings = category
    ? listings?.filter((l) => {
        const cat = Array.isArray(l.category) ? l.category[0] : l.category;
        return cat?.slug === category;
      })
    : listings;

  // Parse social links
  const socialLinks = dealer.social_links || {};

  // Parse business hours
  const businessHours = dealer.business_hours || {};

  // Get storefront settings
  const settings = dealer.storefront_settings || {};
  const primaryColor = settings.primaryColor || '#000000';

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Banner */}
      <div className="relative h-48 md:h-64 bg-gradient-to-r from-gray-900 to-gray-700">
        {dealer.banner_url && (
          <Image
            src={dealer.banner_url}
            alt={dealer.company_name}
            fill
            className="object-cover opacity-80"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Dealer Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8">
          <div className="max-w-7xl mx-auto flex items-end gap-4">
            {/* Logo */}
            <div className="w-20 h-20 md:w-28 md:h-28 rounded-xl bg-white shadow-lg flex items-center justify-center overflow-hidden flex-shrink-0">
              {dealer.avatar_url ? (
                <Image
                  src={dealer.avatar_url}
                  alt={dealer.company_name}
                  width={112}
                  height={112}
                  className="object-contain"
                />
              ) : (
                <span className="text-3xl md:text-4xl font-bold text-gray-400">
                  {dealer.company_name?.charAt(0)}
                </span>
              )}
            </div>

            {/* Name & Tagline */}
            <div className="text-white mb-2">
              <h1 className="text-2xl md:text-4xl font-bold">{dealer.company_name}</h1>
              {dealer.tagline && (
                <p className="text-white/80 mt-1 text-sm md:text-base">{dealer.tagline}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Contact Bar */}
      <div className="bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-4 md:gap-6 text-sm">
          {dealer.phone && (
            <a href={`tel:${dealer.phone}`} className="flex items-center gap-2 hover:text-primary">
              <Phone className="w-4 h-4" />
              <span className="hidden sm:inline">{dealer.phone}</span>
              <span className="sm:hidden">Call</span>
            </a>
          )}
          {dealer.email && (
            <a href={`mailto:${dealer.email}`} className="flex items-center gap-2 hover:text-primary">
              <Mail className="w-4 h-4" />
              <span className="hidden sm:inline">{dealer.email}</span>
              <span className="sm:hidden">Email</span>
            </a>
          )}
          {(dealer.city || dealer.state) && (
            <span className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4" />
              {[dealer.city, dealer.state].filter(Boolean).join(', ')}
            </span>
          )}
          {dealer.website && (
            <a
              href={dealer.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-primary"
            >
              <Globe className="w-4 h-4" />
              <span className="hidden sm:inline">Website</span>
            </a>
          )}

          {/* Social Links */}
          <div className="flex items-center gap-3 ml-auto">
            {socialLinks.facebook && (
              <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer">
                <Facebook className="w-5 h-5 text-muted-foreground hover:text-primary" />
              </a>
            )}
            {socialLinks.instagram && (
              <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer">
                <Instagram className="w-5 h-5 text-muted-foreground hover:text-primary" />
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 md:py-8">
        {/* Search & Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <form className="flex-1 relative" action={`/${slug}`}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              name="q"
              placeholder={`Search ${dealer.company_name}'s inventory...`}
              defaultValue={q}
              className="pl-10 h-12"
            />
          </form>

          {/* Category Pills */}
          <div className="flex flex-wrap gap-2">
            <Link href={`/${slug}`}>
              <Badge
                variant={!category ? 'default' : 'secondary'}
                className="cursor-pointer px-3 py-1.5"
              >
                All ({listings?.length || 0})
              </Badge>
            </Link>
            {categories.map((cat) => {
              const catSlug = cat.toLowerCase().replace(/\s+/g, '-');
              const count = listings?.filter((l) => {
                const c = Array.isArray(l.category) ? l.category[0] : l.category;
                return c?.name === cat;
              }).length;
              return (
                <Link key={cat} href={`/${slug}?category=${catSlug}`}>
                  <Badge
                    variant={category === catSlug ? 'default' : 'secondary'}
                    className="cursor-pointer px-3 py-1.5"
                  >
                    {cat} ({count})
                  </Badge>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Inventory Count */}
        <p className="text-muted-foreground mb-4">
          {filteredListings?.length || 0} listings
          {q && ` matching "${q}"`}
          {category && ` in ${category.replace(/-/g, ' ')}`}
        </p>

        {/* Listings Grid */}
        {filteredListings && filteredListings.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {filteredListings.map((listing) => {
              const primaryImage = listing.images?.find((img: { is_primary: boolean }) => img.is_primary) || listing.images?.[0];

              return (
                <Link key={listing.id} href={`/listing/${listing.id}`}>
                  <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full">
                    <div className="relative aspect-[4/3]">
                      {primaryImage ? (
                        <Image
                          src={primaryImage.thumbnail_url || primaryImage.url}
                          alt={listing.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <span className="text-muted-foreground text-xs">No Image</span>
                        </div>
                      )}
                      {listing.condition === 'new' && (
                        <Badge className="absolute top-2 left-2 bg-green-500 text-white text-xs">
                          New
                        </Badge>
                      )}
                    </div>

                    <div className="p-3">
                      <h3 className="font-semibold text-sm line-clamp-1">{listing.title}</h3>
                      <p className="text-lg font-bold text-primary mt-1">
                        {listing.price ? `$${listing.price.toLocaleString()}` : 'Call'}
                      </p>

                      <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                        {listing.year && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {listing.year}
                          </span>
                        )}
                        {listing.mileage && (
                          <span className="flex items-center gap-1">
                            <Gauge className="w-3 h-3" />
                            {listing.mileage.toLocaleString()} mi
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No listings found</h2>
            <p className="text-muted-foreground">
              {q ? `No results for "${q}"` : 'This dealer has no active listings'}
            </p>
          </div>
        )}

        {/* About Section */}
        {dealer.about && (
          <div className="mt-12 pt-8 border-t">
            <h2 className="text-xl font-semibold mb-4">About {dealer.company_name}</h2>
            <p className="text-muted-foreground whitespace-pre-wrap">{dealer.about}</p>
          </div>
        )}
      </div>

      {/* AI Chat Widget */}
      {dealer.chat_enabled && (
        <ChatWidget
          dealerId={dealer.id}
          dealerName={dealer.company_name}
          chatSettings={dealer.chat_settings}
        />
      )}
    </div>
  );
}
