'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  ChevronDown,
  SlidersHorizontal,
  ArrowUpDown,
  X,
  Check,
} from 'lucide-react';

interface DealerFiltersProps {
  slug: string;
  currentSort?: string;
  currentMinPrice?: string;
  currentMaxPrice?: string;
  currentMinYear?: string;
  currentMaxYear?: string;
  currentCondition?: string;
  priceRange: [number, number];
  yearRange: [number, number];
  hasActiveFilters: boolean;
  searchQuery?: string;
}

const sortOptions = [
  { value: '', label: 'Newest First' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'year-new', label: 'Year: Newest' },
  { value: 'year-old', label: 'Year: Oldest' },
];

export function DealerFilters({
  slug,
  currentSort,
  currentMinPrice,
  currentMaxPrice,
  currentMinYear,
  currentMaxYear,
  currentCondition,
  priceRange,
  yearRange,
  hasActiveFilters,
  searchQuery,
}: DealerFiltersProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [minPrice, setMinPrice] = useState(currentMinPrice || '');
  const [maxPrice, setMaxPrice] = useState(currentMaxPrice || '');
  const [minYear, setMinYear] = useState(currentMinYear || '');
  const [maxYear, setMaxYear] = useState(currentMaxYear || '');
  const [condition, setCondition] = useState(currentCondition || '');

  const currentSortLabel = sortOptions.find(o => o.value === (currentSort || ''))?.label || 'Newest First';

  const handleSortChange = (sort: string) => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (sort) params.set('sort', sort);
    if (currentMinPrice) params.set('minPrice', currentMinPrice);
    if (currentMaxPrice) params.set('maxPrice', currentMaxPrice);
    if (currentMinYear) params.set('minYear', currentMinYear);
    if (currentMaxYear) params.set('maxYear', currentMaxYear);
    if (currentCondition) params.set('condition', currentCondition);

    router.push(`/${slug}${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (currentSort) params.set('sort', currentSort);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (minYear) params.set('minYear', minYear);
    if (maxYear) params.set('maxYear', maxYear);
    if (condition) params.set('condition', condition);

    router.push(`/${slug}${params.toString() ? `?${params.toString()}` : ''}`);
    setIsOpen(false);
  };

  const clearFilters = () => {
    setMinPrice('');
    setMaxPrice('');
    setMinYear('');
    setMaxYear('');
    setCondition('');

    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (currentSort) params.set('sort', currentSort);

    router.push(`/${slug}${params.toString() ? `?${params.toString()}` : ''}`);
    setIsOpen(false);
  };

  const filterCount = [
    currentMinPrice || currentMaxPrice,
    currentMinYear || currentMaxYear,
    currentCondition,
  ].filter(Boolean).length;

  return (
    <div className="flex items-center gap-2">
      {/* Sort Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="h-12 px-4 gap-2 rounded-xl border-slate-200">
            <ArrowUpDown className="w-4 h-4" />
            <span className="hidden sm:inline">{currentSortLabel}</span>
            <span className="sm:hidden">Sort</span>
            <ChevronDown className="w-4 h-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Sort By</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {sortOptions.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleSortChange(option.value)}
              className="flex items-center justify-between"
            >
              {option.label}
              {(currentSort || '') === option.value && (
                <Check className="w-4 h-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Filters Sheet */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" className="h-12 px-4 gap-2 rounded-xl border-slate-200 relative">
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
            {filterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center">
                {filterCount}
              </span>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center justify-between">
              Filter Inventory
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                  <X className="w-4 h-4 mr-1" />
                  Clear all
                </Button>
              )}
            </SheetTitle>
          </SheetHeader>

          <div className="py-6 space-y-6">
            {/* Price Range */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Price Range</Label>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">Min</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      placeholder={priceRange[0].toLocaleString()}
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      className="pl-7"
                    />
                  </div>
                </div>
                <div className="flex items-end pb-2 text-muted-foreground">—</div>
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">Max</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      placeholder={priceRange[1].toLocaleString()}
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      className="pl-7"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Year Range */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Year Range</Label>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">From</Label>
                  <Input
                    type="number"
                    placeholder={yearRange[0].toString()}
                    value={minYear}
                    onChange={(e) => setMinYear(e.target.value)}
                  />
                </div>
                <div className="flex items-end pb-2 text-muted-foreground">—</div>
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">To</Label>
                  <Input
                    type="number"
                    placeholder={yearRange[1].toString()}
                    value={maxYear}
                    onChange={(e) => setMaxYear(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Condition */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Condition</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={condition === '' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCondition('')}
                  className="flex-1"
                >
                  All
                </Button>
                <Button
                  type="button"
                  variant={condition === 'new' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCondition('new')}
                  className="flex-1"
                >
                  New
                </Button>
                <Button
                  type="button"
                  variant={condition === 'used' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCondition('used')}
                  className="flex-1"
                >
                  Used
                </Button>
              </div>
            </div>
          </div>

          <SheetFooter className="absolute bottom-0 left-0 right-0 p-6 border-t bg-background">
            <div className="flex gap-3 w-full">
              <Button variant="outline" onClick={clearFilters} className="flex-1">
                Clear
              </Button>
              <Button onClick={applyFilters} className="flex-1">
                Apply Filters
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
