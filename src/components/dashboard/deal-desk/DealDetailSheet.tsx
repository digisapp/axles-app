'use client';

import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import type { DealStatus } from '@/types/deals';
import { useDeal, useUpdateDealStatus, useAddLineItem, useRemoveLineItem, useAddPayment, useGenerateQuote } from '@/hooks/use-deal';
import { DealOverviewTab } from './DealOverviewTab';
import { DealPricingTab } from './DealPricingTab';
import { DealPaymentsTab } from './DealPaymentsTab';
import { DealActivityTab } from './DealActivityTab';

interface DealDetailSheetProps {
  dealId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const statusOptions: { value: DealStatus; label: string }[] = [
  { value: 'quote', label: 'Quote' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'finalized', label: 'Finalized' },
  { value: 'closed', label: 'Closed' },
  { value: 'lost', label: 'Lost' },
];

export function DealDetailSheet({ dealId, open, onOpenChange, onUpdate }: DealDetailSheetProps) {
  const [activeTab, setActiveTab] = useState('overview');

  const { data: deal, isLoading: loading } = useDeal(dealId, open);
  const updateStatus = useUpdateDealStatus(dealId);
  const addLineItemMutation = useAddLineItem(dealId);
  const removeLineItemMutation = useRemoveLineItem(dealId);
  const addPaymentMutation = useAddPayment(dealId);
  const generateQuoteMutation = useGenerateQuote(dealId, deal?.deal_number);

  const saving = updateStatus.isPending || addLineItemMutation.isPending ||
    removeLineItemMutation.isPending || addPaymentMutation.isPending || generateQuoteMutation.isPending;

  const handleStatusChange = (newStatus: DealStatus) => {
    updateStatus.mutate(newStatus, { onSuccess: () => onUpdate() });
  };

  const handleAddLineItem = (item: { item_type: string; description: string; quantity: number; unit_price: number }) => {
    if (!item.description || item.unit_price === 0) {
      toast.error('Please fill in all fields');
      return;
    }
    addLineItemMutation.mutate(item);
  };

  const handleRemoveLineItem = (itemId: string) => {
    removeLineItemMutation.mutate(itemId);
  };

  const handleAddPayment = (payment: { payment_type: string; payment_method: string; amount: number; payment_date: string; reference_number: string }) => {
    if (payment.amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    addPaymentMutation.mutate(payment);
  };

  const handleGenerateQuote = () => {
    generateQuoteMutation.mutate();
  };

  if (!open) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        {loading ? (
          <DealDetailSkeleton />
        ) : deal ? (
          <>
            <SheetHeader>
              <div className="flex items-center justify-between">
                <div>
                  <SheetTitle className="text-xl">{deal.deal_number}</SheetTitle>
                  <p className="text-sm text-muted-foreground">{deal.buyer_name}</p>
                </div>
                <Select value={deal.status} onValueChange={handleStatusChange} disabled={saving}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </SheetHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="pricing">Pricing</TabsTrigger>
                <TabsTrigger value="payments">Payments</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4">
                <DealOverviewTab deal={deal} saving={saving} onGenerateQuote={handleGenerateQuote} />
              </TabsContent>

              <TabsContent value="pricing" className="mt-4">
                <DealPricingTab deal={deal} saving={saving} onAddLineItem={handleAddLineItem} onRemoveLineItem={handleRemoveLineItem} />
              </TabsContent>

              <TabsContent value="payments" className="mt-4">
                <DealPaymentsTab deal={deal} saving={saving} onAddPayment={handleAddPayment} />
              </TabsContent>

              <TabsContent value="activity" className="mt-4">
                <DealActivityTab activities={deal.activities} />
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">Deal not found</div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DealDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-24 mt-1" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-40" />
    </div>
  );
}
