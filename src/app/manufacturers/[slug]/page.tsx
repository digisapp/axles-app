import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Metadata } from 'next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ManufacturerListingGrid } from '@/components/listings/ManufacturerListingGrid';
import {
  Factory,
  Globe,
  MapPin,
  Calendar,
  Truck,
  Container,
  Cog,
  ExternalLink,
  ArrowRight,
  Package,
  Star,
  ArrowLeft,
  DollarSign,
} from 'lucide-react';
import { Manufacturer } from '@/types';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://axlon.ai';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: manufacturer } = await supabase
    .from('manufacturers')
    .select('name, short_description, equipment_types, logo_url')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (!manufacturer) {
    return { title: 'Not Found' };
  }

  const types = manufacturer.equipment_types.join(', ');
  const title = `${manufacturer.name} ${types.charAt(0).toUpperCase() + types.slice(1)} | AxlonAI`;
  const description = manufacturer.short_description || `Browse ${manufacturer.name} equipment on AxlonAI. Find trucks, trailers, and equipment.`;

  return {
    title,
    description,
    alternates: {
      canonical: `${baseUrl}/manufacturers/${slug}`,
    },
    openGraph: {
      title,
      description,
      url: `${baseUrl}/manufacturers/${slug}`,
      ...(manufacturer.logo_url && {
        images: [{ url: manufacturer.logo_url, alt: manufacturer.name }],
      }),
    },
  };
}

