import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Deals - Below Market Price Trucks & Trailers',
  description: 'Find trucks, trailers, and equipment priced below market value. AI-analyzed deals with verified savings on commercial vehicles and heavy equipment.',
  openGraph: {
    title: 'Deals - Below Market Price Trucks & Trailers | AxlonAI',
    description: 'Find trucks, trailers, and equipment priced below market value. AI-analyzed deals with verified savings.',
  },
};

export default function DealsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
