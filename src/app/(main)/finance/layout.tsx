import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Commercial Truck & Trailer Financing Calculator',
  description: 'Calculate monthly payments for commercial truck and trailer financing. Flexible terms from 24-84 months with competitive rates. Get started today.',
  openGraph: {
    title: 'Commercial Truck & Trailer Financing | AxlonAI',
    description: 'Calculate monthly payments for truck and trailer financing. Flexible terms, competitive rates.',
  },
};

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
