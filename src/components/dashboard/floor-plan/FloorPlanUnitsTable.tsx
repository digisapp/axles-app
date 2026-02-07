'use client';

import Image from 'next/image';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  MoreHorizontal,
  DollarSign,
  FileText,
  Eye,
  Package,
} from 'lucide-react';
import { DaysFlooredBadge } from './DaysFlooredBadge';
import { CurtailmentStatusBadge } from './CurtailmentStatusBadge';
import { useImageFallback } from '@/hooks/useImageFallback';
import type { ListingFloorPlan } from '@/types/floor-plan';

interface FloorPlanUnitsTableProps {
  units: ListingFloorPlan[];
  onViewDetails?: (unit: ListingFloorPlan) => void;
  onRecordPayment?: (unit: ListingFloorPlan) => void;
  onRecordPayoff?: (unit: ListingFloorPlan) => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  paid_off: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  transferred: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

function FloorPlanUnitRow({
  unit,
  onViewDetails,
  onRecordPayment,
  onRecordPayoff,
}: {
  unit: ListingFloorPlan;
  onViewDetails?: (unit: ListingFloorPlan) => void;
  onRecordPayment?: (unit: ListingFloorPlan) => void;
  onRecordPayoff?: (unit: ListingFloorPlan) => void;
}) {
  const { hasError, handleError } = useImageFallback();
  const primaryImage = unit.listing?.images?.find(img => img.is_primary)?.url
    || unit.listing?.images?.[0]?.url;

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
            {primaryImage && !hasError ? (
              <Image
                src={primaryImage}
                alt={unit.listing?.title || 'Unit'}
                width={48}
                height={48}
                className="w-full h-full object-cover"
                onError={handleError}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
          </div>
          <div>
            <p className="font-medium line-clamp-1">
              {unit.listing?.title || 'Unknown Unit'}
            </p>
            <p className="text-sm text-muted-foreground">
              {unit.listing?.stock_number && `#${unit.listing.stock_number}`}
              {unit.account?.provider?.name && ` · ${unit.account.provider.name}`}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-right font-medium">
        {formatCurrency(unit.floor_amount)}
      </TableCell>
      <TableCell className="text-right">
        <span className={unit.current_balance > 0 ? '' : 'text-muted-foreground'}>
          {formatCurrency(unit.current_balance)}
        </span>
      </TableCell>
      <TableCell className="text-center">
        <DaysFlooredBadge daysFloored={unit.days_floored} />
      </TableCell>
      <TableCell className="text-center">
        <CurtailmentStatusBadge
          nextCurtailmentDate={unit.next_curtailment_date ?? null}
          isPastDue={unit.is_past_due}
        />
      </TableCell>
      <TableCell className="text-right">
        <div>
          <p className="font-medium">
            {formatCurrency(unit.total_interest_accrued - unit.total_interest_paid)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatCurrency(unit.total_interest_accrued)} total
          </p>
        </div>
      </TableCell>
      <TableCell className="text-center">
        <Badge variant="secondary" className={statusColors[unit.status] || statusColors.active}>
          {unit.status.replace('_', ' ')}
        </Badge>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onViewDetails?.(unit)}>
              <Eye className="w-4 h-4 mr-2" />
              View Details
            </DropdownMenuItem>
            {unit.status === 'active' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onRecordPayment?.(unit)}>
                  <DollarSign className="w-4 h-4 mr-2" />
                  Record Payment
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onRecordPayoff?.(unit)}>
                  <FileText className="w-4 h-4 mr-2" />
                  Record Payoff
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

export function FloorPlanUnitsTable({
  units,
  onViewDetails,
  onRecordPayment,
  onRecordPayoff,
}: FloorPlanUnitsTableProps) {
  if (units.length === 0) {
    return (
      <Card>
        <CardContent className="py-16">
          <div className="text-center">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No floored units</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Floor a unit from your inventory to start tracking it here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Floored Units</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Floor Amount</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="text-center">Days Floored</TableHead>
              <TableHead className="text-center">Curtailment</TableHead>
              <TableHead className="text-right">Interest</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {units.map((unit) => (
              <FloorPlanUnitRow
                key={unit.id}
                unit={unit}
                onViewDetails={onViewDetails}
                onRecordPayment={onRecordPayment}
                onRecordPayoff={onRecordPayoff}
              />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
