'use client';

import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import type { FloorPlanAlert } from '@/types/floor-plan';

interface FloorPlanAlertBannerProps {
  alerts: FloorPlanAlert[];
  onDismiss?: (alertId: string) => void;
}

export function FloorPlanAlertBanner({ alerts, onDismiss }: FloorPlanAlertBannerProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  if (alerts.length === 0) return null;

  // Filter out dismissed alerts
  const visibleAlerts = alerts.filter(a => !dismissedIds.has(a.id));
  if (visibleAlerts.length === 0) return null;

  // Group by severity and show most critical
  const criticalAlerts = visibleAlerts.filter(a => a.severity === 'critical');
  const warningAlerts = visibleAlerts.filter(a => a.severity === 'warning');
  const infoAlerts = visibleAlerts.filter(a => a.severity === 'info');

  const handleDismiss = async (alertId: string) => {
    setDismissedIds(prev => new Set([...prev, alertId]));
    onDismiss?.(alertId);
  };

  const renderAlert = (alert: FloorPlanAlert) => {
    const severityConfig = {
      critical: {
        icon: <AlertCircle className="h-4 w-4" />,
        className: 'border-red-500/50 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
      },
      warning: {
        icon: <AlertTriangle className="h-4 w-4" />,
        className: 'border-yellow-500/50 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300',
      },
      info: {
        icon: <Info className="h-4 w-4" />,
        className: 'border-blue-500/50 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
      },
    };

    const config = severityConfig[alert.severity];

    return (
      <Alert key={alert.id} className={config.className}>
        {config.icon}
        <AlertTitle className="flex items-center justify-between">
          {alert.title}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 -mr-2"
            onClick={() => handleDismiss(alert.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        </AlertTitle>
        <AlertDescription>{alert.message}</AlertDescription>
      </Alert>
    );
  };

  // Show critical first, then warning, limited to 3 total
  const alertsToShow = [
    ...criticalAlerts.slice(0, 2),
    ...warningAlerts.slice(0, 2),
    ...infoAlerts.slice(0, 1),
  ].slice(0, 3);

  return (
    <div className="space-y-2">
      {alertsToShow.map(renderAlert)}
      {visibleAlerts.length > 3 && (
        <p className="text-sm text-muted-foreground text-center">
          +{visibleAlerts.length - 3} more alerts
        </p>
      )}
    </div>
  );
}
