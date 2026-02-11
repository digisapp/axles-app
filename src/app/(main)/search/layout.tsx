import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Search Trucks, Trailers & Equipment',
  description: 'Search thousands of trucks, trailers, and heavy equipment listings. Filter by price, year, make, condition, and location. AI-powered search understands natural language.',
  openGraph: {
    title: 'Search Trucks, Trailers & Equipment | AxlonAI',
    description: 'Find your next truck, trailer, or equipment with AI-powered search.',
  },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
