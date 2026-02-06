'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  DollarSign,
  CreditCard,
  Package,
  AlertTriangle,
  TrendingUp,
  Percent,
} from 'lucide-react';
import type { FloorPlanDashboardMetrics } from '@/types/floor-plan';

interface FloorPlanMetricsProps {
  metrics: FloorPlanDashboardMetrics;
}

export function FloorPlanMetrics({ metrics }: FloorPlanMetricsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Floored */}
      <MetricCard
        title="Total Floored"
        value={formatCurrency(metrics.totalCurrentBalance)}
        icon={<DollarSign className="w-5 h-5" />}
        description={`${metrics.unitsFloored} active units`}
      />

      {/* Credit Utilization */}
      <Card>
        <CardContent className="p-4 md:p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-muted-foreground">
              <Percent className="w-5 h-5" />
            </span>
          </div>
          <p className="text-2xl md:text-3xl font-bold">
            {metrics.creditUtilization.toFixed(1)}%
          </p>
          <p className="text-sm text-muted-foreground">Credit Utilization</p>
          <Progress
            value={metrics.creditUtilization}
            className={`mt-2 h-1.5 ${
              metrics.creditUtilization > 80
                ? '[&>div]:bg-red-500'
                : metrics.creditUtilization > 60
                ? '[&>div]:bg-yellow-500'
                : '[&>div]:bg-green-500'
            }`}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {formatCurrency(metrics.totalAvailableCredit)} available
          </p>
        </CardContent>
      </Card>

      {/* Units at Risk */}
      <MetricCard
        title="Units at Risk"
        value={metrics.unitsPastDue + metrics.upcomingCurtailments}
        icon={<AlertTriangle className="w-5 h-5" />}
        description={`${metrics.unitsPastDue} past due, ${metrics.upcomingCurtailments} upcoming`}
        warning={metrics.unitsPastDue > 0}
      />

      {/* Monthly Interest */}
      <MetricCard
        title="Monthly Interest"
        value={formatCurrency(metrics.monthlyInterestEstimate)}
        icon={<TrendingUp className="w-5 h-5" />}
        description={`${formatCurrency(metrics.unpaidInterest)} unpaid`}
        highlight={metrics.unpaidInterest > 500}
      />
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
  description,
  highlight = false,
  warning = false,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description: string;
  highlight?: boolean;
  warning?: boolean;
}) {
  return (
    <Card
      className={
        warning
          ? 'border-red-500/50 bg-red-50/50 dark:bg-red-900/10'
          : highlight
          ? 'border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-900/10'
          : ''
      }
    >
      <CardContent className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-3">
          <span
            className={
              warning
                ? 'text-red-600'
                : highlight
                ? 'text-yellow-600'
                : 'text-muted-foreground'
            }
          >
            {icon}
          </span>
        </div>
        <p className="text-2xl md:text-3xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}
