'use client';

import { memo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  MessageSquare,
  Clock,
  User,
  UserCircle,
  Package,
  TrendingUp,
  CalendarClock,
  Bell,
  Loader2,
} from 'lucide-react';

interface Lead {
  id: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone?: string;
  message?: string;
  status: string;
  priority: string;
  score?: number;
  score_factors?: {
    companyEmail?: boolean;
    hasPhone?: boolean;
    phoneMatchesState?: boolean;
    highIntentMessage?: boolean;
    aiSentiment?: string;
    aiIntent?: string;
  };
  notes?: string;
  last_contacted_at?: string;
  follow_up_date?: string;
  follow_up_note?: string;
  assigned_to?: string;
  created_at: string;
  listing?: {
    id: string;
    title: string;
    price?: number;
  } | null;
}

interface TeamMember {
  id: string;
  email: string;
  company_name?: string;
}

interface LeadDetailDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSaving: boolean;
  followUpDate: string;
  followUpNote: string;
  notes: string;
  assignedTo: string | null;
  onFollowUpDateChange: (value: string) => void;
  onFollowUpNoteChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onAssignedToChange: (value: string | null) => void;
  onSave: () => void;
  teamMembers: TeamMember[];
  currentUserId?: string;
}

export const LeadDetailDialog = memo(function LeadDetailDialog({
  lead,
  open,
  onOpenChange,
  isSaving,
  followUpDate,
  followUpNote,
  notes,
  assignedTo,
  onFollowUpDateChange,
  onFollowUpNoteChange,
  onNotesChange,
  onAssignedToChange,
  onSave,
  teamMembers,
  currentUserId,
}: LeadDetailDialogProps) {
  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            {lead.buyer_name}
          </DialogTitle>
          <DialogDescription>
            Lead details and contact information
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Contact Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <a href={`mailto:${lead.buyer_email}`} className="text-primary hover:underline">
                {lead.buyer_email}
              </a>
            </div>
            {lead.buyer_phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <a href={`tel:${lead.buyer_phone}`} className="text-primary hover:underline">
                  {lead.buyer_phone}
                </a>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {new Date(lead.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Listing Reference */}
          {lead.listing && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Package className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{lead.listing.title}</span>
              </div>
              {lead.listing.price && (
                <p className="text-sm text-muted-foreground mt-1">
                  ${lead.listing.price.toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* Message */}
          {lead.message && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Message
              </h4>
              <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                {lead.message}
              </p>
            </div>
          )}

          {/* Lead Score Breakdown */}
          {lead.score !== undefined && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Lead Score: {lead.score}/100
              </h4>
              {lead.score_factors && (
                <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg space-y-1">
                  {lead.score_factors.companyEmail && (
                    <p className="text-green-600">✓ Business email domain</p>
                  )}
                  {lead.score_factors.hasPhone && (
                    <p className="text-green-600">✓ Phone number provided</p>
                  )}
                  {lead.score_factors.phoneMatchesState && (
                    <p className="text-green-600">✓ Local buyer (phone matches state)</p>
                  )}
                  {lead.score_factors.highIntentMessage && (
                    <p className="text-green-600">✓ High-intent keywords detected</p>
                  )}
                  {lead.score_factors.aiSentiment === 'very_positive' && (
                    <p className="text-green-600">✓ AI: Very positive sentiment</p>
                  )}
                  {lead.score_factors.aiIntent === 'ready_to_buy' && (
                    <p className="text-green-600">✓ AI: Ready to buy</p>
                  )}
                  {lead.score_factors.aiIntent === 'serious_inquiry' && (
                    <p className="text-blue-600">○ AI: Serious inquiry</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Assignment */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <UserCircle className="w-4 h-4" />
              Assigned To
            </Label>
            <Select
              value={assignedTo || 'unassigned'}
              onValueChange={(value) => onAssignedToChange(value === 'unassigned' ? null : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {currentUserId && (
                  <SelectItem value={currentUserId}>
                    Me {teamMembers.find(m => m.id === currentUserId)?.company_name ? `(${teamMembers.find(m => m.id === currentUserId)?.company_name})` : ''}
                  </SelectItem>
                )}
                {teamMembers
                  .filter(m => m.id !== currentUserId)
                  .map(member => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.company_name || member.email}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Follow-up Reminder */}
          <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <CalendarClock className="w-4 h-4" />
              Follow-up Reminder
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="follow-up-date" className="text-xs">Date</Label>
                <Input
                  id="follow-up-date"
                  type="date"
                  value={followUpDate}
                  onChange={(e) => onFollowUpDateChange(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="follow-up-note" className="text-xs">Note</Label>
                <Input
                  id="follow-up-note"
                  placeholder="Call back..."
                  value={followUpNote}
                  onChange={(e) => onFollowUpNoteChange(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
            {followUpDate && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Bell className="w-3 h-3" />
                Reminder set for {new Date(followUpDate).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Notes</h4>
            <Textarea
              placeholder="Add notes about this lead..."
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          {/* Save Button */}
          <Button onClick={onSave} disabled={isSaving} className="w-full">
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" asChild>
              <a href={`mailto:${lead.buyer_email}`}>
                <Mail className="w-4 h-4 mr-2" />
                Email
              </a>
            </Button>
            {lead.buyer_phone && (
              <Button variant="outline" className="flex-1" asChild>
                <a href={`tel:${lead.buyer_phone}`}>
                  <Phone className="w-4 h-4 mr-2" />
                  Call
                </a>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});
