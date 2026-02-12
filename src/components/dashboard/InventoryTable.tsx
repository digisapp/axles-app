'use client';

import { useState, useMemo, memo } from 'react';
import Link from 'next/link';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Search,
  MoreVertical,
  Edit,
  Eye,
  Trash2,
  ArrowUpDown,
  Clock,
} from 'lucide-react';

interface Listing {
  id: string;
  title: string;
  price: number | null;
  status: string;
  stock_number: string | null;
  quantity: number | null;
  lot_location: string | null;
  acquired_date: string | null;
  acquisition_cost: number | null;
  views_count: number | null;
  created_at: string;
  category: { name: string } | { name: string }[] | null;
}

interface InventoryTableProps {
  listings: Listing[];
}

export const InventoryTable = memo(function InventoryTable({ listings }: InventoryTableProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Capture current time once to avoid impure Date.now() calls during render
  const now = useMemo(() => Date.now(), []);

  // Filter listings
  const filteredListings = listings.filter(listing => {
    const matchesSearch =
      listing.title.toLowerCase().includes(search.toLowerCase()) ||
      listing.stock_number?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' || listing.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Sort listings
  const sortedListings = [...filteredListings].sort((a, b) => {
    let aVal: string | number | null = null;
    let bVal: string | number | null = null;

    switch (sortBy) {
      case 'title':
        aVal = a.title;
        bVal = b.title;
        break;
      case 'price':
        aVal = a.price || 0;
        bVal = b.price || 0;
        break;
      case 'days_on_lot':
        aVal = new Date(a.acquired_date || a.created_at).getTime();
        bVal = new Date(b.acquired_date || b.created_at).getTime();
        break;
      case 'views':
        aVal = a.views_count || 0;
        bVal = b.views_count || 0;
        break;
      default:
        aVal = new Date(a.created_at).getTime();
        bVal = new Date(b.created_at).getTime();
    }

    if (aVal === null || bVal === null) return 0;
    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const toggleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const getDaysOnLot = (date: string | null, createdAt: string) => {
    const startDate = new Date(date || createdAt);
    const days = Math.floor(
      (now - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    return days;
  };

  const getMargin = (price: number | null, cost: number | null) => {
    if (!price || !cost) return null;
    const margin = ((price - cost) / price) * 100;
    return margin.toFixed(1);
  };

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    draft: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    sold: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    expired: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by title or stock #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sold">Sold</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]" aria-sort={sortBy === 'title' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSort('title')}
                    className="-ml-3"
                    aria-label={`Sort by title ${sortBy === 'title' ? (sortOrder === 'asc' ? '(ascending)' : '(descending)') : ''}`}
                  >
                    Title
                    <ArrowUpDown className="w-4 h-4 ml-2" />
                  </Button>
                </TableHead>
                <TableHead>Stock #</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right" aria-sort={sortBy === 'price' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSort('price')}
                    className="-mr-3"
                    aria-label={`Sort by price ${sortBy === 'price' ? (sortOrder === 'asc' ? '(ascending)' : '(descending)') : ''}`}
                  >
                    Price
                    <ArrowUpDown className="w-4 h-4 ml-2" />
                  </Button>
                </TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead className="text-center" aria-sort={sortBy === 'days_on_lot' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSort('days_on_lot')}
                    aria-label={`Sort by days on lot ${sortBy === 'days_on_lot' ? (sortOrder === 'asc' ? '(ascending)' : '(descending)') : ''}`}
                  >
                    Days
                    <ArrowUpDown className="w-4 h-4 ml-2" />
                  </Button>
                </TableHead>
                <TableHead className="text-center" aria-sort={sortBy === 'views' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSort('views')}
                    aria-label={`Sort by views ${sortBy === 'views' ? (sortOrder === 'asc' ? '(ascending)' : '(descending)') : ''}`}
                  >
                    Views
                    <ArrowUpDown className="w-4 h-4 ml-2" />
                  </Button>
                </TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedListings.length > 0 ? (
                sortedListings.map((listing) => {
                  const daysOnLot = getDaysOnLot(
                    listing.acquired_date,
                    listing.created_at
                  );
                  const margin = getMargin(
                    listing.price,
                    listing.acquisition_cost
                  );

                  return (
                    <TableRow key={listing.id}>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="font-medium truncate max-w-[280px]">
                            {listing.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(Array.isArray(listing.category) ? listing.category[0]?.name : listing.category?.name) || 'Uncategorized'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">
                          {listing.stock_number || '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={statusColors[listing.status] || ''}
                        >
                          {listing.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {listing.price
                          ? `$${listing.price.toLocaleString()}`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {listing.acquisition_cost
                          ? `$${listing.acquisition_cost.toLocaleString()}`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {margin !== null ? (
                          <span
                            className={
                              parseFloat(margin) > 0
                                ? 'text-green-600'
                                : 'text-red-600'
                            }
                          >
                            {margin}%
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`inline-flex items-center gap-1 ${
                            daysOnLot > 90
                              ? 'text-yellow-600'
                              : daysOnLot > 60
                              ? 'text-orange-600'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {daysOnLot > 90 && (
                            <Clock className="w-3 h-3" />
                          )}
                          {daysOnLot}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {listing.views_count || 0}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/listing/${listing.id}`}>
                                <Eye className="w-4 h-4 mr-2" />
                                View
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/dashboard/listings/${listing.id}/edit`}
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <p className="text-muted-foreground">
                      No listings match your filters
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
});
