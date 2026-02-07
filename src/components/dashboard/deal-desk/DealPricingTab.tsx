'use client';

import { memo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Check, X } from 'lucide-react';
import type { Deal } from '@/types/deals';
import { formatCurrency } from '@/lib/format-currency';

interface DealPricingTabProps {
  deal: Deal;
  saving: boolean;
  onAddLineItem: (item: { item_type: string; description: string; quantity: number; unit_price: number }) => void;
  onRemoveLineItem: (itemId: string) => void;
}

export const DealPricingTab = memo(function DealPricingTab({ deal, saving, onAddLineItem, onRemoveLineItem }: DealPricingTabProps) {
  const [addingLineItem, setAddingLineItem] = useState(false);
  const [newLineItem, setNewLineItem] = useState({
    item_type: 'fee' as const,
    description: '',
    quantity: 1,
    unit_price: 0,
  });

  const handleAdd = () => {
    onAddLineItem(newLineItem);
    setAddingLineItem(false);
    setNewLineItem({ item_type: 'fee', description: '', quantity: 1, unit_price: 0 });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {deal.line_items?.map((item) => (
          <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-medium">{item.description}</p>
              <p className="text-xs text-muted-foreground capitalize">{item.item_type}</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-medium">
                {item.quantity > 1 && `${item.quantity} x `}
                {formatCurrency(item.unit_price)}
              </span>
              <span className="font-bold">{formatCurrency(item.total_price)}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => onRemoveLineItem(item.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Line Item Form */}
      {addingLineItem ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select
                  value={newLineItem.item_type}
                  onValueChange={(v) => setNewLineItem({ ...newLineItem, item_type: v as 'fee' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fee">Fee</SelectItem>
                    <SelectItem value="add_on">Add-On</SelectItem>
                    <SelectItem value="tax">Tax</SelectItem>
                    <SelectItem value="discount">Discount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  value={newLineItem.unit_price}
                  onChange={(e) => setNewLineItem({ ...newLineItem, unit_price: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={newLineItem.description}
                onChange={(e) => setNewLineItem({ ...newLineItem, description: e.target.value })}
                placeholder="Documentation fee, warranty, etc."
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAdd} disabled={saving} size="sm">
                <Check className="w-4 h-4 mr-1" />
                Add
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAddingLineItem(false)}>
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button variant="outline" onClick={() => setAddingLineItem(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Line Item
        </Button>
      )}

      {/* Totals */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatCurrency(deal.sale_price)}</span>
          </div>
          {deal.total_fees > 0 && (
            <div className="flex justify-between text-sm">
              <span>Fees</span>
              <span>{formatCurrency(deal.total_fees)}</span>
            </div>
          )}
          {deal.total_taxes > 0 && (
            <div className="flex justify-between text-sm">
              <span>Taxes</span>
              <span>{formatCurrency(deal.total_taxes)}</span>
            </div>
          )}
          {deal.trade_in_allowance > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Trade-In</span>
              <span>-{formatCurrency(deal.trade_in_allowance)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg pt-2 border-t">
            <span>Total Due</span>
            <span>{formatCurrency(deal.total_due)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
