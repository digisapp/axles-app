import { createClient } from '@/lib/supabase/server';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Search,
  Factory,
  ArrowRight,
  Star,
  Truck,
  Container,
  Cog,
  Globe,
  MapPin,
  Calendar,
} from 'lucide-react';
import { Manufacturer } from '@/types';

export const metadata = {
  title: 'Manufacturer Directory | AxlonAI',
  description: 'Browse leading truck, trailer, and equipment manufacturers. Research brands before you buy.',
};

interface PageProps {
  searchParams: Promise<{ q?: string; type?: string }>;
}

const EQUIPMENT_TYPES = [
  { value: 'trucks', label: 'Trucks', icon: Truck },
  { value: 'trailers', label: 'Trailers', icon: Container },
  { value: 'heavy-equipment', label: 'Heavy Equipment', icon: Cog },
];

export default async function ManufacturersPage({ searchParams }: PageProps) {
  const { q, type } = await searchParams;
  const supabase = await createClient();

  // Fetch manufacturers
  let query = supabase
    .from('manufacturers')
    .select('*')
    .eq('is_active', true)
    .order('is_featured', { ascending: false })
    .order('feature_tier', { ascending: false })
    .order('listing_count', { ascending: false })
    .order('name', { ascending: true });

  // Apply search filter
  if (q) {
    query = query.or(`name.ilike.%${q}%,canonical_name.ilike.%${q}%`);
  }

  // Apply equipment type filter
  if (type) {
    query = query.contains('equipment_types', [type]);
  }

  const { data: manufacturers } = await query;

  // Get listing counts for each manufacturer
  const updatedManufacturers: Manufacturer[] = [];
  if (manufacturers) {
    for (const mfr of manufacturers) {
      const { count } = await supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .ilike('make', mfr.canonical_name)
        .eq('status', 'active');

      updatedManufacturers.push({
        ...mfr,
        listing_count: count || 0,
      });
    }
  }

  // Separate featured and regular manufacturers
  const featuredManufacturers = updatedManufacturers.filter(m => m.is_featured);
  const regularManufacturers = updatedManufacturers.filter(m => !m.is_featured);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-gray-50 to-white">
      {/* Background Pattern */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-300/20 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-amber-200/10 rounded-full blur-[150px]" />
      </div>

      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 border-b border-slate-700">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div className="relative max-w-7xl mx-auto px-4 py-12 md:py-16">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center">
              <Factory className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Manufacturer Directory</h1>
          </div>
          <p className="text-slate-400 text-lg max-w-2xl">
            Research leading truck, trailer, and equipment manufacturers. Find equipment from the brands you trust.
          </p>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 py-8">
        {/* Search & Filters */}
        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          <form className="flex-1 relative" action="/manufacturers">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              name="q"
              placeholder="Search manufacturers..."
              defaultValue={q}
              className="h-12 pl-12 pr-4 bg-white border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all shadow-sm"
            />
            {type && <input type="hidden" name="type" value={type} />}
          </form>

          {/* Equipment Type Filter */}
          <div className="flex flex-wrap gap-2 items-center">
            <Link href="/manufacturers">
              <Badge
                className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  !type
                    ? 'bg-slate-900 text-white border-0 shadow-md'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                All
              </Badge>
            </Link>
            {EQUIPMENT_TYPES.map((et) => (
              <Link key={et.value} href={`/manufacturers?type=${et.value}${q ? `&q=${q}` : ''}`}>
                <Badge
                  className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                    type === et.value
                      ? 'bg-slate-900 text-white border-0 shadow-md'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <et.icon className="w-3.5 h-3.5" />
                  {et.label}
                </Badge>
              </Link>
            ))}
          </div>
        </div>

        {/* Results Count */}
        <p className="text-slate-500 mb-6">
          <span className="text-slate-900 font-semibold">{updatedManufacturers.length}</span> manufacturers found
          {q && ` matching "${q}"`}
          {type && ` in ${EQUIPMENT_TYPES.find(t => t.value === type)?.label || type}`}
        </p>

        {/* Featured Manufacturers */}
        {featuredManufacturers.length > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" />
              Featured Manufacturers
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {featuredManufacturers.map((manufacturer) => (
                <ManufacturerCard key={manufacturer.id} manufacturer={manufacturer} featured />
              ))}
            </div>
          </div>
        )}

        {/* All Manufacturers Grid */}
        {regularManufacturers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {regularManufacturers.map((manufacturer) => (
              <ManufacturerCard key={manufacturer.id} manufacturer={manufacturer} />
            ))}
          </div>
        ) : !featuredManufacturers.length ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-slate-100 flex items-center justify-center">
              <Factory className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">No manufacturers found</h2>
            <p className="text-slate-500">
              {q ? `No results for "${q}"` : 'Check back soon for manufacturer listings'}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ManufacturerCard({ manufacturer, featured = false }: { manufacturer: Manufacturer; featured?: boolean }) {
  return (
    <Link href={`/manufacturers/${manufacturer.slug}`} className="group">
      <div className={`h-full bg-white border rounded-xl overflow-hidden hover:shadow-xl transition-all duration-300 ${
        featured
          ? 'border-amber-300 hover:border-amber-400'
          : 'border-slate-200 hover:border-slate-300'
      }`}>
        {/* Manufacturer Header */}
        <div className="p-5">
          <div className="flex items-start gap-4">
            {/* Logo */}
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 shadow-md ${
              featured ? 'bg-gradient-to-br from-amber-400 to-amber-600' : 'bg-gradient-to-br from-slate-700 to-slate-900'
            }`}>
              {manufacturer.logo_url ? (
                <Image
                  src={manufacturer.logo_url}
                  alt={manufacturer.name}
                  width={56}
                  height={56}
                  className="object-contain"
                />
              ) : (
                <span className="text-xl font-bold text-white">
                  {manufacturer.name.charAt(0)}
                </span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className={`font-semibold truncate transition-colors ${
                  featured
                    ? 'text-slate-900 group-hover:text-amber-600'
                    : 'text-slate-900 group-hover:text-blue-600'
                }`}>
                  {manufacturer.name}
                </h3>
                {featured && (
                  <Star className="w-4 h-4 text-amber-500 flex-shrink-0 fill-amber-500" />
                )}
              </div>
              {manufacturer.short_description && (
                <p className="text-sm text-slate-500 line-clamp-2">
                  {manufacturer.short_description}
                </p>
              )}
            </div>
          </div>

          {/* Equipment Types & Info */}
          <div className="flex flex-wrap gap-2 mt-4">
            {manufacturer.equipment_types.map((type) => (
              <Badge key={type} variant="secondary" className="text-xs">
                {type === 'heavy-equipment' ? 'Heavy Equipment' : type.charAt(0).toUpperCase() + type.slice(1)}
              </Badge>
            ))}
          </div>

          {/* Details */}
          <div className="flex flex-wrap gap-3 mt-3 text-sm text-slate-500">
            {manufacturer.headquarters && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {manufacturer.headquarters}
              </span>
            )}
            {manufacturer.founded_year && (
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Est. {manufacturer.founded_year}
              </span>
            )}
            {manufacturer.website && (
              <span className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                Website
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={`px-5 py-3 border-t flex items-center justify-between ${
          featured ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              featured ? 'bg-amber-500' : 'bg-slate-900'
            }`}>
              <Truck className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-medium text-slate-700">
              {manufacturer.listing_count} listings
            </span>
          </div>
          <span className={`text-sm font-medium flex items-center gap-1 transition-colors ${
            featured
              ? 'text-amber-600 group-hover:text-amber-700'
              : 'text-slate-400 group-hover:text-blue-500'
          }`}>
            View Brand
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </span>
        </div>
      </div>
    </Link>
  );
}
