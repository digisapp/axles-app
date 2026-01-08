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
  Award,
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
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-gray-50 to-white">
      {/* Subtle Background Pattern */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-slate-300/20 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-amber-200/10 rounded-full blur-[150px]" />
      </div>

      {/* Hero Section */}
      <div className="relative">
        {/* Banner */}
        <div className="relative h-56 md:h-72 overflow-hidden">
          {dealer.banner_url ? (
            <Image
              src={dealer.banner_url}
              alt={dealer.company_name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-100 via-slate-100/50 to-transparent" />
        </div>

        {/* Dealer Info Card */}
        <div className="relative max-w-7xl mx-auto px-4 -mt-28 md:-mt-36 pb-8">
          <div className="relative bg-white rounded-2xl p-6 md:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-gray-200/60">

            <div className="flex flex-col md:flex-row gap-6 items-start">
              {/* Logo */}
              <div className="relative">
                <div className="w-24 h-24 md:w-28 md:h-28 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 shadow-xl flex items-center justify-center overflow-hidden border-2 border-white">
                  {dealer.avatar_url ? (
                    <Image
                      src={dealer.avatar_url}
                      alt={dealer.company_name}
                      width={112}
                      height={112}
                      className="object-contain"
                    />
                  ) : (
                    <span className="text-4xl md:text-5xl font-bold text-white">
                      {dealer.company_name?.charAt(0)}
                    </span>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
                    {dealer.company_name}
                  </h1>
                  <Badge className="bg-gradient-to-r from-amber-500 to-amber-600 text-white border-0 px-3 py-1 shadow-sm">
                    <Shield className="w-3 h-3 mr-1" />
                    Verified
                  </Badge>
                </div>

                {dealer.tagline && (
                  <p className="text-base text-slate-500 mb-4">{dealer.tagline}</p>
                )}

                {/* Contact Pills */}
                <div className="flex flex-wrap gap-2">
                  {dealer.phone && (
                    <a
                      href={`tel:${dealer.phone}`}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 transition-all text-sm font-medium text-slate-700"
                    >
                      <Phone className="w-4 h-4 text-slate-500" />
                      {dealer.phone}
                    </a>
                  )}
                  {dealer.email && (
                    <a
                      href={`mailto:${dealer.email}`}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 transition-all text-sm font-medium text-slate-700"
                    >
                      <Mail className="w-4 h-4 text-slate-500" />
                      {dealer.email}
                    </a>
                  )}
                  {(dealer.city || dealer.state) && (
                    <span className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-500">
                      <MapPin className="w-4 h-4" />
                      {[dealer.city, dealer.state].filter(Boolean).join(', ')}
                    </span>
                  )}
                  {dealer.website && (
                    <a
                      href={dealer.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 transition-all text-sm font-medium text-slate-700"
                    >
                      <Globe className="w-4 h-4 text-slate-500" />
                      Website
                    </a>
                  )}
                </div>
              </div>

            </div>

            {/* Social Links */}
            {(socialLinks.facebook || socialLinks.instagram) && (
              <div className="flex items-center gap-3 mt-6 pt-6 border-t border-slate-200">
                <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">Follow</span>
                {socialLinks.facebook && (
                  <a
                    href={socialLinks.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-800 hover:text-white transition-all"
                  >
                    <Facebook className="w-4 h-4" />
                  </a>
                )}
                {socialLinks.instagram && (
                  <a
                    href={socialLinks.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-800 hover:text-white transition-all"
                  >
                    <Instagram className="w-4 h-4" />
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
          <form className="flex-1 relative" action={`/${slug}`}>
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              name="q"
              placeholder={`Search inventory...`}
              defaultValue={q}
              className="h-12 pl-12 pr-4 bg-white border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all shadow-sm"
            />
          </form>

          {/* Category Pills */}
          <div className="flex flex-wrap gap-2 items-center">
            <Link href={`/${slug}`}>
              <Badge
                className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  !category
                    ? 'bg-slate-900 text-white border-0 shadow-md'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
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
                    className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-slate-900 text-white border-0 shadow-md'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
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
          <p className="text-slate-500">
            <span className="text-slate-900 font-semibold">{filteredListings?.length || 0}</span> vehicles available
            {q && <span> matching &quot;{q}&quot;</span>}
          </p>
        </div>

        {/* Listings Grid */}
        {filteredListings && filteredListings.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredListings.map((listing) => {
              const primaryImage = listing.images?.find((img: { is_primary: boolean }) => img.is_primary) || listing.images?.[0];

              return (
                <Link key={listing.id} href={`/listing/${listing.id}`} className="group">
                  <div className="h-full bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-xl hover:border-slate-300 transition-all duration-300">
                    {/* Image */}
                    <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                      {primaryImage ? (
                        <Image
                          src={primaryImage.thumbnail_url || primaryImage.url}
                          alt={listing.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-12 h-12 text-slate-300" />
                        </div>
                      )}

                      {/* Badges */}
                      <div className="absolute top-3 left-3 flex gap-2">
                        {listing.condition === 'new' && (
                          <Badge className="bg-emerald-500 text-white border-0 text-xs shadow-md">
                            <Sparkles className="w-3 h-3 mr-1" />
                            New
                          </Badge>
                        )}
                      </div>

                      {/* Price Tag */}
                      <div className="absolute bottom-3 left-3">
                        <div className="px-3 py-1.5 rounded-lg bg-slate-900/90 backdrop-blur-sm">
                          <p className="text-lg font-bold text-white">
                            {listing.price ? `$${listing.price.toLocaleString()}` : 'Call'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <h3 className="font-semibold text-slate-900 group-hover:text-amber-600 transition-colors line-clamp-1 mb-2">
                        {listing.title}
                      </h3>

                      <div className="flex flex-wrap gap-3 text-sm text-slate-500">
                        {listing.year && (
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            {listing.year}
                          </span>
                        )}
                        {listing.mileage && (
                          <span className="flex items-center gap-1.5">
                            <Gauge className="w-3.5 h-3.5" />
                            {listing.mileage.toLocaleString()} mi
                          </span>
                        )}
                      </div>

                      {/* View Button */}
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs text-slate-400 uppercase tracking-wider">Details</span>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-slate-100 flex items-center justify-center">
              <Search className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">No listings found</h2>
            <p className="text-slate-500">
              {q ? `No results for "${q}"` : 'This dealer has no active listings'}
            </p>
          </div>
        )}

        {/* About Section */}
        {dealer.about && (
          <div className="mt-16 pt-8 border-t border-slate-200">
            <div className="max-w-3xl">
              <h2 className="text-xl font-bold text-slate-900 mb-4">
                About {dealer.company_name}
              </h2>
              <p className="text-slate-600 whitespace-pre-wrap leading-relaxed">{dealer.about}</p>
            </div>
          </div>
        )}

        {/* Trust Badges */}
        <div className="mt-16 pt-8 border-t border-slate-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Shield, label: 'Verified Dealer', desc: 'Trusted & Verified' },
              { icon: Award, label: 'Quality Inventory', desc: 'Inspected Vehicles' },
              { icon: Clock, label: 'Fast Response', desc: 'Quick Replies' },
              { icon: Sparkles, label: 'AI Powered', desc: '24/7 Assistance' },
            ].map((item, i) => (
              <div
                key={i}
                className="text-center p-5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-lg transition-all duration-300"
              >
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-slate-900 flex items-center justify-center">
                  <item.icon className="w-6 h-6 text-amber-400" />
                </div>
                <p className="font-semibold text-slate-900 mb-0.5">{item.label}</p>
                <p className="text-xs text-slate-500">{item.desc}</p>
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
