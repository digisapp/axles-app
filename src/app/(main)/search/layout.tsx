import type { Metadata } from 'next';

interface SearchLayoutProps {
  children: React.ReactNode;
  params: Promise<Record<string, string>>;
}

// Category-specific SEO content
const categoryMeta: Record<string, { title: string; description: string }> = {
  'lowboy-trailers': {
    title: 'Lowboy Trailers for Sale',
    description: 'Browse lowboy trailers for sale. Compare prices on detachable, fixed-neck, and hydraulic lowboy trailers from top manufacturers.',
  },
  'sleeper-trucks': {
    title: 'Sleeper Trucks for Sale',
    description: 'Find sleeper trucks for sale from Peterbilt, Freightliner, Kenworth, Volvo, and more. Compare prices, mileage, and specs.',
  },
  'flatbed-trailers': {
    title: 'Flatbed Trailers for Sale',
    description: 'Browse flatbed trailers for sale. Standard, step-deck, and extendable flatbeds from leading manufacturers.',
  },
  'day-cab-trucks': {
    title: 'Day Cab Trucks for Sale',
    description: 'Find day cab trucks for sale. Semi trucks for local and regional hauling from top brands.',
  },
  'trucks': {
    title: 'Semi Trucks for Sale',
    description: 'Browse semi trucks for sale including sleeper trucks, day cabs, and vocational trucks from all major manufacturers.',
  },
  'trailers': {
    title: 'Trailers for Sale',
    description: 'Find trailers for sale including lowboys, flatbeds, reefers, dry vans, and specialty trailers.',
  },
  'heavy-equipment': {
    title: 'Heavy Equipment for Sale',
    description: 'Browse heavy equipment for sale including excavators, loaders, bulldozers, and more.',
  },
};

export async function generateMetadata(
  { params: _params }: SearchLayoutProps,
): Promise<Metadata> {
  // Note: searchParams are not available in layouts in Next.js App Router
  // The layout provides base metadata; the page's client-side rendering
  // handles dynamic content based on searchParams
  return {
    title: 'Search Trucks, Trailers & Equipment',
    description: 'Search thousands of trucks, trailers, and heavy equipment listings. Filter by price, year, make, condition, and location. AI-powered search understands natural language.',
    openGraph: {
      title: 'Search Trucks, Trailers & Equipment | AxlonAI',
      description: 'Find your next truck, trailer, or equipment with AI-powered search. Filter by price, year, make, and location.',
    },
    alternates: {
      canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://axlon.ai'}/search`,
    },
  };
}

export default function SearchLayout({ children }: SearchLayoutProps) {
  return (
    <>
      {children}

      {/* SEO: Crawlable content for search engines */}
      <section className="sr-only" aria-label="Search Information">
        <h2>Browse Equipment by Category</h2>
        <ul>
          {Object.entries(categoryMeta).map(([slug, meta]) => (
            <li key={slug}>
              <a href={`/search?category=${slug}`}>{meta.title}</a>
              <p>{meta.description}</p>
            </li>
          ))}
        </ul>
        <h2>Search Features</h2>
        <p>
          AxlonAI uses artificial intelligence to understand your search queries in natural language.
          Search for trucks, trailers, and heavy equipment by make, model, year, price range,
          condition, and location. Get AI-powered price analysis to find the best deals.
        </p>
      </section>
    </>
  );
}
