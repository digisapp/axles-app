import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DealActivityTab } from '@/components/dashboard/deal-desk/DealActivityTab';

describe('DealActivityTab', () => {
  it('renders activities', () => {
    const activities = [
      {
        id: '1',
        deal_id: 'd1',
        activity_type: 'status_change',
        title: 'Deal created',
        description: 'Initial quote sent',
        created_at: '2025-01-15T10:00:00Z',
        performer: { name: 'John Doe' },
      },
    ];

    render(<DealActivityTab activities={activities as any} />);
    expect(screen.getByText('Deal created')).toBeInTheDocument();
    expect(screen.getByText('Initial quote sent')).toBeInTheDocument();
  });

  it('shows empty state when no activities', () => {
    render(<DealActivityTab activities={[]} />);
    expect(screen.getByText('No activity yet')).toBeInTheDocument();
  });

  it('shows empty state when activities is undefined', () => {
    render(<DealActivityTab activities={undefined} />);
    expect(screen.getByText('No activity yet')).toBeInTheDocument();
  });
});
