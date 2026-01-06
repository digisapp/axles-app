'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Download, Loader2, FileSpreadsheet } from 'lucide-react';

interface BulkExportProps {
  listingsCount: number;
}

export function BulkExport({ listingsCount }: BulkExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [includeFields, setIncludeFields] = useState({
    basic: true,
    pricing: true,
    specs: true,
    location: true,
    inventory: true,
  });

  const handleExport = async () => {
    setIsExporting(true);

    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      Object.entries(includeFields).forEach(([key, value]) => {
        if (value) params.append('include', key);
      });

      const response = await fetch(
        `/api/dashboard/bulk/export?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `listings-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Filter */}
      <div className="space-y-2">
        <Label>Filter by Status</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Listings ({listingsCount})</SelectItem>
            <SelectItem value="active">Active Only</SelectItem>
            <SelectItem value="draft">Drafts Only</SelectItem>
            <SelectItem value="sold">Sold Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Field Selection */}
      <div className="space-y-3">
        <Label>Include Fields</Label>
        <div className="space-y-2">
          {[
            { id: 'basic', label: 'Basic Info', desc: 'Title, category, condition' },
            { id: 'pricing', label: 'Pricing', desc: 'Price, price type' },
            { id: 'specs', label: 'Specifications', desc: 'Year, make, model, VIN, mileage' },
            { id: 'location', label: 'Location', desc: 'City, state, zip code' },
            { id: 'inventory', label: 'Inventory', desc: 'Stock #, quantity, cost' },
          ].map((field) => (
            <div
              key={field.id}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
            >
              <Checkbox
                id={field.id}
                checked={includeFields[field.id as keyof typeof includeFields]}
                onCheckedChange={(checked) =>
                  setIncludeFields((prev) => ({
                    ...prev,
                    [field.id]: checked === true,
                  }))
                }
              />
              <div className="grid gap-0.5">
                <Label htmlFor={field.id} className="cursor-pointer">
                  {field.label}
                </Label>
                <p className="text-xs text-muted-foreground">{field.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Export Button */}
      <Button
        onClick={handleExport}
        disabled={isExporting || listingsCount === 0}
        className="w-full"
      >
        {isExporting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <Download className="w-4 h-4 mr-2" />
            Export {listingsCount} Listings
          </>
        )}
      </Button>

      {listingsCount === 0 && (
        <p className="text-sm text-muted-foreground text-center">
          No listings to export. Create some listings first.
        </p>
      )}
    </div>
  );
}
