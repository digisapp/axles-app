import { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://axles.ai';

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/search`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/categories`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/manufacturers`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/dealers`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  // Dynamic listing pages
  let listingPages: MetadataRoute.Sitemap = [];

  try {
    const supabase = await createClient();

    const { data: listings } = await supabase
      .from('listings')
      .select('id, updated_at')
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1000);

    if (listings) {
      listingPages = listings.map((listing) => ({
        url: `${baseUrl}/listing/${listing.id}`,
        lastModified: new Date(listing.updated_at),
        changeFrequency: 'daily' as const,
        priority: 0.7,
      }));
    }
  } catch (error) {
    console.error('Error generating sitemap listings:', error);
  }

  // Category pages
  let categoryPages: MetadataRoute.Sitemap = [];

  try {
    const supabase = await createClient();

    const { data: categories } = await supabase
      .from('categories')
      .select('slug');

    if (categories) {
      categoryPages = categories.map((cat) => ({
        url: `${baseUrl}/search?category=${cat.slug}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.6,
      }));
    }
  } catch (error) {
    console.error('Error generating sitemap categories:', error);
  }

  // Manufacturer pages
  let manufacturerPages: MetadataRoute.Sitemap = [];

  try {
    const supabase = await createClient();

    const { data: manufacturers } = await supabase
      .from('manufacturers')
      .select('slug, updated_at')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (manufacturers) {
      manufacturerPages = manufacturers.map((mfr) => ({
        url: `${baseUrl}/manufacturers/${mfr.slug}`,
        lastModified: mfr.updated_at ? new Date(mfr.updated_at) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }));
    }
  } catch (error) {
    console.error('Error generating sitemap manufacturers:', error);
  }

  // Dealer storefront pages
  let dealerPages: MetadataRoute.Sitemap = [];

  try {
    const supabase = await createClient();

    const { data: dealers } = await supabase
      .from('profiles')
      .select('slug, updated_at')
      .eq('is_dealer', true)
      .not('slug', 'is', null)
      .order('company_name', { ascending: true });

    if (dealers) {
      dealerPages = dealers.map((dealer) => ({
        url: `${baseUrl}/${dealer.slug}`,
        lastModified: dealer.updated_at ? new Date(dealer.updated_at) : new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.7,
      }));
    }
  } catch (error) {
    console.error('Error generating sitemap dealers:', error);
  }

  return [
    ...staticPages,
    ...listingPages,
    ...categoryPages,
    ...manufacturerPages,
    ...dealerPages,
  ];
}