// JSON-LD Brand schema for rich search results
function ManufacturerJsonLd({ manufacturer, slug }: { manufacturer: Manufacturer; slug: string }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Brand',
    name: manufacturer.name,
    description: manufacturer.description || manufacturer.short_description,
    url: `${baseUrl}/manufacturers/${slug}`,
    ...(manufacturer.logo_url && { logo: manufacturer.logo_url }),
    ...(manufacturer.website && { sameAs: [manufacturer.website] }),
    ...(manufacturer.founded_year && { foundingDate: manufacturer.founded_year.toString() }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// BreadcrumbList JSON-LD for navigation
function BreadcrumbJsonLd({ manufacturerName, slug }: { manufacturerName: string; slug: string }) {
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
        name: 'Manufacturers',
        item: `${baseUrl}/manufacturers`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: manufacturerName,
        item: `${baseUrl}/manufacturers/${slug}`,
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

const EQUIPMENT_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  trucks: Truck,
  trailers: Container,
  'heavy-equipment': Cog,
};

export default async function ManufacturerPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  // Fetch manufacturer
  const { data: manufacturer } = await supabase
    .from('manufacturers')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (!manufacturer) {
    notFound();
  }

  // Fetch listings for this manufacturer
  const { data: listings, count: listingCount } = await supabase
    .from('listings')
    .select(`
      id,
      title,
      price,
      year,
      make,
      model,
      condition,
      mileage,
      hours,
      city,
      state,
      is_featured,
      created_at,
      images:listing_images(id, url, thumbnail_url, is_primary)
    `, { count: 'exact' })
    .ilike('make', manufacturer.canonical_name)
    .eq('status', 'active')
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(12);

  // Calculate average price
  const { data: priceData } = await supabase
    .from('listings')
    .select('price')
    .ilike('make', manufacturer.canonical_name)
    .eq('status', 'active')
    .not('price', 'is', null);

  const avgPrice = priceData && priceData.length > 0
    ? Math.round(priceData.reduce((sum, l) => sum + (l.price || 0), 0) / priceData.length)
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-gray-50 to-white dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      {/* JSON-LD Structured Data */}
      <ManufacturerJsonLd manufacturer={manufacturer as Manufacturer} slug={slug} />
      <BreadcrumbJsonLd manufacturerName={manufacturer.name} slug={slug} />

      {/* Background Pattern */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-300/20 rounded-full blur-[150px]" />
      </div>

      {/* Hero Header */}
      <div className={`relative border-b ${
        manufacturer.is_featured
          ? 'bg-gradient-to-br from-amber-600 via-amber-700 to-amber-800 border-amber-500'
          : 'bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 border-slate-700'
      }`}>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div className="relative max-w-7xl mx-auto px-4 py-8 md:py-12">
          {/* Back Link */}
          <Link
            href="/manufacturers"
            className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            All Manufacturers
          </Link>

          <div className="flex flex-col md:flex-row md:items-start gap-6">
            {/* Logo */}
            <div className={`w-24 h-24 md:w-32 md:h-32 rounded-2xl flex items-center justify-center overflow-hidden shadow-xl ${
              manufacturer.is_featured ? 'bg-white' : 'bg-slate-700'
            }`}>
              {manufacturer.logo_url ? (
                <Image
                  src={manufacturer.logo_url}
                  alt={manufacturer.name}
                  width={128}
                  height={128}
                  className="object-contain p-2"
                />
              ) : (
                <Factory className={`w-12 h-12 ${manufacturer.is_featured ? 'text-amber-600' : 'text-slate-400'}`} />
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                  {manufacturer.name}
                </h1>
                {manufacturer.is_featured && (
                  <Badge className="bg-white text-amber-700">
                    <Star className="w-3 h-3 mr-1 fill-amber-500 text-amber-500" />
                    Featured
                  </Badge>
                )}
              </div>

              {manufacturer.short_description && (
                <p className="text-lg text-white/80 mb-4 max-w-2xl">
                  {manufacturer.short_description}
                </p>
              )}

              {/* Quick Info */}
              <div className="flex flex-wrap gap-4 text-sm text-white/70">
                {manufacturer.headquarters && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    {manufacturer.headquarters}
                  </span>
                )}
                {manufacturer.founded_year && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    Founded {manufacturer.founded_year}
                  </span>
                )}
                {manufacturer.website && (
                  <a
                    href={manufacturer.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 hover:text-white transition-colors"
                  >
                    <Globe className="w-4 h-4" />
                    Official Website
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {/* Equipment Types */}
              <div className="flex flex-wrap gap-2 mt-4">
                {manufacturer.equipment_types.map((type: string) => {
                  const Icon = EQUIPMENT_TYPE_ICONS[type] || Package;
                  return (
                    <Badge
                      key={type}
                      className={`${
                        manufacturer.is_featured
                          ? 'bg-white/20 text-white border-white/30'
                          : 'bg-slate-700 text-slate-200 border-slate-600'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 mr-1.5" />
                      {type === 'heavy-equipment' ? 'Heavy Equipment' : type.charAt(0).toUpperCase() + type.slice(1)}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <Card className="dark:bg-zinc-900 dark:border-zinc-700">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{listingCount || 0}</p>
                <p className="text-sm text-slate-600 dark:text-zinc-400">Available Listings</p>
              </div>
            </CardContent>
          </Card>

          {avgPrice && (
            <Card className="dark:bg-zinc-900 dark:border-zinc-700">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                  <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">${avgPrice.toLocaleString()}</p>
                  <p className="text-sm text-slate-600 dark:text-zinc-400">Average Price</p>
                </div>
              </CardContent>
            </Card>
          )}

          {manufacturer.country && (
            <Card className="dark:bg-zinc-900 dark:border-zinc-700">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
                  <Globe className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{manufacturer.country}</p>
                  <p className="text-sm text-slate-600 dark:text-zinc-400">Headquarters</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Description */}
        {manufacturer.description && (
          <Card className="mb-8 dark:bg-zinc-900 dark:border-zinc-700">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">About {manufacturer.name}</h2>
              <p className="text-slate-600 dark:text-zinc-400 leading-relaxed">{manufacturer.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Listings Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Available {manufacturer.name} Equipment
            </h2>
            {(listingCount || 0) > 12 && (
              <Link href={`/search?make=${encodeURIComponent(manufacturer.canonical_name)}`}>
                <Button variant="outline">
                  View All {listingCount} Listings
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            )}
          </div>

          {listings && listings.length > 0 ? (
            <ManufacturerListingGrid listings={listings} />
          ) : (
            <Card className="dark:bg-zinc-900 dark:border-zinc-700">
              <CardContent className="py-12 text-center">
                <Package className="w-12 h-12 text-slate-300 dark:text-zinc-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  No Listings Available
                </h3>
                <p className="text-slate-600 dark:text-zinc-400 mb-4">
                  There are currently no {manufacturer.name} listings on AxlonAI.
                </p>
                <Link href="/search">
                  <Button variant="outline">Browse All Equipment</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        {/* View All CTA */}
        {(listingCount || 0) > 0 && (
          <div className="text-center">
            <Link href={`/search?make=${encodeURIComponent(manufacturer.canonical_name)}`}>
              <Button size="lg" className="gap-2">
                Search All {manufacturer.name} Equipment
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
