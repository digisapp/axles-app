'use client';

import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import type { FloorPlanAccount } from '@/types/floor-plan';

interface Listing {
  id: string;
  title: string;
  stock_number?: string;
  price?: number;
}

interface FloorUnitSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: FloorPlanAccount[];
  onSuccess?: () => void;
}

export function FloorUnitSheet({
  open,
  onOpenChange,
  accounts,
  onSuccess,
}: FloorUnitSheetProps) {
  const [loading, setLoading] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loadingListings, setLoadingListings] = useState(false);

  // Form state
  const [listingId, setListingId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [floorAmount, setFloorAmount] = useState('');
  const [floorDate, setFloorDate] = useState(new Date().toISOString().split('T')[0]);
  const [floorReference, setFloorReference] = useState('');
  const [notes, setNotes] = useState('');

  // Fetch available listings
  useEffect(() => {
    if (open) {
      fetchAvailableListings();
    }
  }, [open]);

  const fetchAvailableListings = async () => {
    setLoadingListings(true);
    try {
      // Fetch listings that are not already floored
      const response = await fetch('/api/listings?status=active&has_floor_plan=false&limit=100');
      if (response.ok) {
        const data = await response.json();
        setListings(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch listings:', error);
    } finally {
      setLoadingListings(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!listingId || !accountId || !floorAmount) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/floor-plan/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: listingId,
          account_id: accountId,
          floor_amount: parseFloat(floorAmount),
          floor_date: floorDate,
          floor_reference: floorReference || undefined,
          notes: notes || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to floor unit');
      }

      toast.success('Unit floored successfully');
      onOpenChange(false);
      onSuccess?.();

      // Reset form
      setListingId('');
      setAccountId('');
      setFloorAmount('');
      setFloorReference('');
      setNotes('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to floor unit');
    } finally {
      setLoading(false);
    }
  };

  const selectedAccount = accounts.find(a => a.id === accountId);
  const selectedListing = listings.find(l => l.id === listingId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Floor a Unit</SheetTitle>
          <SheetDescription>
            Add a listing to your floor plan tracking
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-4 px-4">
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            {/* Select Listing */}
            <div className="space-y-2">
              <Label htmlFor="listing">Listing *</Label>
              <Select value={listingId} onValueChange={setListingId}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingListings ? 'Loading...' : 'Select a listing'} />
                </SelectTrigger>
                <SelectContent>
                  {listings.length === 0 && !loadingListings && (
                    <SelectItem value="_none" disabled>
                      No available listings
                    </SelectItem>
                  )}
                  {listings.map((listing) => (
                    <SelectItem key={listing.id} value={listing.id}>
                      {listing.stock_number && `#${listing.stock_number} - `}
                      {listing.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Select Account */}
            <div className="space-y-2">
              <Label htmlFor="account">Floor Plan Account *</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.filter(a => a.status === 'active').map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.provider?.name || 'Unknown'} - {account.account_name || account.account_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedAccount && (
                <p className="text-xs text-muted-foreground">
                  Available credit: ${selectedAccount.available_credit.toLocaleString()} ·
                  {selectedAccount.interest_rate}% interest
                </p>
              )}
            </div>

            {/* Floor Amount */}
            <div className="space-y-2">
              <Label htmlFor="floorAmount">Floor Amount *</Label>
              <Input
                id="floorAmount"
                type="number"
                step="0.01"
                min="0"
                placeholder={selectedListing?.price ? selectedListing.price.toString() : '0.00'}
                value={floorAmount}
                onChange={(e) => setFloorAmount(e.target.value)}
                required
              />
              {selectedListing?.price && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => setFloorAmount(selectedListing.price?.toString() || '')}
                >
                  Use listing price: ${selectedListing.price.toLocaleString()}
                </Button>
              )}
            </div>

            {/* Floor Date */}
            <div className="space-y-2">
              <Label htmlFor="floorDate">Floor Date *</Label>
              <Input
                id="floorDate"
                type="date"
                value={floorDate}
                onChange={(e) => setFloorDate(e.target.value)}
                required
              />
            </div>

            {/* Floor Reference */}
            <div className="space-y-2">
              <Label htmlFor="floorReference">Floor Reference (optional)</Label>
              <Input
                id="floorReference"
                placeholder="Lender reference number"
                value={floorReference}
                onChange={(e) => setFloorReference(e.target.value)}
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
                rows={3}
              />
            </div>

            {/* Summary */}
            {selectedAccount && floorAmount && (
              <div className="bg-muted/50 p-3 rounded-lg space-y-2 text-sm">
                <h4 className="font-medium">Floor Plan Summary</h4>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">First Curtailment</span>
                  <span>
                    {new Date(
                      new Date(floorDate).getTime() + selectedAccount.curtailment_days * 24 * 60 * 60 * 1000
                    ).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Curtailment Amount</span>
                  <span>
                    ${(parseFloat(floorAmount) * (selectedAccount.curtailment_percent / 100)).toFixed(2)}
                    {' '}({selectedAccount.curtailment_percent}%)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Est. Monthly Interest</span>
                  <span>
                    ${(parseFloat(floorAmount) * (selectedAccount.interest_rate / 100 / 12)).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </form>
        </ScrollArea>

        <SheetFooter className="pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !listingId || !accountId || !floorAmount}>
            {loading ? 'Flooring...' : 'Floor Unit'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
