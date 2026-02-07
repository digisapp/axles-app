'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Deal, DealStatus } from '@/types/deals';

export function useDeal(dealId: string | null, enabled = true) {
  return useQuery<Deal>({
    queryKey: ['deal', dealId],
    queryFn: async () => {
      const res = await fetch(`/api/deal-desk/${dealId}`);
      if (!res.ok) throw new Error('Failed to load deal');
      const { data } = await res.json();
      return data;
    },
    enabled: enabled && !!dealId,
  });
}

export function useUpdateDealStatus(dealId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newStatus: DealStatus) => {
      const res = await fetch(`/api/deal-desk/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update status');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal', dealId] });
      toast.success('Status updated');
    },
    onError: () => {
      toast.error('Failed to update status');
    },
  });
}

export function useAddLineItem(dealId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: { item_type: string; description: string; quantity: number; unit_price: number }) => {
      const res = await fetch(`/api/deal-desk/${dealId}/line-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      if (!res.ok) throw new Error('Failed to add line item');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal', dealId] });
      toast.success('Line item added');
    },
    onError: () => {
      toast.error('Failed to add line item');
    },
  });
}

export function useRemoveLineItem(dealId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const res = await fetch(`/api/deal-desk/${dealId}/line-items/${itemId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to remove line item');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal', dealId] });
      toast.success('Line item removed');
    },
    onError: () => {
      toast.error('Failed to remove line item');
    },
  });
}

export function useAddPayment(dealId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payment: {
      payment_type: string;
      payment_method: string;
      amount: number;
      payment_date: string;
      reference_number: string;
    }) => {
      const res = await fetch(`/api/deal-desk/${dealId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payment),
      });
      if (!res.ok) throw new Error('Failed to record payment');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal', dealId] });
      toast.success('Payment recorded');
    },
    onError: () => {
      toast.error('Failed to record payment');
    },
  });
}

export function useGenerateQuote(dealId: string | null, dealNumber?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/deal-desk/${dealId}/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('Failed to generate quote');
      return res.blob();
    },
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quote-${dealNumber || dealId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      queryClient.invalidateQueries({ queryKey: ['deal', dealId] });
      toast.success('Quote generated');
    },
    onError: () => {
      toast.error('Failed to generate quote');
    },
  });
}
