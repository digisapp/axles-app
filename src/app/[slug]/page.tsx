import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Metadata } from 'next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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
  Sparkles,
  Shield,
  Clock,
  Award,
  MessageSquare,
  ChevronDown,
  SlidersHorizontal,
  X,
  Truck,
  Building2,
  Star,
  ArrowUpRight,
  CheckCircle2,
} from 'lucide-react';
import { ChatWidget } from '@/components/storefront/ChatWidget';
import { DealerFilters } from '@/components/storefront/DealerFilters';
import { MobileContactBar } from '@/components/storefront/MobileContactBar';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://axles.ai';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    category?: string;
    q?: string;
    sort?: string;
    minPrice?: string;
    maxPrice?: string;
    minYear?: string;
    maxYear?: string;
    condition?: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
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

  const title = `${dealer.company_name} | AxlesAI`;
  const description = dealer.tagline || `Browse inventory from ${dealer.company_name} in ${dealer.city}, ${dealer.state}`;

  return {
    title,
    description,
    alternates: {
      canonical: `${baseUrl}/${slug}`,
    },
    openGraph: {
      title,
      description,
      url: `${baseUrl}/${slug}`,
      type: 'website',
    },
  };
}

// JSON-LD AutoDealer schema for rich search results
interface DealerForSchema {
  company_name: string;
  tagline?: string;
  about?: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
  website?: string;
  avatar_url?: string;
  social_links?: { facebook?: string; instagram?: string };
}

