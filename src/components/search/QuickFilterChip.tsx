'use client';

import { memo } from 'react';

interface QuickFilterChipProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}

export const QuickFilterChip = memo(function QuickFilterChip({
  label,
  isActive,
  onClick,
  icon,
}: QuickFilterChipProps) {
  return (
    <button
      onClick={onClick}
      aria-pressed={isActive}
      className={`px-3 py-1.5 text-xs md:text-sm rounded-full border transition-colors flex items-center gap-1.5 whitespace-nowrap ${
        isActive
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-background hover:bg-muted border-border'
      }`}
    >
      {icon}
      {label}
    </button>
  );
});
