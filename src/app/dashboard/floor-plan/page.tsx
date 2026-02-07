'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus,
  RefreshCw,
  Building2,
  Package,
  AlertTriangle,
} from 'lucide-react';
import {
  FloorPlanMetrics,
  FloorPlanUnitsTable,
  FloorPlanAccountCard,
  FloorUnitSheet,
  RecordPaymentDialog,
  PayoffDialog,
  FloorPlanAlertBanner,
} from '@/components/dashboard/floor-plan';
import type {
  FloorPlanDashboardMetrics,
  FloorPlanAlert,
  ListingFloorPlan,
  FloorPlanAccountWithStats,
} from '@/types/floor-plan';
import { logger } from '@/lib/logger';

export default function FloorPlanDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<FloorPlanDashboardMetrics | null>(null);
  const [alerts, setAlerts] = useState<FloorPlanAlert[]>([]);
  const [units, setUnits] = useState<ListingFloorPlan[]>([]);
  const [accounts, setAccounts] = useState<FloorPlanAccountWithStats[]>([]);
  const [upcomingCurtailments, setUpcomingCurtailments] = useState<ListingFloorPlan[]>([]);

  // Dialog state
  const [floorUnitSheetOpen, setFloorUnitSheetOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [payoffDialogOpen, setPayoffDialogOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<ListingFloorPlan | null>(null);

  const fetchDashboardData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [dashboardRes, unitsRes, accountsRes] = await Promise.all([
        fetch('/api/floor-plan/dashboard'),
        fetch('/api/floor-plan/units?status=active'),
        fetch('/api/floor-plan/accounts'),
      ]);

      if (dashboardRes.ok) {
        const dashboardData = await dashboardRes.json();
        setMetrics(dashboardData.metrics);
        setAlerts(dashboardData.recentAlerts || []);
        setUpcomingCurtailments(dashboardData.upcomingCurtailments || []);
      }

      if (unitsRes.ok) {
        const unitsData = await unitsRes.json();
        setUnits(unitsData.data || []);
      }

      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        setAccounts(accountsData.data || []);
      }
    } catch (error) {
      logger.error('Error fetching floor plan data', { error });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleRefresh = () => {
    fetchDashboardData(true);
  };

  const handleRecordPayment = (unit: ListingFloorPlan) => {
    setSelectedUnit(unit);
    setPaymentDialogOpen(true);
  };

  const handleRecordPayoff = (unit: ListingFloorPlan) => {
    setSelectedUnit(unit);
    setPayoffDialogOpen(true);
  };

  const handleDismissAlert = async (alertId: string) => {
    try {
      await fetch(`/api/floor-plan/dashboard/alerts/${alertId}/dismiss`, {
        method: 'POST',
      });
    } catch (error) {
      logger.error('Failed to dismiss alert', { error });
    }
  };

  if (loading) {
    return <FloorPlanSkeleton />;
  }

  const defaultMetrics: FloorPlanDashboardMetrics = {
    totalCreditLimit: 0,
    totalAvailableCredit: 0,
    totalCurrentBalance: 0,
    totalFloored: 0,
    creditUtilization: 0,
    unitsFloored: 0,
    unitsPastDue: 0,
    upcomingCurtailments: 0,
    unpaidInterest: 0,
    monthlyInterestEstimate: 0,
    alertCounts: { critical: 0, warning: 0, info: 0 },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Floor Plan Management</h1>
          <p className="text-muted-foreground mt-1">
            Track inventory financing, curtailments, and interest
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setFloorUnitSheetOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Floor Unit
          </Button>
        </div>
      </div>

      {/* Alerts */}
      <FloorPlanAlertBanner alerts={alerts} onDismiss={handleDismissAlert} />

      {/* Metrics */}
      <FloorPlanMetrics metrics={metrics || defaultMetrics} />

      {/* Tabs */}
      <Tabs defaultValue="units" className="space-y-4">
        <TabsList>
          <TabsTrigger value="units" className="gap-2">
            <Package className="w-4 h-4" />
            Units ({units.length})
          </TabsTrigger>
          <TabsTrigger value="accounts" className="gap-2">
            <Building2 className="w-4 h-4" />
            Accounts ({accounts.length})
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="gap-2">
            <AlertTriangle className="w-4 h-4" />
            Upcoming ({upcomingCurtailments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="units">
          <FloorPlanUnitsTable
            units={units}
            onViewDetails={(unit) => {
              // Could open a detail sheet
              logger.debug('View details', { unit });
            }}
            onRecordPayment={handleRecordPayment}
            onRecordPayoff={handleRecordPayoff}
          />
        </TabsContent>

        <TabsContent value="accounts">
          {accounts.length === 0 ? (
            <Card>
              <CardContent className="py-16">
                <div className="text-center">
                  <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No floor plan accounts</h3>
                  <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                    Add a floor plan account to start tracking your inventory financing.
                  </p>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Account
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.map((account) => (
                <FloorPlanAccountCard
                  key={account.id}
                  account={account}
                  onManage={(id) => {
                    // Could open account management sheet
                    logger.debug('Manage account', { id });
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="upcoming">
          {upcomingCurtailments.length === 0 ? (
            <Card>
              <CardContent className="py-16">
                <div className="text-center">
                  <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No upcoming curtailments</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    You have no curtailment payments due in the next 7 days.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Curtailments Due This Week</CardTitle>
              </CardHeader>
              <CardContent>
                <FloorPlanUnitsTable
                  units={upcomingCurtailments}
                  onRecordPayment={handleRecordPayment}
                  onRecordPayoff={handleRecordPayoff}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <FloorUnitSheet
        open={floorUnitSheetOpen}
        onOpenChange={setFloorUnitSheetOpen}
        accounts={accounts}
        onSuccess={() => fetchDashboardData(true)}
      />

      <RecordPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        floorPlan={selectedUnit}
        onSuccess={() => fetchDashboardData(true)}
      />

      <PayoffDialog
        open={payoffDialogOpen}
        onOpenChange={setPayoffDialogOpen}
        floorPlan={selectedUnit}
        onSuccess={() => fetchDashboardData(true)}
      />
    </div>
  );
}

function FloorPlanSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-5 w-5 mb-3" />
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-4 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Skeleton className="h-10 w-64" />

      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-48 mb-2" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
