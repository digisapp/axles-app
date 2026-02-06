'use client';

import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Mail,
  Phone,
  FileText,
  DollarSign,
  CreditCard,
  Clock,
  Package,
  User,
  Loader2,
  Download,
  Plus,
  Trash2,
  Check,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Deal, DealLineItem, DealPayment, DealActivity, DealStatus } from '@/types/deals';

interface DealDetailSheetProps {
  dealId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const statusOptions: { value: DealStatus; label: string }[] = [
  { value: 'quote', label: 'Quote' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'finalized', label: 'Finalized' },
  { value: 'closed', label: 'Closed' },
  { value: 'lost', label: 'Lost' },
];

export function DealDetailSheet({ dealId, open, onOpenChange, onUpdate }: DealDetailSheetProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deal, setDeal] = useState<Deal | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Line item form
  const [addingLineItem, setAddingLineItem] = useState(false);
  const [newLineItem, setNewLineItem] = useState({
    item_type: 'fee' as const,
    description: '',
    quantity: 1,
    unit_price: 0,
  });

  // Payment form
  const [addingPayment, setAddingPayment] = useState(false);
  const [newPayment, setNewPayment] = useState({
    payment_type: 'deposit' as const,
    payment_method: 'check' as const,
    amount: 0,
    payment_date: new Date().toISOString().split('T')[0],
    reference_number: '',
  });

  useEffect(() => {
    if (open && dealId) {
      fetchDeal();
    }
  }, [open, dealId]);

  const fetchDeal = async () => {
    if (!dealId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/deal-desk/${dealId}`);
      if (res.ok) {
        const { data } = await res.json();
        setDeal(data);
      } else {
        toast.error('Failed to load deal');
      }
    } catch (error) {
      console.error('Error fetching deal:', error);
      toast.error('Failed to load deal');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus: DealStatus) => {
    if (!deal) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/deal-desk/${deal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        setDeal({ ...deal, status: newStatus });
        onUpdate();
        toast.success('Status updated');
      } else {
        throw new Error('Failed to update');
      }
    } catch (error) {
      toast.error('Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  const generateQuote = async () => {
    if (!deal) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/deal-desk/${deal.id}/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `quote-${deal.deal_number}.pdf`;
        a.click();
        URL.revokeObjectURL(url);

        await fetchDeal();
        toast.success('Quote generated');
      } else {
        throw new Error('Failed to generate');
      }
    } catch (error) {
      toast.error('Failed to generate quote');
    } finally {
      setSaving(false);
    }
  };

  const addLineItem = async () => {
    if (!deal || !newLineItem.description || newLineItem.unit_price === 0) {
      toast.error('Please fill in all fields');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/deal-desk/${deal.id}/line-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLineItem),
      });

      if (res.ok) {
        await fetchDeal();
        setAddingLineItem(false);
        setNewLineItem({ item_type: 'fee', description: '', quantity: 1, unit_price: 0 });
        toast.success('Line item added');
      } else {
        throw new Error('Failed to add');
      }
    } catch (error) {
      toast.error('Failed to add line item');
    } finally {
      setSaving(false);
    }
  };

  const removeLineItem = async (itemId: string) => {
    if (!deal) return;

    try {
      const res = await fetch(`/api/deal-desk/${deal.id}/line-items/${itemId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchDeal();
        toast.success('Line item removed');
      } else {
        throw new Error('Failed to remove');
      }
    } catch (error) {
      toast.error('Failed to remove line item');
    }
  };

  const addPayment = async () => {
    if (!deal || newPayment.amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/deal-desk/${deal.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPayment),
      });

      if (res.ok) {
        await fetchDeal();
        setAddingPayment(false);
        setNewPayment({
          payment_type: 'deposit',
          payment_method: 'check',
          amount: 0,
          payment_date: new Date().toISOString().split('T')[0],
          reference_number: '',
        });
        toast.success('Payment recorded');
      } else {
        throw new Error('Failed to add');
      }
    } catch (error) {
      toast.error('Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  if (!open) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        {loading ? (
          <DealDetailSkeleton />
        ) : deal ? (
          <>
            <SheetHeader>
              <div className="flex items-center justify-between">
                <div>
                  <SheetTitle className="text-xl">{deal.deal_number}</SheetTitle>
                  <p className="text-sm text-muted-foreground">{deal.buyer_name}</p>
                </div>
                <Select value={deal.status} onValueChange={updateStatus} disabled={saving}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </SheetHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="pricing">Pricing</TabsTrigger>
                <TabsTrigger value="payments">Payments</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4 mt-4">
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
                  <Button onClick={generateQuote} disabled={saving} className="flex-1">
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                    Generate Quote
                  </Button>
                </div>
              </TabsContent>

              {/* Pricing Tab */}
              <TabsContent value="pricing" className="space-y-4 mt-4">
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
                          onClick={() => removeLineItem(item.id)}
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
                        <Button onClick={addLineItem} disabled={saving} size="sm">
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
              </TabsContent>

              {/* Payments Tab */}
              <TabsContent value="payments" className="space-y-4 mt-4">
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
                        <Button onClick={addPayment} disabled={saving} size="sm">
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
              </TabsContent>

              {/* Activity Tab */}
              <TabsContent value="activity" className="mt-4">
                <div className="space-y-4">
                  {deal.activities?.map((activity) => (
                    <div key={activity.id} className="flex gap-3">
                      <div className="w-2 h-2 mt-2 rounded-full bg-muted-foreground" />
                      <div>
                        <p className="font-medium">{activity.title}</p>
                        {activity.description && (
                          <p className="text-sm text-muted-foreground">{activity.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(activity.created_at).toLocaleString()}
                          {activity.performer && ` by ${activity.performer.name}`}
                        </p>
                      </div>
                    </div>
                  ))}

                  {(!deal.activities || deal.activities.length === 0) && (
                    <p className="text-center py-8 text-muted-foreground">No activity yet</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">Deal not found</div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DealDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-24 mt-1" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-40" />
    </div>
  );
}
