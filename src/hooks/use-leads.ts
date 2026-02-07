'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface LeadUpdate {
  notes?: string;
  follow_up_date?: string | null;
  follow_up_note?: string | null;
  assigned_to?: string | null;
  status?: string;
}

export function useUpdateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, data }: { leadId: string; data: LeadUpdate }) => {
      const response = await fetch(`/api/dashboard/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update lead');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead updated successfully');
    },
    onError: () => {
      toast.error('Failed to save changes');
    },
  });
}

export function useSubmitLead() {
  return useMutation({
    mutationFn: async (formData: {
      listing_id: string;
      buyer_name: string;
      buyer_email: string;
      buyer_phone?: string;
      message?: string;
    }) => {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!response.ok) throw new Error('Failed to submit inquiry');
      return response.json();
    },
    onSuccess: () => {
      toast.success('Inquiry sent successfully!');
    },
    onError: () => {
      toast.error('Failed to send inquiry. Please try again.');
    },
  });
}
