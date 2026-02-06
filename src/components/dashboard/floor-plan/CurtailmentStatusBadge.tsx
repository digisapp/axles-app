'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

interface CurtailmentStatusBadgeProps {
  nextCurtailmentDate: string | null;
  isPastDue: boolean;
  showIcon?: boolean;
}

export function CurtailmentStatusBadge({
  nextCurtailmentDate,
  isPastDue,
  showIcon = true
}: CurtailmentStatusBadgeProps) {
  const getStatus = () => {
    if (isPastDue) {
      return {
        label: 'Past Due',
        color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
        icon: <AlertCircle className="w-3 h-3" />,
      };
    }

    if (!nextCurtailmentDate) {
      return {
        label: 'No Date',
        color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700',
        icon: null,
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const curtDate = new Date(nextCurtailmentDate);
    curtDate.setHours(0, 0, 0, 0);
    const diffTime = curtDate.getTime() - today.getTime();
    const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) {
      return {
        label: `${Math.abs(daysUntil)}d overdue`,
        color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
        icon: <AlertCircle className="w-3 h-3" />,
      };
    } else if (daysUntil === 0) {
      return {
        label: 'Due Today',
        color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800',
        icon: <AlertTriangle className="w-3 h-3" />,
      };
    } else if (daysUntil <= 7) {
      return {
        label: `${daysUntil}d left`,
        color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
        icon: <Clock className="w-3 h-3" />,
      };
    } else if (daysUntil <= 14) {
      return {
        label: `${daysUntil}d left`,
        color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
        icon: <Clock className="w-3 h-3" />,
      };
    } else {
      return {
        label: `${daysUntil}d left`,
        color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
        icon: <CheckCircle className="w-3 h-3" />,
      };
    }
  };

  const { label, color, icon } = getStatus();

  return (
    <Badge variant="outline" className={cn(color, 'gap-1')}>
      {showIcon && icon}
      {label}
    </Badge>
  );
}
