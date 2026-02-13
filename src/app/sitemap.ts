import { MetadataRoute } from 'next';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Use a simple client without cookies for sitemap generation
function createStaticClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

const LISTINGS_PER_PAGE = 5000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://axlon.ai';

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
      url: `${baseUrl}/deals`,
      lastModified: new Date(),
      changeFrequency: 'daily',
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
      url: `${baseUrl}/new-trailers`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/finance`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/trade-in`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];

  // Dynamic listing pages - fetch ALL active listings (paginated to avoid Supabase row limits)
  let listingPages: MetadataRoute.Sitemap = [];

  try {
    const supabase = createStaticClient();

    // First get total count
    const { count } = await supabase
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');

    const totalListings = count || 0;
    const pages = Math.ceil(totalListings / LISTINGS_PER_PAGE);

    // Fetch all listings in batches
    for (let i = 0; i < pages; i++) {
      const { data: listings } = await supabase
        .from('listings')
        .select('id, updated_at')
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .range(i * LISTINGS_PER_PAGE, (i + 1) * LISTINGS_PER_PAGE - 1);

      if (listings) {
        listingPages = listingPages.concat(
          listings.map((listing) => ({
            url: `${baseUrl}/listing/${listing.id}`,
            lastModified: new Date(listing.updated_at),
            changeFrequency: 'daily' as const,
            priority: 0.7,
          }))
        );
      }
    }
  } catch (error) {
    console.error('Error generating sitemap listings:', error);
  }

  // Category pages
  let categoryPages: MetadataRoute.Sitemap = [];

  try {
    const supabase = createStaticClient();

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
    const supabase = createStaticClient();

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
    const supabase = createStaticClient();

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

  // Manufacturer product pages
  let productPages: MetadataRoute.Sitemap = [];

  try {
    const supabase = createStaticClient();

    const { data: products } = await supabase
      .from('manufacturer_products')
      .select('slug, updated_at, manufacturers!inner(slug)')
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (products) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      productPages = products.map((product: any) => ({
        url: `${baseUrl}/new-trailers/${product.manufacturers.slug}/${product.slug}`,
        lastModified: product.updated_at ? new Date(product.updated_at) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }));
    }
  } catch (error) {
    console.error('Error generating sitemap products:', error);
  }

  return [
    ...staticPages,
    ...listingPages,
    ...categoryPages,
    ...manufacturerPages,
    ...dealerPages,
    ...productPages,
  ];
}
