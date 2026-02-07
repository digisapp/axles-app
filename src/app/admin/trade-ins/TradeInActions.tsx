'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  MoreHorizontal,
  Mail,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Loader2,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';

interface TradeInActionsProps {
  tradeInId: string;
  currentStatus: string;
  contactEmail: string;
  contactName: string;
  equipmentInfo: string;
}

export function TradeInActions({
  tradeInId,
  currentStatus,
  contactEmail,
  contactName,
  equipmentInfo,
}: TradeInActionsProps) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [showOfferDialog, setShowOfferDialog] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerMessage, setOfferMessage] = useState(
    `Hi ${contactName},\n\nThank you for your interest in trading in your ${equipmentInfo}.\n\nAfter reviewing your submission, we'd like to offer you $[AMOUNT] for your equipment.\n\nPlease let us know if you'd like to proceed or if you have any questions.\n\nBest regards,\nAxlonAI Team`
  );
  const [isSendingOffer, setIsSendingOffer] = useState(false);

  const updateStatus = async (newStatus: string) => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/trade-ins/${tradeInId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        toast.success(`Status updated to ${newStatus}`);
        router.refresh();
      } else {
        toast.error('Failed to update status');
      }
    } catch (error) {
      toast.error('Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  };

  const sendOffer = async () => {
    if (!offerAmount) {
      toast.error('Please enter an offer amount');
      return;
    }

    setIsSendingOffer(true);
    try {
      // Update message with actual amount
      const finalMessage = offerMessage.replace('[AMOUNT]', offerAmount);

      const response = await fetch(`/api/admin/trade-ins/${tradeInId}/offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offer_amount: parseFloat(offerAmount),
          message: finalMessage,
          email: contactEmail,
        }),
      });

      if (response.ok) {
        toast.success('Offer sent successfully');
        setShowOfferDialog(false);
        router.refresh();
      } else {
        toast.error('Failed to send offer');
      }
    } catch (error) {
      toast.error('Failed to send offer');
    } finally {
      setIsSendingOffer(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Dialog open={showOfferDialog} onOpenChange={setShowOfferDialog}>
        <DialogTrigger asChild>
          <Button size="sm" variant="default" disabled={currentStatus === 'accepted' || currentStatus === 'completed'}>
            <DollarSign className="w-4 h-4 mr-1" />
            Send Offer
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Trade-In Offer</DialogTitle>
            <DialogDescription>
              Send a valuation offer to {contactName} for their {equipmentInfo}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="offer">Offer Amount ($)</Label>
              <Input
                id="offer"
                type="number"
                placeholder="25000"
                value={offerAmount}
                onChange={(e) => setOfferAmount(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="message">Email Message</Label>
              <Textarea
                id="message"
                value={offerMessage}
                onChange={(e) => setOfferMessage(e.target.value)}
                rows={8}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                [AMOUNT] will be replaced with the offer amount
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOfferDialog(false)}>
              Cancel
            </Button>
            <Button onClick={sendOffer} disabled={isSendingOffer}>
              {isSendingOffer ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send Offer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" disabled={isUpdating}>
            {isUpdating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <MoreHorizontal className="w-4 h-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => updateStatus('contacted')}>
            <Mail className="w-4 h-4 mr-2" />
            Mark as Contacted
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => updateStatus('offered')}>
            <DollarSign className="w-4 h-4 mr-2" />
            Mark as Offered
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => updateStatus('accepted')} className="text-green-600">
            <CheckCircle className="w-4 h-4 mr-2" />
            Mark as Accepted
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => updateStatus('rejected')} className="text-red-600">
            <XCircle className="w-4 h-4 mr-2" />
            Mark as Rejected
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => updateStatus('pending')}>
            <Clock className="w-4 h-4 mr-2" />
            Reset to Pending
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