function DealerJsonLd({ dealer, slug }: { dealer: DealerForSchema; slug: string }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'AutoDealer',
    name: dealer.company_name,
    description: dealer.about || dealer.tagline,
    url: `${baseUrl}/${slug}`,
    ...(dealer.avatar_url && { logo: dealer.avatar_url }),
    ...(dealer.phone && { telephone: dealer.phone }),
    ...(dealer.email && { email: dealer.email }),
    ...((dealer.city || dealer.state) && {
      address: {
        '@type': 'PostalAddress',
        ...(dealer.city && { addressLocality: dealer.city }),
        ...(dealer.state && { addressRegion: dealer.state }),
        addressCountry: 'US',
      },
    }),
    sameAs: [
      dealer.website,
      dealer.social_links?.facebook,
      dealer.social_links?.instagram,
    ].filter(Boolean),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// BreadcrumbList JSON-LD for navigation
function DealerBreadcrumbJsonLd({ dealerName, slug }: { dealerName: string; slug: string }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: baseUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Dealers',
        item: `${baseUrl}/dealers`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: dealerName,
        item: `${baseUrl}/${slug}`,
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export default async function DealerStorefrontPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { category, q, sort, minPrice, maxPrice, minYear, maxYear, condition } = await searchParams;
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
    .eq('status', 'active');

  // Apply search filter
  if (q) {
    listingsQuery = listingsQuery.or(`title.ilike.%${q}%,make.ilike.%${q}%,model.ilike.%${q}%`);
  }

  // Apply price filters
  if (minPrice) {
    listingsQuery = listingsQuery.gte('price', parseInt(minPrice));
  }
  if (maxPrice) {
    listingsQuery = listingsQuery.lte('price', parseInt(maxPrice));
  }

  // Apply year filters
  if (minYear) {
    listingsQuery = listingsQuery.gte('year', parseInt(minYear));
  }
  if (maxYear) {
    listingsQuery = listingsQuery.lte('year', parseInt(maxYear));
  }

  // Apply condition filter
  if (condition) {
    listingsQuery = listingsQuery.eq('condition', condition);
  }

  // Apply sorting
  switch (sort) {
    case 'price-low':
      listingsQuery = listingsQuery.order('price', { ascending: true, nullsFirst: false });
      break;
    case 'price-high':
      listingsQuery = listingsQuery.order('price', { ascending: false, nullsFirst: false });
      break;
    case 'year-new':
      listingsQuery = listingsQuery.order('year', { ascending: false, nullsFirst: false });
      break;
    case 'year-old':
      listingsQuery = listingsQuery.order('year', { ascending: true, nullsFirst: false });
      break;
    default:
      listingsQuery = listingsQuery.order('created_at', { ascending: false });
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

  // Calculate stats
  const totalListings = listings?.length || 0;
  const newCount = listings?.filter(l => l.condition === 'new').length || 0;
  const usedCount = listings?.filter(l => l.condition === 'used').length || 0;

  // Get price range for filters
  const prices = listings?.map(l => l.price).filter(Boolean) as number[];
  const priceMin = prices.length ? Math.min(...prices) : 0;
  const priceMax = prices.length ? Math.max(...prices) : 500000;

  // Get year range for filters
  const years = listings?.map(l => l.year).filter(Boolean) as number[];
  const yearMin = years.length ? Math.min(...years) : 2000;
  const yearMax = years.length ? Math.max(...years) : new Date().getFullYear();

  // Check if any filters are active
  const hasActiveFilters = !!(minPrice || maxPrice || minYear || maxYear || condition);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* JSON-LD Structured Data */}
      <DealerJsonLd dealer={dealer as DealerForSchema} slug={slug} />
      <DealerBreadcrumbJsonLd dealerName={dealer.company_name} slug={slug} />

      {/* Subtle Background Pattern */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      {/* Hero Section */}
      <div className="relative">
        {/* Banner */}
        <div className="relative h-48 md:h-64 lg:h-72 overflow-hidden">
          {dealer.banner_url ? (
            <Image
              src={dealer.banner_url}
              alt={dealer.company_name}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/60 to-transparent" />
        </div>

        {/* Dealer Info Card */}
        <div className="relative max-w-7xl mx-auto px-4 -mt-24 md:-mt-32 pb-6">
          <div className="relative bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            {/* Main Info Row */}
            <div className="p-6 md:p-8">
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Left: Logo + Info */}
                <div className="flex flex-col sm:flex-row gap-5 flex-1">
                  {/* Logo */}
                  <div className="flex-shrink-0">
                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 shadow-lg flex items-center justify-center overflow-hidden ring-4 ring-white">
                      {dealer.avatar_url ? (
                        <Image
                          src={dealer.avatar_url}
                          alt={dealer.company_name}
                          width={96}
                          height={96}
                          className="object-contain"
                        />
                      ) : (
                        <span className="text-3xl md:text-4xl font-bold text-white">
                          {dealer.company_name?.charAt(0)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
                        {dealer.company_name}
                      </h1>
                      <Badge className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-0 px-2.5 py-0.5 text-xs shadow-sm">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Verified
                      </Badge>
                    </div>

                    {dealer.tagline && (
                      <p className="text-slate-500 mb-3 text-sm md:text-base">{dealer.tagline}</p>
                    )}

                    {/* Contact Row */}
                    <div className="flex flex-wrap gap-2 text-sm">
                      {(dealer.city || dealer.state) && (
                        <span className="flex items-center gap-1.5 text-slate-500">
                          <MapPin className="w-4 h-4" />
                          {[dealer.city, dealer.state].filter(Boolean).join(', ')}
                        </span>
                      )}
                      {dealer.phone && (
                        <a href={`tel:${dealer.phone}`} className="flex items-center gap-1.5 text-slate-600 hover:text-primary transition-colors">
                          <Phone className="w-4 h-4" />
                          {dealer.phone}
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: CTA Buttons */}
                <div className="flex flex-col sm:flex-row lg:flex-col gap-3 sm:items-start lg:items-stretch">
                  {dealer.phone && (
                    <Button size="lg" className="gap-2 shadow-md" asChild>
                      <a href={`tel:${dealer.phone}`}>
                        <Phone className="w-4 h-4" />
                        Call Now
                      </a>
                    </Button>
                  )}
                  {dealer.email && (
                    <Button size="lg" variant="outline" className="gap-2" asChild>
                      <a href={`mailto:${dealer.email}?subject=Inquiry from AxlesAI`}>
                        <Mail className="w-4 h-4" />
                        Email Dealer
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100 border-t border-slate-100 bg-slate-50/50">
              <div className="p-4 text-center">
                <p className="text-2xl font-bold text-slate-900">{totalListings}</p>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Vehicles</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">{newCount}</p>
                <p className="text-xs text-slate-500 uppercase tracking-wider">New</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-2xl font-bold text-slate-900">{usedCount}</p>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Used</p>
              </div>
              <div className="p-4 text-center">
                <div className="flex items-center justify-center gap-1">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <p className="text-lg font-bold text-slate-900">&lt;1hr</p>
                </div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Response</p>
              </div>
            </div>

            {/* Social Links + Website */}
            {(socialLinks.facebook || socialLinks.instagram || dealer.website) && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-white">
                <div className="flex items-center gap-2">
                  {socialLinks.facebook && (
                    <a
                      href={socialLinks.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-blue-500 hover:text-white transition-all"
                    >
                      <Facebook className="w-4 h-4" />
                    </a>
                  )}
                  {socialLinks.instagram && (
                    <a
                      href={socialLinks.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-pink-500 hover:text-white transition-all"
                    >
                      <Instagram className="w-4 h-4" />
                    </a>
                  )}
                </div>
                {dealer.website && (
                  <a
                    href={dealer.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-slate-600 hover:text-primary transition-colors"
                  >
                    <Globe className="w-4 h-4" />
                    Visit Website
                    <ArrowUpRight className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* About Section - Above Inventory */}
      {dealer.about && (
        <div className="relative max-w-7xl mx-auto px-4 pb-8">
          <Card className="bg-white/80 backdrop-blur border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="hidden sm:flex w-12 h-12 rounded-xl bg-slate-100 items-center justify-center flex-shrink-0">
                  <Building2 className="w-6 h-6 text-slate-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-slate-900 mb-2">
                    About {dealer.company_name}
                  </h2>
                  <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap line-clamp-4">
                    {dealer.about}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <div className="relative max-w-7xl mx-auto px-4 pb-8">
        {/* Search & Filters Bar */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm -mx-4 px-4 py-4 border-b border-slate-200 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <form className="flex-1 relative" action={`/${slug}`}>
              {/* Preserve other params */}
              {sort && <input type="hidden" name="sort" value={sort} />}
              {minPrice && <input type="hidden" name="minPrice" value={minPrice} />}
              {maxPrice && <input type="hidden" name="maxPrice" value={maxPrice} />}
              {minYear && <input type="hidden" name="minYear" value={minYear} />}
              {maxYear && <input type="hidden" name="maxYear" value={maxYear} />}
              {condition && <input type="hidden" name="condition" value={condition} />}

              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                name="q"
                placeholder="Search by make, model, or keyword..."
                defaultValue={q}
                className="h-12 pl-12 pr-4 bg-white border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-sm"
              />
            </form>

            {/* Filters */}
            <DealerFilters
              slug={slug}
              currentSort={sort}
              currentMinPrice={minPrice}
              currentMaxPrice={maxPrice}
              currentMinYear={minYear}
              currentMaxYear={maxYear}
              currentCondition={condition}
              priceRange={[priceMin, priceMax]}
              yearRange={[yearMin, yearMax]}
              hasActiveFilters={hasActiveFilters}
              searchQuery={q}
            />
          </div>

          {/* Category Pills */}
          <div className="flex flex-wrap gap-2 mt-4">
            <Link href={`/${slug}${q ? `?q=${q}` : ''}${sort ? `${q ? '&' : '?'}sort=${sort}` : ''}`}>
              <Badge
                className={`cursor-pointer px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  !category
                    ? 'bg-slate-900 text-white border-0 shadow-md'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <Package className="w-3 h-3 mr-1.5" />
                All ({totalListings})
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
                <Link key={cat} href={`/${slug}?category=${catSlug}${q ? `&q=${q}` : ''}${sort ? `&sort=${sort}` : ''}`}>
                  <Badge
                    className={`cursor-pointer px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
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
          <p className="text-slate-600">
            <span className="text-slate-900 font-semibold">{filteredListings?.length || 0}</span> vehicles
            {q && <span className="text-slate-500"> matching &quot;{q}&quot;</span>}
            {hasActiveFilters && (
              <Link
                href={`/${slug}${q ? `?q=${q}` : ''}${category ? `${q ? '&' : '?'}category=${category}` : ''}`}
                className="ml-2 text-primary text-sm hover:underline"
              >
                Clear filters
              </Link>
            )}
          </p>
        </div>

        {/* Listings Grid */}
        {filteredListings && filteredListings.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredListings.map((listing) => {
              const primaryImage = listing.images?.find((img: { is_primary: boolean }) => img.is_primary) || listing.images?.[0];
              const cat = Array.isArray(listing.category) ? listing.category[0] : listing.category;

              return (
                <Link key={listing.id} href={`/listing/${listing.id}`} className="group block">
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-lg hover:border-slate-300 transition-all duration-300 h-full">
                    {/* Image */}
                    <div className="relative aspect-[4/3] bg-slate-100">
                      {primaryImage ? (
                        <Image
                          src={primaryImage.thumbnail_url || primaryImage.url}
                          alt={listing.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Truck className="w-12 h-12 text-slate-300" />
                        </div>
                      )}

                      {/* Condition Badge */}
                      {listing.condition === 'new' && (
                        <Badge className="absolute top-2 left-2 bg-emerald-500 text-white border-0 text-xs shadow-md">
                          <Sparkles className="w-3 h-3 mr-1" />
                          New
                        </Badge>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-3 md:p-4">
                      <h3 className="font-semibold text-slate-900 text-sm md:text-base line-clamp-2 group-hover:text-primary transition-colors">
                        {listing.title}
                      </h3>

                      <p className="text-lg md:text-xl font-bold text-primary mt-1">
                        {listing.price ? `$${listing.price.toLocaleString()}` : 'Call for Price'}
                      </p>

                      <div className="flex flex-wrap gap-x-2 gap-y-1 mt-2 text-xs text-slate-500">
                        {listing.year && <span>{listing.year}</span>}
                        {listing.year && listing.mileage && <span>·</span>}
                        {listing.mileage && <span>{listing.mileage.toLocaleString()} mi</span>}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Search className="w-10 h-10 text-slate-300" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">No listings found</h2>
            <p className="text-slate-500 mb-4">
              {q ? `No results for "${q}"` : 'No vehicles match your filters'}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" asChild>
                <Link href={`/${slug}`}>Clear all filters</Link>
              </Button>
            )}
          </div>
        )}

        {/* Trust Badges */}
        <div className="mt-16 pt-8 border-t border-slate-200">
          <h3 className="text-center text-sm font-medium text-slate-400 uppercase tracking-wider mb-6">
            Why Choose {dealer.company_name}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Shield, label: 'Verified Dealer', desc: 'Trusted & vetted' },
              { icon: Award, label: 'Quality Inventory', desc: 'Inspected vehicles' },
              { icon: Clock, label: 'Fast Response', desc: 'Quick replies' },
              { icon: Sparkles, label: 'AI Powered', desc: '24/7 assistance' },
            ].map((item, i) => (
              <div
                key={i}
                className="text-center p-5 rounded-xl bg-white border border-slate-200 hover:border-primary/30 hover:shadow-lg transition-all duration-300"
              >
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                  <item.icon className="w-6 h-6 text-primary" />
                </div>
                <p className="font-semibold text-slate-900 mb-0.5 text-sm">{item.label}</p>
                <p className="text-xs text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile Contact Bar */}
      <MobileContactBar
        phone={dealer.phone}
        email={dealer.email}
        dealerName={dealer.company_name}
      />

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
