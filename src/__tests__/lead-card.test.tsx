import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LeadCard } from '@/components/leads/LeadCard';

const mockLead = {
  id: '1',
  buyer_name: 'John Doe',
  buyer_email: 'john@example.com',
  buyer_phone: '555-1234',
  status: 'new',
  priority: 'high',
  score: 75,
  created_at: '2025-06-15T10:00:00Z',
  listing: {
    id: 'l1',
    title: '2022 Peterbilt 579',
    price: 85000,
  },
};

describe('LeadCard', () => {
  it('renders buyer name and email', () => {
    render(
      <LeadCard lead={mockLead} onStatusChange={() => {}} onViewDetails={() => {}} />
    );
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
  });

  it('renders listing reference', () => {
    render(
      <LeadCard lead={mockLead} onStatusChange={() => {}} onViewDetails={() => {}} />
    );
    expect(screen.getByText('2022 Peterbilt 579')).toBeInTheDocument();
  });

  it('renders score badge for hot leads', () => {
    render(
      <LeadCard lead={mockLead} onStatusChange={() => {}} onViewDetails={() => {}} />
    );
    expect(screen.getByText(/Hot/)).toBeInTheDocument();
  });

  it('renders priority badge', () => {
    render(
      <LeadCard lead={mockLead} onStatusChange={() => {}} onViewDetails={() => {}} />
    );
    expect(screen.getByText('high')).toBeInTheDocument();
  });

  it('calls onViewDetails when card is clicked', () => {
    const onViewDetails = vi.fn();
    render(
      <LeadCard lead={mockLead} onStatusChange={() => {}} onViewDetails={onViewDetails} />
    );
    // Click the card (not the dropdown)
    fireEvent.click(screen.getByText('John Doe'));
    expect(onViewDetails).toHaveBeenCalledTimes(1);
  });

  it('renders follow-up indicator when date is set', () => {
    const leadWithFollowUp = {
      ...mockLead,
      follow_up_date: '2030-12-01T00:00:00Z',
    };
    render(
      <LeadCard lead={leadWithFollowUp} onStatusChange={() => {}} onViewDetails={() => {}} />
    );
    expect(screen.getByText(/Follow-up:/)).toBeInTheDocument();
  });

  it('shows follow-up due when date is in the past', () => {
    const leadWithPastFollowUp = {
      ...mockLead,
      follow_up_date: '2020-01-01T00:00:00Z',
    };
    render(
      <LeadCard lead={leadWithPastFollowUp} onStatusChange={() => {}} onViewDetails={() => {}} />
    );
    expect(screen.getByText('Follow-up due!')).toBeInTheDocument();
  });
});
