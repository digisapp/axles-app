'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { X, RotateCcw } from 'lucide-react';

export interface FilterValues {
  priceMin?: number;
  priceMax?: number;
  yearMin?: number;
  yearMax?: number;
  mileageMax?: number;
  makes?: string[];
  conditions?: string[];
  states?: string[];
  category?: string;
}

interface AdvancedFiltersProps {
  filters: FilterValues;
  onFiltersChange: (filters: FilterValues) => void;
  categories?: { id: string; name: string; slug: string }[];
  onClose?: () => void;
  className?: string;
}

// Common truck makes
const TRUCK_MAKES = [
  'Peterbilt',
  'Kenworth',
  'Freightliner',
  'Volvo',
  'Mack',
  'International',
  'Western Star',
  'Hino',
  'Isuzu',
  'Ford',
  'Chevrolet',
  'GMC',
  'Ram',
  'Great Dane',
  'Utility Trailer',
  'Wabash',
  'Fontaine',
  'Caterpillar',
  'John Deere',
  'Komatsu',
];

const CONDITIONS = [
  { value: 'new', label: 'New' },
  { value: 'used', label: 'Used' },
  { value: 'certified', label: 'Certified Pre-Owned' },
  { value: 'salvage', label: 'Salvage' },
];

const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
];

// Generate year options (2000 to current year + 1)
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: currentYear - 1999 + 1 }, (_, i) => currentYear + 1 - i);

