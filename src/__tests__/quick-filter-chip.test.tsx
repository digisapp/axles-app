import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuickFilterChip } from '@/components/search/QuickFilterChip';

describe('QuickFilterChip', () => {
  it('renders the label', () => {
    render(<QuickFilterChip label="Trucks" isActive={false} onClick={() => {}} />);
    expect(screen.getByText('Trucks')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<QuickFilterChip label="Trucks" isActive={false} onClick={onClick} />);
    fireEvent.click(screen.getByText('Trucks'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('has aria-pressed="true" when active', () => {
    render(<QuickFilterChip label="Trucks" isActive={true} onClick={() => {}} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('has aria-pressed="false" when inactive', () => {
    render(<QuickFilterChip label="Trucks" isActive={false} onClick={() => {}} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders icon when provided', () => {
    render(
      <QuickFilterChip
        label="Trucks"
        isActive={false}
        onClick={() => {}}
        icon={<span data-testid="icon">*</span>}
      />
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('applies active styling classes when active', () => {
    render(<QuickFilterChip label="Trucks" isActive={true} onClick={() => {}} />);
    const button = screen.getByRole('button');
    expect(button.className).toContain('bg-primary');
  });
});
