'use client';

import { Card, CardContent } from '@/components/ui/card';
import {
  FileText,
  DollarSign,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import type { DealDashboardMetrics } from '@/types/deals';

interface DealStatsProps {
  metrics: DealDashboardMetrics;
}

export function DealStats({ metrics }: DealStatsProps) {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toLocaleString()}`;
  };

  const stats = [
    {
      label: 'Active Deals',
      value: metrics.pipelineCount,
      subtext: `${metrics.totalDeals} total`,
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      label: 'Pipeline Value',
      value: formatCurrency(metrics.pipelineValue),
      subtext: 'In progress',
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      label: 'Closed This Month',
      value: metrics.closedThisMonth,
      subtext: formatCurrency(metrics.revenueThisMonth),
      icon: CheckCircle2,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    },
    {
      label: 'Conversion Rate',
      value: `${metrics.conversionRate}%`,
      subtext: 'Win rate',
      icon: TrendingUp,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-xs text-muted-foreground">{stat.subtext}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
