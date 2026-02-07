// Revalidate every hour - categories change infrequently
export const revalidate = 3600;

import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import {
  Truck,
  Container,
  Wrench,
  Cog,
  ArrowRight,
} from 'lucide-react';

const categoryIcons: Record<string, React.ReactNode> = {
  'trucks': <Truck className="w-6 h-6 md:w-8 md:h-8" />,
  'trailers': <Container className="w-6 h-6 md:w-8 md:h-8" />,
  'heavy-equipment': <Wrench className="w-6 h-6 md:w-8 md:h-8" />,
  'components-parts': <Cog className="w-6 h-6 md:w-8 md:h-8" />,
};

export default async function CategoriesPage() {
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order');

  // Build category tree
  const parentCategories = categories?.filter((c) => !c.parent_id) || [];
  const categoryTree = parentCategories.map((parent) => ({
    ...parent,
    children: categories?.filter((c) => c.parent_id === parent.id) || [],
  }));

  // Get listing counts per category
  const { data: counts } = await supabase
    .from('listings')
    .select('category_id')
    .eq('status', 'active');

  const countMap = (counts || []).reduce((acc, listing) => {
    acc[listing.category_id] = (acc[listing.category_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const getCategoryCount = (categoryId: string, children?: Array<{ id: string }>) => {
    let count = countMap[categoryId] || 0;
    if (children) {
      children.forEach((child) => {
        count += countMap[child.id] || 0;
      });
    }
    return count;
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b">
        <div className="max-w-6xl mx-auto px-4 py-6 md:py-8 text-center">
          <h1 className="text-2xl md:text-3xl font-bold mb-1 md:mb-2">Browse Categories</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Find trucks, trailers, equipment, and parts
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 md:py-8">
        <div className="space-y-8 md:space-y-12">
          {categoryTree.map((parent) => (
            <div key={parent.id}>
              {/* Parent Category Header */}
              <Link
                href={`/search?category=${parent.slug}`}
                className="flex items-center gap-3 md:gap-4 mb-4 md:mb-6 group"
              >
                <div className="p-3 md:p-4 bg-primary/10 text-primary rounded-lg md:rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-colors flex-shrink-0">
                  {categoryIcons[parent.slug] || <Truck className="w-6 h-6 md:w-8 md:h-8" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg md:text-2xl font-bold group-hover:text-primary transition-colors truncate">
                    {parent.name}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {getCategoryCount(parent.id, parent.children)} listings
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 md:w-6 md:h-6 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
              </Link>

              {/* Subcategories Grid */}
              {parent.children.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4 ml-0 md:ml-16">
                  {parent.children.map((child: { id: string; name: string; slug: string }) => (
                    <Link key={child.id} href={`/search?category=${child.slug}`}>
                      <Card className="hover:border-primary hover:shadow-md transition-all cursor-pointer h-full">
                        <CardContent className="p-3 md:p-4">
                          <h3 className="font-medium text-sm md:text-base line-clamp-2">{child.name}</h3>
                          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                            {countMap[child.id] || 0} listings
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Popular Searches */}
        <div className="mt-12 md:mt-16">
          <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Popular Searches</h2>
          <div className="flex flex-wrap gap-2 md:gap-3">
            {[
              'Peterbilt 579',
              'Freightliner Cascadia',
              'Kenworth T680',
              'Volvo VNL',
              'Reefer Trailer',
              'Flatbed Trailer',
              'Dump Truck',
              'Box Truck',
              'Excavator',
              'Skid Steer',
            ].map((term) => (
              <Link
                key={term}
                href={`/search?q=${encodeURIComponent(term)}`}
                className="px-3 md:px-4 py-1.5 md:py-2 text-sm bg-background border rounded-full hover:border-primary hover:text-primary transition-colors"
              >
                {term}
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
