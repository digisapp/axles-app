import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MapPin,
  Phone,
  Mail,
  Globe,
  Facebook,
  Instagram,
  Search,
  Calendar,
  Gauge,
  Package,
  Star,
  ArrowRight,
  Sparkles,
  Shield,
  Clock,
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Ambient Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-400/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-purple-400/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-1/2 w-[600px] h-[400px] bg-pink-300/10 rounded-full blur-[120px]" />
      </div>

      {/* Hero Section */}
      <div className="relative">
        {/* Banner */}
        <div className="relative h-64 md:h-80 overflow-hidden">
          {dealer.banner_url ? (
            <Image
              src={dealer.banner_url}
              alt={dealer.company_name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/40 to-transparent" />
        </div>

        {/* Dealer Info Card - Glassmorphism Light */}
        <div className="relative max-w-7xl mx-auto px-4 -mt-32 md:-mt-40 pb-8">
          <div className="relative backdrop-blur-xl bg-white/70 border border-white/50 rounded-3xl p-6 md:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
            {/* Subtle Glow Border */}
            <div className="absolute -inset-[1px] bg-gradient-to-r from-blue-400/30 via-purple-400/30 to-pink-400/30 rounded-3xl blur-[2px] -z-10" />

            <div className="relative flex flex-col md:flex-row gap-6 items-start">
              {/* Logo */}
              <div className="relative group">
                <div className="absolute -inset-2 bg-gradient-to-r from-blue-400 to-purple-400 rounded-2xl blur-lg opacity-30 group-hover:opacity-50 transition-opacity" />
                <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-white shadow-lg border border-gray-100 flex items-center justify-center overflow-hidden">
                  {dealer.avatar_url ? (
                    <Image
                      src={dealer.avatar_url}
                      alt={dealer.company_name}
                      width={128}
                      height={128}
                      className="object-contain"
                    />
                  ) : (
                    <span className="text-4xl md:text-5xl font-bold bg-gradient-to-br from-blue-500 to-purple-500 bg-clip-text text-transparent">
                      {dealer.company_name?.charAt(0)}
                    </span>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
                    {dealer.company_name}
                  </h1>
                  <Badge className="bg-gradient-to-r from-blue-500 to-purple-500 text-white border-0 px-3 shadow-lg shadow-blue-500/25">
                    <Shield className="w-3 h-3 mr-1" />
                    Verified
                  </Badge>
                </div>

                {dealer.tagline && (
                  <p className="text-lg text-gray-500 mb-4">{dealer.tagline}</p>
                )}

                {/* Contact Pills */}
                <div className="flex flex-wrap gap-3">
                  {dealer.phone && (
                    <a
                      href={`tel:${dealer.phone}`}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/80 border border-gray-200 hover:border-blue-300 hover:bg-blue-50 hover:shadow-lg hover:shadow-blue-500/10 transition-all text-sm font-medium text-gray-700"
                    >
                      <Phone className="w-4 h-4 text-blue-500" />
                      {dealer.phone}
                    </a>
                  )}
                  {dealer.email && (
                    <a
                      href={`mailto:${dealer.email}`}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/80 border border-gray-200 hover:border-purple-300 hover:bg-purple-50 hover:shadow-lg hover:shadow-purple-500/10 transition-all text-sm font-medium text-gray-700"
                    >
                      <Mail className="w-4 h-4 text-purple-500" />
                      {dealer.email}
                    </a>
                  )}
                  {(dealer.city || dealer.state) && (
                    <span className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-gray-50 border border-gray-200 text-sm text-gray-500">
                      <MapPin className="w-4 h-4 text-pink-500" />
                      {[dealer.city, dealer.state].filter(Boolean).join(', ')}
                    </span>
                  )}
                  {dealer.website && (
                    <a
                      href={dealer.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/80 border border-gray-200 hover:border-green-300 hover:bg-green-50 hover:shadow-lg hover:shadow-green-500/10 transition-all text-sm font-medium text-gray-700"
                    >
                      <Globe className="w-4 h-4 text-green-500" />
                      Website
                    </a>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="flex md:flex-col gap-4 md:gap-3">
                <div className="text-center px-6 py-4 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200/50 shadow-sm">
                  <p className="text-2xl md:text-3xl font-bold bg-gradient-to-br from-blue-600 to-blue-400 bg-clip-text text-transparent">{listings?.length || 0}</p>
                  <p className="text-xs text-blue-600/60 uppercase tracking-wider font-medium">Listings</p>
                </div>
                <div className="text-center px-6 py-4 rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100/50 border border-purple-200/50 shadow-sm">
                  <p className="text-2xl md:text-3xl font-bold bg-gradient-to-br from-purple-600 to-purple-400 bg-clip-text text-transparent">{dealer.storefront_views || 0}</p>
                  <p className="text-xs text-purple-600/60 uppercase tracking-wider font-medium">Views</p>
                </div>
              </div>
            </div>

            {/* Social Links */}
            {(socialLinks.facebook || socialLinks.instagram) && (
              <div className="flex items-center gap-3 mt-6 pt-6 border-t border-gray-200/60">
                <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">Follow</span>
                {socialLinks.facebook && (
                  <a
                    href={socialLinks.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-blue-50 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-500/20 transition-all"
                  >
                    <Facebook className="w-5 h-5 text-gray-600" />
                  </a>
                )}
                {socialLinks.instagram && (
                  <a
                    href={socialLinks.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-pink-50 hover:border-pink-300 hover:shadow-lg hover:shadow-pink-500/20 transition-all"
                  >
                    <Instagram className="w-5 h-5 text-gray-600" />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative max-w-7xl mx-auto px-4 py-8">
        {/* Search & Filters */}
        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          <form className="flex-1 relative group" action={`/${slug}`}>
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-400/40 via-purple-400/40 to-pink-400/40 rounded-2xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity duration-300" />
            <div className="relative flex items-center">
              <Search className="absolute left-4 w-5 h-5 text-gray-400" />
              <Input
                name="q"
                placeholder={`Search inventory...`}
                defaultValue={q}
                className="h-14 pl-12 pr-4 bg-white/80 backdrop-blur-sm border-gray-200 rounded-2xl text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-gray-300 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm"
              />
            </div>
          </form>

          {/* Category Pills */}
          <div className="flex flex-wrap gap-2 items-center">
            <Link href={`/${slug}`}>
              <Badge
                className={`cursor-pointer px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
                  !category
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white border-0 shadow-lg shadow-blue-500/25'
                    : 'bg-white/80 border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                <Package className="w-3 h-3 mr-1.5" />
                All ({listings?.length || 0})
              </Badge>
            </Link>
            {categories.map((cat) => {
              const catSlug = cat.toLowerCase().replace(/\s+/g, '-');
              const count = listings?.filter((l) => {
                const c = Array.isArray(l.category) ? l.category[0] : l.category;
                return c?.name === cat;
              }).length;
              const isActive = category === catSlug;
              return (
                <Link key={cat} href={`/${slug}?category=${catSlug}`}>
                  <Badge
                    className={`cursor-pointer px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white border-0 shadow-lg shadow-blue-500/25'
                        : 'bg-white/80 border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    {cat} ({count})
                  </Badge>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Results Header */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-gray-500">
            <span className="text-gray-900 font-semibold">{filteredListings?.length || 0}</span> vehicles available
            {q && <span> matching &quot;{q}&quot;</span>}
          </p>
        </div>

        {/* Listings Grid */}
        {filteredListings && filteredListings.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-6">
            {filteredListings.map((listing) => {
              const primaryImage = listing.images?.find((img: { is_primary: boolean }) => img.is_primary) || listing.images?.[0];

              return (
                <Link key={listing.id} href={`/listing/${listing.id}`} className="group">
                  <div className="relative h-full">
                    {/* Card Glow on Hover */}
                    <div className="absolute -inset-2 bg-gradient-to-r from-blue-400/20 via-purple-400/20 to-pink-400/20 rounded-3xl opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500" />

                    <div className="relative h-full bg-white/80 backdrop-blur-sm border border-gray-200/80 rounded-2xl overflow-hidden group-hover:border-gray-300 group-hover:shadow-xl group-hover:shadow-gray-200/50 transition-all duration-300">
                      {/* Image */}
                      <div className="relative aspect-[4/3] overflow-hidden">
                        {primaryImage ? (
                          <Image
                            src={primaryImage.thumbnail_url || primaryImage.url}
                            alt={listing.title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
                            <Package className="w-12 h-12 text-gray-300" />
                          </div>
                        )}

                        {/* Overlay Gradient */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

                        {/* Badges */}
                        <div className="absolute top-3 left-3 flex gap-2">
                          {listing.condition === 'new' && (
                            <Badge className="bg-gradient-to-r from-emerald-400 to-green-500 text-white border-0 text-xs shadow-lg shadow-green-500/30">
                              <Sparkles className="w-3 h-3 mr-1" />
                              New
                            </Badge>
                          )}
                        </div>

                        {/* Price Tag */}
                        <div className="absolute bottom-3 left-3">
                          <div className="px-4 py-2 rounded-xl bg-white/95 backdrop-blur-sm shadow-lg">
                            <p className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                              {listing.price ? `$${listing.price.toLocaleString()}` : 'Call for Price'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-4">
                        <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1 mb-2">
                          {listing.title}
                        </h3>

                        <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                          {listing.year && (
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-gray-400" />
                              {listing.year}
                            </span>
                          )}
                          {listing.mileage && (
                            <span className="flex items-center gap-1.5">
                              <Gauge className="w-3.5 h-3.5 text-gray-400" />
                              {listing.mileage.toLocaleString()} mi
                            </span>
                          )}
                        </div>

                        {/* View Button */}
                        <div className="mt-4 flex items-center text-sm font-medium text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span>View Details</span>
                          <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 bg-blue-400/20 rounded-full blur-2xl" />
              <div className="relative w-20 h-20 rounded-full bg-white border border-gray-200 shadow-lg flex items-center justify-center">
                <Search className="w-10 h-10 text-gray-400" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No listings found</h2>
            <p className="text-gray-500">
              {q ? `No results for "${q}"` : 'This dealer has no active listings'}
            </p>
          </div>
        )}

        {/* About Section */}
        {dealer.about && (
          <div className="mt-16 pt-8 border-t border-gray-200/60">
            <div className="max-w-3xl">
              <h2 className="text-2xl font-bold mb-4">
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  About {dealer.company_name}
                </span>
              </h2>
              <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">{dealer.about}</p>
            </div>
          </div>
        )}

        {/* Trust Badges */}
        <div className="mt-16 pt-8 border-t border-gray-200/60">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Shield, label: 'Verified Dealer', desc: 'Trusted & Verified', color: 'blue' },
              { icon: Star, label: 'Quality Inventory', desc: 'Inspected Vehicles', color: 'amber' },
              { icon: Clock, label: 'Fast Response', desc: 'Quick Replies', color: 'green' },
              { icon: Sparkles, label: 'AI Powered', desc: '24/7 Assistance', color: 'purple' },
            ].map((item, i) => (
              <div
                key={i}
                className="text-center p-6 rounded-2xl bg-white/60 backdrop-blur-sm border border-gray-200/60 hover:bg-white hover:border-gray-300 hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-300 group"
              >
                <div className={`w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br ${
                  item.color === 'blue' ? 'from-blue-100 to-blue-50' :
                  item.color === 'amber' ? 'from-amber-100 to-amber-50' :
                  item.color === 'green' ? 'from-green-100 to-green-50' :
                  'from-purple-100 to-purple-50'
                } flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <item.icon className={`w-7 h-7 ${
                    item.color === 'blue' ? 'text-blue-500' :
                    item.color === 'amber' ? 'text-amber-500' :
                    item.color === 'green' ? 'text-green-500' :
                    'text-purple-500'
                  }`} />
                </div>
                <p className="font-semibold text-gray-900 mb-1">{item.label}</p>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
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
