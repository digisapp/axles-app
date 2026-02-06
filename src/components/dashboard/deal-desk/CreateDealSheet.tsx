'use client';

import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
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
import { Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

interface CreateDealSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  prefillLeadId?: string;
  prefillListingId?: string;
}

interface Lead {
  id: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone?: string;
  listing_id?: string;
}

interface Listing {
  id: string;
  title: string;
  stock_number?: string;
  price?: number;
}

export function CreateDealSheet({
  open,
  onOpenChange,
  onSuccess,
  prefillLeadId,
  prefillListingId,
}: CreateDealSheetProps) {
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [searchListing, setSearchListing] = useState('');

  // Form state
  const [leadId, setLeadId] = useState(prefillLeadId || '');
  const [listingId, setListingId] = useState(prefillListingId || '');
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerCompany, setBuyerCompany] = useState('');
  const [notes, setNotes] = useState('');

  // Fetch leads and listings
  useEffect(() => {
    if (open) {
      fetchLeads();
      fetchListings();
    }
  }, [open]);

  // Prefill from lead
  useEffect(() => {
    if (leadId && leads.length > 0) {
      const lead = leads.find((l) => l.id === leadId);
      if (lead) {
        setBuyerName(lead.buyer_name);
        setBuyerEmail(lead.buyer_email);
        setBuyerPhone(lead.buyer_phone || '');
        if (lead.listing_id) {
          setListingId(lead.listing_id);
        }
      }
    }
  }, [leadId, leads]);

  const fetchLeads = async () => {
    try {
      const res = await fetch('/api/dashboard/leads?status=qualified&limit=50');
      if (res.ok) {
        const data = await res.json();
        setLeads(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch leads:', error);
    }
  };

  const fetchListings = async () => {
    try {
      const res = await fetch('/api/dashboard/listings?status=active&limit=100');
      if (res.ok) {
        const data = await res.json();
        setListings(data.listings || []);
      }
    } catch (error) {
      console.error('Failed to fetch listings:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!buyerName.trim()) {
      toast.error('Buyer name is required');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/deal-desk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: leadId || undefined,
          listing_id: listingId || undefined,
          buyer_name: buyerName.trim(),
          buyer_email: buyerEmail.trim() || undefined,
          buyer_phone: buyerPhone.trim() || undefined,
          buyer_company: buyerCompany.trim() || undefined,
          internal_notes: notes.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create deal');
      }

      toast.success('Deal created successfully');
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create deal');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setLeadId('');
    setListingId('');
    setBuyerName('');
    setBuyerEmail('');
    setBuyerPhone('');
    setBuyerCompany('');
    setNotes('');
    setSearchListing('');
  };

  const filteredListings = listings.filter(
    (l) =>
      l.title.toLowerCase().includes(searchListing.toLowerCase()) ||
      l.stock_number?.toLowerCase().includes(searchListing.toLowerCase())
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Create New Deal</SheetTitle>
          <SheetDescription>
            Start a new deal from a lead or create a fresh quote.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          {/* From Lead */}
          <div className="space-y-2">
            <Label>From Lead (Optional)</Label>
            <Select value={leadId} onValueChange={setLeadId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a qualified lead..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None - New buyer</SelectItem>
                {leads.map((lead) => (
                  <SelectItem key={lead.id} value={lead.id}>
                    {lead.buyer_name} ({lead.buyer_email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Listing Selection */}
          <div className="space-y-2">
            <Label>Equipment / Listing</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search listings..."
                value={searchListing}
                onChange={(e) => setSearchListing(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={listingId} onValueChange={setListingId}>
              <SelectTrigger>
                <SelectValue placeholder="Select listing..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No listing</SelectItem>
                {filteredListings.slice(0, 20).map((listing) => (
                  <SelectItem key={listing.id} value={listing.id}>
                    {listing.title}
                    {listing.stock_number && ` (${listing.stock_number})`}
                    {listing.price && ` - $${listing.price.toLocaleString()}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-4">Buyer Information</h4>

            {/* Buyer Name */}
            <div className="space-y-2">
              <Label htmlFor="buyer_name">
                Buyer Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="buyer_name"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="John Doe"
                required
              />
            </div>

            {/* Buyer Email */}
            <div className="space-y-2 mt-4">
              <Label htmlFor="buyer_email">Email</Label>
              <Input
                id="buyer_email"
                type="email"
                value={buyerEmail}
                onChange={(e) => setBuyerEmail(e.target.value)}
                placeholder="john@example.com"
              />
            </div>

            {/* Buyer Phone */}
            <div className="space-y-2 mt-4">
              <Label htmlFor="buyer_phone">Phone</Label>
              <Input
                id="buyer_phone"
                type="tel"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>

            {/* Company */}
            <div className="space-y-2 mt-4">
              <Label htmlFor="buyer_company">Company</Label>
              <Input
                id="buyer_company"
                value={buyerCompany}
                onChange={(e) => setBuyerCompany(e.target.value)}
                placeholder="Acme Trucking"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Internal Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this deal..."
              rows={3}
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Deal'
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
