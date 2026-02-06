'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Mail,
  Phone,
  MoreVertical,
  ArrowRight,
  CheckCircle,
  XCircle,
  Package,
  DollarSign,
  Clock,
  FileText,
} from 'lucide-react';
import type { Deal, DealStatus, DEAL_STATUS_INFO } from '@/types/deals';

interface DealCardProps {
  deal: Deal;
  onStatusChange: (id: string, status: DealStatus) => void;
  onViewDetails: () => void;
}

const statusInfo: Record<DealStatus, { label: string; color: string }> = {
  quote: { label: 'Quote', color: 'bg-blue-100 text-blue-700' },
  negotiation: { label: 'Negotiation', color: 'bg-yellow-100 text-yellow-700' },
  pending_approval: { label: 'Pending', color: 'bg-purple-100 text-purple-700' },
  finalized: { label: 'Finalized', color: 'bg-orange-100 text-orange-700' },
  closed: { label: 'Closed', color: 'bg-green-100 text-green-700' },
  lost: { label: 'Lost', color: 'bg-gray-100 text-gray-700' },
};

const nextStatus: Partial<Record<DealStatus, DealStatus>> = {
  quote: 'negotiation',
  negotiation: 'pending_approval',
  pending_approval: 'finalized',
  finalized: 'closed',
};

export function DealCard({ deal, onStatusChange, onViewDetails }: DealCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const primaryImage = deal.listing?.images?.find((img) => img.is_primary)?.url ||
    deal.listing?.images?.[0]?.url;

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onViewDetails}
    >
      <CardContent className="p-3 space-y-2">
        {/* Header with deal number and actions */}
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground">
                {deal.deal_number}
              </span>
              {deal.quote_sent_at && (
                <Badge variant="outline" className="text-xs px-1 py-0">
                  <FileText className="w-3 h-3 mr-0.5" />
                  Sent
                </Badge>
              )}
            </div>
            <p className="font-medium truncate mt-1">{deal.buyer_name}</p>
            {deal.buyer_email && (
              <p className="text-xs text-muted-foreground truncate">
                {deal.buyer_email}
              </p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-1">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {nextStatus[deal.status] && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(deal.id, nextStatus[deal.status]!);
                  }}
                >
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Move to {statusInfo[nextStatus[deal.status]!].label}
                </DropdownMenuItem>
              )}
              {deal.status !== 'closed' && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(deal.id, 'closed');
                  }}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Mark as Closed
                </DropdownMenuItem>
              )}
              {deal.status !== 'lost' && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(deal.id, 'lost');
                  }}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Mark as Lost
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {deal.buyer_email && (
                <DropdownMenuItem asChild>
                  <a
                    href={`mailto:${deal.buyer_email}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Send Email
                  </a>
                </DropdownMenuItem>
              )}
              {deal.buyer_phone && (
                <DropdownMenuItem asChild>
                  <a
                    href={`tel:${deal.buyer_phone}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Call
                  </a>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Listing info with thumbnail */}
        {deal.listing && (
          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
            {primaryImage && (
              <img
                src={primaryImage}
                alt=""
                className="w-10 h-10 object-cover rounded"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate">{deal.listing.title}</p>
              {deal.listing.stock_number && (
                <p className="text-xs text-muted-foreground">
                  Stock #{deal.listing.stock_number}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Price info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-sm">
            <DollarSign className="w-3 h-3 text-muted-foreground" />
            <span className="font-semibold">{formatCurrency(deal.total_due)}</span>
          </div>
          {deal.balance_due > 0 && deal.balance_due < deal.total_due && (
            <Badge variant="outline" className="text-xs">
              Bal: {formatCurrency(deal.balance_due)}
            </Badge>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
          {deal.salesperson && (
            <span className="truncate">{deal.salesperson.name}</span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(deal.updated_at).toLocaleDateString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
