import { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { Truck, ChevronRight } from 'lucide-react';
import { ProductCard } from '@/components/new-trailers/ProductCard';
import type { ManufacturerProduct } from '@/types';

export const metadata: Metadata = {
  title: 'New Trailers | Browse Lowboy & Heavy Haul Trailers by Manufacturer | AxlonAI',
  description: 'Browse new lowboy trailers, heavy haul trailers, and specialized hauling equipment from top manufacturers like Trail King, Fontaine, Talbert, XL Specialized, and more.',
  openGraph: {
    title: 'New Trailers - Heavy Haul Trailer Catalog | AxlonAI',
    description: 'Browse new lowboy trailers from 13+ top manufacturers. Compare specs, tonnage, deck heights, and gooseneck types.',
  },
};

function createSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

interface ManufacturerWithProducts {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  short_description: string | null;
  products: ManufacturerProduct[];
}

export default async function NewTrailersPage() {
  const supabase = createSupabase();

  // Fetch manufacturers with products
  const { data: manufacturers } = await supabase
    .from('manufacturers')
    .select('id, name, slug, logo_url, short_description, product_count')
    .gt('product_count', 0)
    .eq('is_active', true)
    .order('name');

  // Fetch all active products with images and manufacturer info
  const { data: products } = await supabase
    .from('manufacturer_products')
    .select(`
      *,
      manufacturer:manufacturers!manufacturer_id(id, name, slug, logo_url),
      images:manufacturer_product_images(id, url, alt_text, is_primary, sort_order)
    `)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  // Group products by manufacturer
  const groupedByManufacturer: ManufacturerWithProducts[] = [];
  if (manufacturers && products) {
    for (const mfr of manufacturers) {
      const mfrProducts = products.filter(
        (p: any) => p.manufacturer?.id === mfr.id
      );
      if (mfrProducts.length > 0) {
        groupedByManufacturer.push({
          ...mfr,
          products: mfrProducts as ManufacturerProduct[],
        });
      }
    }
  }

  const totalProducts = products?.length || 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-12 md:py-16">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/20">
              <Truck className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold">New Trailers</h1>
          </div>
          <p className="text-lg text-slate-300 max-w-2xl">
            Browse the complete product catalog from America&apos;s top lowboy and heavy haul trailer manufacturers.
            Compare specs, tonnage ratings, deck heights, and more.
          </p>
          <div className="mt-4 flex items-center gap-4 text-sm text-slate-400">
            <span>{groupedByManufacturer.length} Manufacturers</span>
            <span className="w-1 h-1 rounded-full bg-slate-600" />
            <span>{totalProducts} Products</span>
          </div>
        </div>
      </div>

      {/* Products by Manufacturer */}
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
        {groupedByManufacturer.length === 0 ? (
          <div className="text-center py-16">
            <Truck className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h2 className="text-xl font-semibold mb-2">No products yet</h2>
            <p className="text-muted-foreground">
              Product catalog is being populated. Check back soon!
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            {groupedByManufacturer.map((mfr) => (
              <section key={mfr.id}>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold">{mfr.name}</h2>
                    {mfr.short_description && (
                      <p className="text-sm text-muted-foreground mt-1 max-w-xl line-clamp-1">
                        {mfr.short_description}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/manufacturers/${mfr.slug}`}
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    View Manufacturer
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {mfr.products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
