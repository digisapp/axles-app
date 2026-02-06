'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import type { ListingFloorPlan } from '@/types/floor-plan';

interface PayoffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  floorPlan: ListingFloorPlan | null;
  onSuccess?: () => void;
}

export function PayoffDialog({
  open,
  onOpenChange,
  floorPlan,
  onSuccess,
}: PayoffDialogProps) {
  const [loading, setLoading] = useState(false);
  const [payoffAmount, setPayoffAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!floorPlan) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/floor-plan/units/${floorPlan.id}/payoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payoff_amount: parseFloat(payoffAmount),
          payment_date: paymentDate,
          reference_number: referenceNumber || undefined,
          notes: notes || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to record payoff');
      }

      toast.success('Unit paid off successfully');
      onOpenChange(false);
      onSuccess?.();

      // Reset form
      setPayoffAmount('');
      setReferenceNumber('');
      setNotes('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to record payoff');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  // Calculate estimated payoff
  const unpaidInterest = floorPlan
    ? floorPlan.total_interest_accrued - floorPlan.total_interest_paid
    : 0;
  const payoffFee = floorPlan?.account?.payoff_fee || 0;
  const estimatedPayoff = floorPlan
    ? floorPlan.current_balance + unpaidInterest + payoffFee
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payoff</DialogTitle>
          <DialogDescription>
            {floorPlan?.listing?.title && (
              <span>For: {floorPlan.listing.title}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Warning */}
          <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              This will mark the unit as paid off and close the floor plan. This action cannot be undone.
            </p>
          </div>

          {/* Payoff Breakdown */}
          {floorPlan && (
            <div className="bg-muted/50 p-3 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current Balance</span>
                <span>{formatCurrency(floorPlan.current_balance)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Unpaid Interest</span>
                <span>{formatCurrency(unpaidInterest)}</span>
              </div>
              {payoffFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Payoff Fee</span>
                  <span>{formatCurrency(payoffFee)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-medium pt-2 border-t">
                <span>Estimated Payoff</span>
                <span>{formatCurrency(estimatedPayoff)}</span>
              </div>
            </div>
          )}

          {/* Payoff Amount */}
          <div className="space-y-2">
            <Label htmlFor="payoffAmount">Payoff Amount</Label>
            <Input
              id="payoffAmount"
              type="number"
              step="0.01"
              min="0"
              placeholder={estimatedPayoff.toFixed(2)}
              value={payoffAmount}
              onChange={(e) => setPayoffAmount(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Enter the actual payoff amount from your lender
            </p>
          </div>

          {/* Payment Date */}
          <div className="space-y-2">
            <Label htmlFor="paymentDate">Payment Date</Label>
            <Input
              id="paymentDate"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
            />
          </div>

          {/* Reference Number */}
          <div className="space-y-2">
            <Label htmlFor="referenceNumber">Reference Number (optional)</Label>
            <Input
              id="referenceNumber"
              placeholder="Wire confirmation, check #, etc."
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !payoffAmount}>
              {loading ? 'Processing...' : 'Record Payoff'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
