'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Building2,
  Mail,
  Phone,
  MapPin,
  Loader2,
  Eye,
  FileText,
} from 'lucide-react';

interface Dealer {
  id: string;
  email: string;
  company_name: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  is_dealer: boolean;
  dealer_status: string;
  dealer_applied_at: string | null;
  dealer_reviewed_at: string | null;
  dealer_rejection_reason: string | null;
  business_license: string | null;
  tax_id: string | null;
  created_at: string;
  avatar_url: string | null;
}

export default function AdminDealersPage() {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchDealers();
  }, [statusFilter]);

  const fetchDealers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/dealers?status=${statusFilter}`);
      if (response.ok) {
        const data = await response.json();
        setDealers(data.data || []);
        setCounts(data.counts || { pending: 0, approved: 0, rejected: 0 });
      }
    } catch (error) {
      console.error('Error fetching dealers:', error);
    }
    setIsLoading(false);
  };

  const handleAction = async () => {
    if (!selectedDealer || !actionType) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/dealers/${selectedDealer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionType,
          rejection_reason: actionType === 'reject' ? rejectionReason : undefined,
        }),
      });

      if (response.ok) {
        setSelectedDealer(null);
        setActionType(null);
        setRejectionReason('');
        fetchDealers();
      }
    } catch (error) {
      console.error('Error updating dealer:', error);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Dealer Verification</h1>
              <p className="text-sm text-muted-foreground">
                Review and approve dealer applications
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card
            className={`cursor-pointer transition-colors ${
              statusFilter === 'pending' ? 'border-primary' : ''
            }`}
            onClick={() => setStatusFilter('pending')}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{counts.pending}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-colors ${
              statusFilter === 'approved' ? 'border-primary' : ''
            }`}
            onClick={() => setStatusFilter('approved')}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{counts.approved}</p>
                <p className="text-sm text-muted-foreground">Approved</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-colors ${
              statusFilter === 'rejected' ? 'border-primary' : ''
            }`}
            onClick={() => setStatusFilter('rejected')}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{counts.rejected}</p>
                <p className="text-sm text-muted-foreground">Rejected</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Dealers List */}
        <Card>
          <CardHeader>
            <CardTitle>
              {statusFilter === 'pending' && 'Pending Applications'}
              {statusFilter === 'approved' && 'Approved Dealers'}
              {statusFilter === 'rejected' && 'Rejected Applications'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : dealers.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No {statusFilter} applications</p>
              </div>
            ) : (
              <div className="space-y-4">
                {dealers.map((dealer) => (
                  <div
                    key={dealer.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={dealer.avatar_url || undefined} />
                        <AvatarFallback>
                          {(dealer.company_name || dealer.email)?.[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold">
                          {dealer.company_name || 'No Company Name'}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {dealer.email}
                          </span>
                          {dealer.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {dealer.phone}
                            </span>
                          )}
                          {(dealer.city || dealer.state) && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {[dealer.city, dealer.state].filter(Boolean).join(', ')}
                            </span>
                          )}
                        </div>
                        {dealer.dealer_applied_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Applied: {new Date(dealer.dealer_applied_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {dealer.business_license && (
                        <Badge variant="outline" className="gap-1">
                          <FileText className="w-3 h-3" />
                          License
                        </Badge>
                      )}

                      {statusFilter === 'pending' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => {
                              setSelectedDealer(dealer);
                              setActionType('approve');
                            }}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              setSelectedDealer(dealer);
                              setActionType('reject');
                            }}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </>
                      )}

                      {statusFilter === 'rejected' && dealer.dealer_rejection_reason && (
                        <Badge variant="destructive" className="max-w-[200px] truncate">
                          {dealer.dealer_rejection_reason}
                        </Badge>
                      )}

                      <Link href={`/${dealer.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Action Dialog */}
      <Dialog
        open={!!selectedDealer && !!actionType}
        onOpenChange={() => {
          setSelectedDealer(null);
          setActionType(null);
          setRejectionReason('');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? 'Approve Dealer' : 'Reject Application'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve'
                ? `Are you sure you want to approve ${selectedDealer?.company_name || selectedDealer?.email} as a dealer?`
                : `Please provide a reason for rejecting ${selectedDealer?.company_name || selectedDealer?.email}'s application.`}
            </DialogDescription>
          </DialogHeader>

          {actionType === 'reject' && (
            <div className="py-4">
              <Textarea
                placeholder="Reason for rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedDealer(null);
                setActionType(null);
                setRejectionReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant={actionType === 'approve' ? 'default' : 'destructive'}
              onClick={handleAction}
              disabled={isSubmitting || (actionType === 'reject' && !rejectionReason)}
            >
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {actionType === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
