import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DealOverviewTab } from '@/components/dashboard/deal-desk/DealOverviewTab';

const mockDeal = {
  id: 'd1',
  deal_number: 'DEAL-001',
  dealer_id: 'dealer1',
  buyer_name: 'Jane Smith',
  buyer_email: 'jane@example.com',
  buyer_phone: '555-5678',
  buyer_company: 'Smith Trucking',
  status: 'quote' as const,
  sale_price: 80000,
  total_fees: 2000,
  total_taxes: 5000,
  total_discounts: 0,
  trade_in_allowance: 10000,
  total_due: 77000,
  amount_paid: 20000,
  balance_due: 57000,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-15T00:00:00Z',
  listing: {
    id: 'l1',
    title: '2022 Freightliner Cascadia',
    stock_number: 'STK-123',
    year: 2022,
    make: 'Freightliner',
    model: 'Cascadia',
  },
} as any;

describe('DealOverviewTab', () => {
  it('renders financial summary cards', () => {
    render(<DealOverviewTab deal={mockDeal} saving={false} onGenerateQuote={() => {}} />);
    expect(screen.getByText('Total Due')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('Balance')).toBeInTheDocument();
  });

  it('renders buyer information', () => {
    render(<DealOverviewTab deal={mockDeal} saving={false} onGenerateQuote={() => {}} />);
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Smith Trucking')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
  });

  it('renders equipment details when listing exists', () => {
    render(<DealOverviewTab deal={mockDeal} saving={false} onGenerateQuote={() => {}} />);
    expect(screen.getByText('2022 Freightliner Cascadia')).toBeInTheDocument();
    expect(screen.getByText('Stock #STK-123')).toBeInTheDocument();
  });

  it('calls onGenerateQuote when button is clicked', () => {
    const onGenerateQuote = vi.fn();
    render(<DealOverviewTab deal={mockDeal} saving={false} onGenerateQuote={onGenerateQuote} />);
    fireEvent.click(screen.getByText('Generate Quote'));
    expect(onGenerateQuote).toHaveBeenCalledTimes(1);
  });

  it('disables generate quote button when saving', () => {
    render(<DealOverviewTab deal={mockDeal} saving={true} onGenerateQuote={() => {}} />);
    const buttons = screen.getAllByRole('button');
    const quoteButton = buttons.find(b => b.textContent?.includes('Generate'));
    expect(quoteButton).toBeDisabled();
  });
});
