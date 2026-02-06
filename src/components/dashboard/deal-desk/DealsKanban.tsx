'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { DealCard } from './DealCard';
import type { Deal, DealStatus } from '@/types/deals';
import { toast } from 'sonner';

interface DealsKanbanProps {
  initialDeals: Record<DealStatus, Deal[]>;
  onDealClick: (deal: Deal) => void;
}

const columns: { id: DealStatus; label: string; color: string }[] = [
  { id: 'quote', label: 'Quote', color: 'bg-blue-500' },
  { id: 'negotiation', label: 'Negotiation', color: 'bg-yellow-500' },
  { id: 'pending_approval', label: 'Pending Approval', color: 'bg-purple-500' },
  { id: 'finalized', label: 'Finalized', color: 'bg-orange-500' },
];

export function DealsKanban({ initialDeals, onDealClick }: DealsKanbanProps) {
  const [deals, setDeals] = useState<Record<DealStatus, Deal[]>>(initialDeals);

  const updateDealStatus = async (dealId: string, newStatus: DealStatus) => {
    // Find which column the deal is currently in
    let currentDeal: Deal | undefined;
    let currentStatus: DealStatus | undefined;

    for (const [status, dealList] of Object.entries(deals) as [DealStatus, Deal[]][]) {
      const found = dealList.find((d) => d.id === dealId);
      if (found) {
        currentDeal = found;
        currentStatus = status;
        break;
      }
    }

    if (!currentDeal || !currentStatus) return;

    // Optimistic update
    setDeals((prev) => {
      const updated = { ...prev };
      // Remove from current column
      updated[currentStatus!] = updated[currentStatus!].filter((d) => d.id !== dealId);
      // Add to new column
      const updatedDeal = { ...currentDeal!, status: newStatus };
      updated[newStatus] = [updatedDeal, ...(updated[newStatus] || [])];
      return updated;
    });

    // API call
    try {
      const response = await fetch(`/api/deal-desk/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update');
      }

      toast.success(`Deal moved to ${columns.find((c) => c.id === newStatus)?.label || newStatus}`);
    } catch (error) {
      // Revert on error
      setDeals(initialDeals);
      toast.error('Failed to update deal status');
    }
  };

  const getDealsByStatus = (status: DealStatus): Deal[] => {
    return deals[status] || [];
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {columns.map((column) => (
        <div key={column.id} className="space-y-3">
          {/* Column Header */}
          <div className="flex items-center gap-2 p-2">
            <div className={`w-3 h-3 rounded-full ${column.color}`} />
            <h3 className="font-semibold">{column.label}</h3>
            <Badge variant="secondary" className="ml-auto">
              {getDealsByStatus(column.id).length}
            </Badge>
          </div>

          {/* Column Content */}
          <div className="space-y-3 min-h-[200px] p-2 bg-muted/30 rounded-lg">
            {getDealsByStatus(column.id).map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                onStatusChange={updateDealStatus}
                onViewDetails={() => onDealClick(deal)}
              />
            ))}

            {getDealsByStatus(column.id).length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No deals
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