export function AdvancedFilters({
  filters,
  onFiltersChange,
  categories = [],
  onClose,
  className = '',
}: AdvancedFiltersProps) {
  const [localFilters, setLocalFilters] = useState<FilterValues>(filters);
  const [priceRange, setPriceRange] = useState<[number, number]>([
    filters.priceMin || 0,
    filters.priceMax || 500000,
  ]);

  // Update local state when filters prop changes
  useEffect(() => {
    setLocalFilters(filters);
    setPriceRange([filters.priceMin || 0, filters.priceMax || 500000]);
  }, [filters]);

  const handlePriceRangeChange = (value: number[]) => {
    setPriceRange([value[0], value[1]]);
  };

  const handlePriceRangeCommit = (value: number[]) => {
    const newFilters = {
      ...localFilters,
      priceMin: value[0] > 0 ? value[0] : undefined,
      priceMax: value[1] < 500000 ? value[1] : undefined,
    };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleYearChange = (field: 'yearMin' | 'yearMax', value: string) => {
    const newFilters = {
      ...localFilters,
      [field]: value ? parseInt(value) : undefined,
    };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleMileageChange = (value: string) => {
    const newFilters = {
      ...localFilters,
      mileageMax: value ? parseInt(value) : undefined,
    };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleMakeToggle = (make: string, checked: boolean) => {
    const currentMakes = localFilters.makes || [];
    const newMakes = checked
      ? [...currentMakes, make]
      : currentMakes.filter((m) => m !== make);

    const newFilters = {
      ...localFilters,
      makes: newMakes.length > 0 ? newMakes : undefined,
    };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleConditionToggle = (condition: string, checked: boolean) => {
    const currentConditions = localFilters.conditions || [];
    const newConditions = checked
      ? [...currentConditions, condition]
      : currentConditions.filter((c) => c !== condition);

    const newFilters = {
      ...localFilters,
      conditions: newConditions.length > 0 ? newConditions : undefined,
    };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleStateChange = (value: string) => {
    const newFilters = {
      ...localFilters,
      states: value && value !== 'all' ? [value] : undefined,
    };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleCategoryChange = (value: string) => {
    const newFilters = {
      ...localFilters,
      category: value && value !== 'all' ? value : undefined,
    };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const resetFilters = () => {
    const emptyFilters: FilterValues = {};
    setLocalFilters(emptyFilters);
    setPriceRange([0, 500000]);
    onFiltersChange(emptyFilters);
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (localFilters.priceMin || localFilters.priceMax) count++;
    if (localFilters.yearMin || localFilters.yearMax) count++;
    if (localFilters.mileageMax) count++;
    if (localFilters.makes?.length) count += localFilters.makes.length;
    if (localFilters.conditions?.length) count += localFilters.conditions.length;
    if (localFilters.states?.length) count++;
    if (localFilters.category) count++;
    return count;
  };

  const activeCount = getActiveFilterCount();

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">Filters</h3>
          {activeCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {activeCount} active
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-xs gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <Accordion type="multiple" defaultValue={['price', 'year', 'make']} className="w-full">
        {/* Category Filter */}
        {categories.length > 0 && (
          <AccordionItem value="category">
            <AccordionTrigger className="text-sm">Category</AccordionTrigger>
            <AccordionContent>
              <Select
                value={localFilters.category || 'all'}
                onValueChange={handleCategoryChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.slug}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Price Range */}
        <AccordionItem value="price">
          <AccordionTrigger className="text-sm">Price Range</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <Slider
              value={priceRange}
              onValueChange={handlePriceRangeChange}
              onValueCommit={handlePriceRangeCommit}
              min={0}
              max={500000}
              step={5000}
              className="w-full"
            />
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Min</Label>
                <Input
                  type="number"
                  value={priceRange[0]}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setPriceRange([val, priceRange[1]]);
                  }}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    handlePriceRangeCommit([val, priceRange[1]]);
                  }}
                  className="h-8 text-sm"
                  placeholder="$0"
                />
              </div>
              <span className="text-muted-foreground mt-4">-</span>
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Max</Label>
                <Input
                  type="number"
                  value={priceRange[1]}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 500000;
                    setPriceRange([priceRange[0], val]);
                  }}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value) || 500000;
                    handlePriceRangeCommit([priceRange[0], val]);
                  }}
                  className="h-8 text-sm"
                  placeholder="$500,000+"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              ${priceRange[0].toLocaleString()} - ${priceRange[1].toLocaleString()}
              {priceRange[1] >= 500000 ? '+' : ''}
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* Year Range */}
        <AccordionItem value="year">
          <AccordionTrigger className="text-sm">Year</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Select
                  value={localFilters.yearMin?.toString() || ''}
                  onValueChange={(v) => handleYearChange('yearMin', v)}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    {YEARS.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <span className="text-muted-foreground mt-4">-</span>
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Select
                  value={localFilters.yearMax?.toString() || ''}
                  onValueChange={(v) => handleYearChange('yearMax', v)}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    {YEARS.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Make */}
        <AccordionItem value="make">
          <AccordionTrigger className="text-sm">
            Make
            {localFilters.makes?.length ? (
              <Badge variant="secondary" className="ml-2 text-xs">
                {localFilters.makes.length}
              </Badge>
            ) : null}
          </AccordionTrigger>
          <AccordionContent className="pt-2">
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {TRUCK_MAKES.map((make) => (
                <div key={make} className="flex items-center space-x-2">
                  <Checkbox
                    id={`make-${make}`}
                    checked={localFilters.makes?.includes(make) || false}
                    onCheckedChange={(checked) =>
                      handleMakeToggle(make, checked as boolean)
                    }
                  />
                  <label
                    htmlFor={`make-${make}`}
                    className="text-sm leading-none cursor-pointer"
                  >
                    {make}
                  </label>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Condition */}
        <AccordionItem value="condition">
          <AccordionTrigger className="text-sm">Condition</AccordionTrigger>
          <AccordionContent className="pt-2">
            <div className="space-y-2">
              {CONDITIONS.map((condition) => (
                <div key={condition.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`condition-${condition.value}`}
                    checked={localFilters.conditions?.includes(condition.value) || false}
                    onCheckedChange={(checked) =>
                      handleConditionToggle(condition.value, checked as boolean)
                    }
                  />
                  <label
                    htmlFor={`condition-${condition.value}`}
                    className="text-sm leading-none cursor-pointer"
                  >
                    {condition.label}
                  </label>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Mileage */}
        <AccordionItem value="mileage">
          <AccordionTrigger className="text-sm">Max Mileage</AccordionTrigger>
          <AccordionContent className="pt-2">
            <Select
              value={localFilters.mileageMax?.toString() || ''}
              onValueChange={handleMileageChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Any mileage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any mileage</SelectItem>
                <SelectItem value="100000">Under 100,000 mi</SelectItem>
                <SelectItem value="200000">Under 200,000 mi</SelectItem>
                <SelectItem value="300000">Under 300,000 mi</SelectItem>
                <SelectItem value="400000">Under 400,000 mi</SelectItem>
                <SelectItem value="500000">Under 500,000 mi</SelectItem>
                <SelectItem value="750000">Under 750,000 mi</SelectItem>
                <SelectItem value="1000000">Under 1,000,000 mi</SelectItem>
              </SelectContent>
            </Select>
          </AccordionContent>
        </AccordionItem>

        {/* Location */}
        <AccordionItem value="location">
          <AccordionTrigger className="text-sm">Location</AccordionTrigger>
          <AccordionContent className="pt-2">
            <Select
              value={localFilters.states?.[0] || 'all'}
              onValueChange={handleStateChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="All States" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {US_STATES.map((state) => (
                  <SelectItem key={state.value} value={state.value}>
                    {state.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
