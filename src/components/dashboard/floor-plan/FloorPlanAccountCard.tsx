'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Building2, Settings, Package } from 'lucide-react';
import type { FloorPlanAccountWithStats } from '@/types/floor-plan';

interface FloorPlanAccountCardProps {
  account: FloorPlanAccountWithStats;
  onManage?: (accountId: string) => void;
}

export function FloorPlanAccountCard({ account, onManage }: FloorPlanAccountCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const utilization = account.credit_limit > 0
    ? ((account.credit_limit - account.available_credit) / account.credit_limit) * 100
    : 0;

  const statusColors = {
    active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    suspended: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    closed: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">
                {account.provider?.name || 'Unknown Provider'}
              </CardTitle>
              {account.account_name && (
                <p className="text-sm text-muted-foreground">{account.account_name}</p>
              )}
            </div>
          </div>
          <Badge variant="secondary" className={statusColors[account.status]}>
            {account.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Credit Utilization */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Credit Utilization</span>
            <span className="font-medium">{utilization.toFixed(1)}%</span>
          </div>
          <Progress
            value={utilization}
            className={`h-2 ${
              utilization > 80
                ? '[&>div]:bg-red-500'
                : utilization > 60
                ? '[&>div]:bg-yellow-500'
                : '[&>div]:bg-green-500'
            }`}
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{formatCurrency(account.credit_limit - account.available_credit)} used</span>
            <span>{formatCurrency(account.available_credit)} available</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          <div>
            <p className="text-2xl font-bold">{account.active_units_count}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Package className="w-3 h-3" />
              Active Units
            </p>
          </div>
          <div>
            <p className="text-2xl font-bold">{account.interest_rate}%</p>
            <p className="text-xs text-muted-foreground">Interest Rate</p>
          </div>
        </div>

        {/* Account Details */}
        <div className="pt-2 border-t space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Floored</span>
            <span className="font-medium">{formatCurrency(account.total_floored_amount)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Credit Limit</span>
            <span>{formatCurrency(account.credit_limit)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Curtailment</span>
            <span>{account.curtailment_percent}% @ {account.curtailment_days} days</span>
          </div>
        </div>

        {/* Actions */}
        {onManage && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => onManage(account.id)}
          >
            <Settings className="w-4 h-4 mr-2" />
            Manage Account
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
