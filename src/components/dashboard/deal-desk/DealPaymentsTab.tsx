'use client';

import { memo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CreditCard, Check, X } from 'lucide-react';
import type { Deal } from '@/types/deals';
import { formatCurrency } from '@/lib/format-currency';

interface DealPaymentsTabProps {
  deal: Deal;
  saving: boolean;
  onAddPayment: (payment: {
    payment_type: string;
    payment_method: string;
    amount: number;
    payment_date: string;
    reference_number: string;
  }) => void;
}

export const DealPaymentsTab = memo(function DealPaymentsTab({ deal, saving, onAddPayment }: DealPaymentsTabProps) {
  const [addingPayment, setAddingPayment] = useState(false);
  const [newPayment, setNewPayment] = useState({
    payment_type: 'deposit' as const,
    payment_method: 'check' as const,
    amount: 0,
    payment_date: new Date().toISOString().split('T')[0],
    reference_number: '',
  });

  const handleAdd = () => {
    onAddPayment(newPayment);
    setAddingPayment(false);
    setNewPayment({
      payment_type: 'deposit',
      payment_method: 'check',
      amount: 0,
      payment_date: new Date().toISOString().split('T')[0],
      reference_number: '',
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {deal.payments?.map((payment) => (
          <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-medium capitalize">{payment.payment_type}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(payment.payment_date).toLocaleDateString()} via {payment.payment_method}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={payment.status === 'cleared' ? 'default' : 'secondary'}>
                {payment.status}
              </Badge>
              <span className="font-bold">{formatCurrency(payment.amount)}</span>
            </div>
          </div>
        ))}

        {(!deal.payments || deal.payments.length === 0) && (
          <p className="text-center py-8 text-muted-foreground">No payments recorded</p>
        )}
      </div>

      {/* Add Payment Form */}
      {addingPayment ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select
                  value={newPayment.payment_type}
                  onValueChange={(v) => setNewPayment({ ...newPayment, payment_type: v as 'deposit' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deposit">Deposit</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="final">Final</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Method</Label>
                <Select
                  value={newPayment.payment_method}
                  onValueChange={(v) => setNewPayment({ ...newPayment, payment_method: v as 'check' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="wire">Wire</SelectItem>
                    <SelectItem value="ach">ACH</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="financing">Financing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  value={newPayment.amount}
                  onChange={(e) => setNewPayment({ ...newPayment, amount: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={newPayment.payment_date}
                  onChange={(e) => setNewPayment({ ...newPayment, payment_date: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAdd} disabled={saving} size="sm">
                <Check className="w-4 h-4 mr-1" />
                Record Payment
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAddingPayment(false)}>
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button variant="outline" onClick={() => setAddingPayment(true)}>
          <CreditCard className="w-4 h-4 mr-2" />
          Record Payment
        </Button>
      )}
    </div>
  );
});
