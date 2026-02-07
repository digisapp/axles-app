'use client';

import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Mail,
  Phone,
  FileText,
  Package,
  User,
  Loader2,
} from 'lucide-react';
import type { Deal } from '@/types/deals';
import { formatCurrency } from '@/lib/format-currency';

interface DealOverviewTabProps {
  deal: Deal;
  saving: boolean;
  onGenerateQuote: () => void;
}

export const DealOverviewTab = memo(function DealOverviewTab({ deal, saving, onGenerateQuote }: DealOverviewTabProps) {
  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{formatCurrency(deal.total_due)}</p>
            <p className="text-xs text-muted-foreground">Total Due</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{formatCurrency(deal.amount_paid)}</p>
            <p className="text-xs text-muted-foreground">Paid</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{formatCurrency(deal.balance_due)}</p>
            <p className="text-xs text-muted-foreground">Balance</p>
          </CardContent>
        </Card>
      </div>

      {/* Buyer Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="w-4 h-4" />
            Buyer Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="font-medium">{deal.buyer_name}</p>
          {deal.buyer_company && (
            <p className="text-sm text-muted-foreground">{deal.buyer_company}</p>
          )}
          <div className="flex gap-4 text-sm">
            {deal.buyer_email && (
              <a href={`mailto:${deal.buyer_email}`} className="flex items-center gap-1 text-primary hover:underline">
                <Mail className="w-3 h-3" />
                {deal.buyer_email}
              </a>
            )}
            {deal.buyer_phone && (
              <a href={`tel:${deal.buyer_phone}`} className="flex items-center gap-1 text-primary hover:underline">
                <Phone className="w-3 h-3" />
                {deal.buyer_phone}
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Equipment */}
      {deal.listing && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="w-4 h-4" />
              Equipment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{deal.listing.title}</p>
            <div className="flex gap-4 text-sm text-muted-foreground mt-1">
              {deal.listing.stock_number && <span>Stock #{deal.listing.stock_number}</span>}
              {deal.listing.year && <span>{deal.listing.year}</span>}
              {deal.listing.make && <span>{deal.listing.make}</span>}
              {deal.listing.model && <span>{deal.listing.model}</span>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={onGenerateQuote} disabled={saving} className="flex-1">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
          Generate Quote
        </Button>
      </div>
    </div>
  );
});
