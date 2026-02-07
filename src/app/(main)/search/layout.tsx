import { Metadata } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://axlon.ai';

export const metadata: Metadata = {
  title: 'Search Trucks, Trailers & Equipment',
  description:
    'Search thousands of trucks, trailers, and heavy equipment for sale. Use AI-powered search to find exactly what you need. Filter by price, year, make, condition, and location.',
  alternates: {
    canonical: `${baseUrl}/search`,
  },
  openGraph: {
    title: 'Search Trucks, Trailers & Equipment | AxlonAI',
    description:
      'Search thousands of trucks, trailers, and heavy equipment for sale. AI-powered search with smart filters.',
    url: `${baseUrl}/search`,
  },
};

export default function SearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
