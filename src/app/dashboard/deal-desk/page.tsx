'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, RefreshCw, Handshake } from 'lucide-react';
import {
  DealsKanban,
  DealStats,
  CreateDealSheet,
  DealDetailSheet,
} from '@/components/dashboard/deal-desk';
import type { Deal, DealStatus, DealDashboardMetrics } from '@/types/deals';

export default function DealDeskPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<DealDashboardMetrics | null>(null);
  const [dealsByStatus, setDealsByStatus] = useState<Record<DealStatus, Deal[]>>({
    quote: [],
    negotiation: [],
    pending_approval: [],
    finalized: [],
    closed: [],
    lost: [],
  });

  // Dialog state
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch('/api/deal-desk/dashboard');

      if (res.ok) {
        const data = await res.json();
        setMetrics(data.metrics);
        setDealsByStatus({
          quote: data.kanbanData?.quote || [],
          negotiation: data.kanbanData?.negotiation || [],
          pending_approval: data.kanbanData?.pending_approval || [],
          finalized: data.kanbanData?.finalized || [],
          closed: [],
          lost: [],
        });
      }
    } catch (error) {
      console.error('Error fetching deal desk data:', error);
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

  const handleDealClick = (deal: Deal) => {
    setSelectedDealId(deal.id);
    setDetailSheetOpen(true);
  };

  if (loading) {
    return <DealDeskSkeleton />;
  }

  const defaultMetrics: DealDashboardMetrics = {
    totalDeals: 0,
    pipelineCount: 0,
    pipelineValue: 0,
    closedThisMonth: 0,
    revenueThisMonth: 0,
    conversionRate: 0,
    byStatus: {
      quote: 0,
      negotiation: 0,
      pending_approval: 0,
      finalized: 0,
      closed: 0,
    },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Handshake className="w-8 h-8" />
            Deal Desk
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage quotes, negotiations, and close deals
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
          <Button size="sm" onClick={() => setCreateSheetOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Deal
          </Button>
        </div>
      </div>

      {/* Stats */}
      <DealStats metrics={metrics || defaultMetrics} />

      {/* Pipeline Kanban */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Sales Pipeline</h2>
        <DealsKanban
          initialDeals={dealsByStatus}
          onDealClick={handleDealClick}
        />
      </div>

      {/* Sheets/Dialogs */}
      <CreateDealSheet
        open={createSheetOpen}
        onOpenChange={setCreateSheetOpen}
        onSuccess={() => fetchDashboardData(true)}
      />

      <DealDetailSheet
        dealId={selectedDealId}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        onUpdate={() => fetchDashboardData(true)}
      />
    </div>
  );
}

function DealDeskSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
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

      <Skeleton className="h-6 w-32" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-8 w-24" />
            <div className="space-y-3 p-2 bg-muted/30 rounded-lg min-h-[200px]">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
