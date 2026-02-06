'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';

interface DaysFlooredBadgeProps {
  daysFloored: number;
  showIcon?: boolean;
  size?: 'sm' | 'default';
}

export function DaysFlooredBadge({
  daysFloored,
  showIcon = false,
  size = 'default'
}: DaysFlooredBadgeProps) {
  const getStatus = () => {
    if (daysFloored < 60) {
      return {
        label: `${daysFloored}d`,
        color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
        status: 'healthy',
      };
    } else if (daysFloored < 90) {
      return {
        label: `${daysFloored}d`,
        color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
        status: 'warning',
      };
    } else {
      return {
        label: `${daysFloored}d`,
        color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
        status: 'critical',
      };
    }
  };

  const { label, color } = getStatus();

  return (
    <Badge
      variant="outline"
      className={cn(
        color,
        size === 'sm' && 'text-xs px-1.5 py-0'
      )}
    >
      {showIcon && <Clock className="w-3 h-3 mr-1" />}
      {label}
    </Badge>
  );
}
