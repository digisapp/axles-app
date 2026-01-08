'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  MoreVertical,
  MessageSquare,
  CheckCircle,
  XCircle,
  ArrowRight,
  Clock,
  User,
  UserCircle,
  Package,
  Flame,
  TrendingUp,
  CalendarClock,
  Bell,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

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

interface LeadKanbanProps {
  leads: Lead[];
  teamMembers?: TeamMember[];
  currentUserId?: string;
}

const columns = [
  { id: 'new', label: 'New', color: 'bg-blue-500' },
  { id: 'contacted', label: 'Contacted', color: 'bg-yellow-500' },
  { id: 'qualified', label: 'Qualified', color: 'bg-purple-500' },
  { id: 'won', label: 'Won', color: 'bg-green-500' },
];

export function LeadKanban({ leads: initialLeads, teamMembers = [], currentUserId }: LeadKanbanProps) {
  const [leads, setLeads] = useState(initialLeads);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNote, setFollowUpNote] = useState('');
  const [notes, setNotes] = useState('');
  const [assignedTo, setAssignedTo] = useState<string | null>(null);

  // Reset form when selected lead changes
  const handleOpenDetail = (lead: Lead) => {
    setSelectedLead(lead);
    setFollowUpDate(lead.follow_up_date ? lead.follow_up_date.split('T')[0] : '');
    setFollowUpNote(lead.follow_up_note || '');
    setNotes(lead.notes || '');
    setAssignedTo(lead.assigned_to || null);
    setIsDetailOpen(true);
  };

  const saveLeadDetails = async () => {
    if (!selectedLead) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/dashboard/leads/${selectedLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes,
          follow_up_date: followUpDate ? new Date(followUpDate).toISOString() : null,
          follow_up_note: followUpNote || null,
          assigned_to: assignedTo || null,
        }),
      });

      if (response.ok) {
        // Update local state
        setLeads(prev =>
          prev.map(lead =>
            lead.id === selectedLead.id
              ? { ...lead, notes, follow_up_date: followUpDate, follow_up_note: followUpNote, assigned_to: assignedTo || undefined }
              : lead
          )
        );
        toast.success('Lead updated successfully');
      } else {
        throw new Error('Failed to update');
      }
    } catch (error) {
      toast.error('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const updateLeadStatus = async (leadId: string, newStatus: string) => {
    // Optimistic update
    setLeads(prev =>
      prev.map(lead =>
        lead.id === leadId ? { ...lead, status: newStatus } : lead
      )
    );

    // API call
    try {
      const response = await fetch(`/api/dashboard/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        // Revert on error
        setLeads(initialLeads);
      }
    } catch (error) {
      setLeads(initialLeads);
    }
  };

  const getLeadsByStatus = (status: string) =>
    leads.filter(lead => lead.status === status);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {columns.map(column => (
          <div key={column.id} className="space-y-3">
            {/* Column Header */}
            <div className="flex items-center gap-2 p-2">
              <div className={`w-3 h-3 rounded-full ${column.color}`} />
              <h3 className="font-semibold">{column.label}</h3>
              <Badge variant="secondary" className="ml-auto">
                {getLeadsByStatus(column.id).length}
              </Badge>
            </div>

            {/* Column Content */}
            <div className="space-y-3 min-h-[200px] p-2 bg-muted/30 rounded-lg">
              {getLeadsByStatus(column.id).map(lead => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  onStatusChange={updateLeadStatus}
                  onViewDetails={() => handleOpenDetail(lead)}
                  teamMembers={teamMembers}
                />
              ))}

              {getLeadsByStatus(column.id).length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No leads
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Lead Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg">
          {selectedLead && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  {selectedLead.buyer_name}
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
                    <a
                      href={`mailto:${selectedLead.buyer_email}`}
                      className="text-primary hover:underline"
                    >
                      {selectedLead.buyer_email}
                    </a>
                  </div>
                  {selectedLead.buyer_phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <a
                        href={`tel:${selectedLead.buyer_phone}`}
                        className="text-primary hover:underline"
                      >
                        {selectedLead.buyer_phone}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {new Date(selectedLead.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Listing Reference */}
                {selectedLead.listing && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">
                        {selectedLead.listing.title}
                      </span>
                    </div>
                    {selectedLead.listing.price && (
                      <p className="text-sm text-muted-foreground mt-1">
                        ${selectedLead.listing.price.toLocaleString()}
                      </p>
                    )}
                  </div>
                )}

                {/* Message */}
                {selectedLead.message && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Message
                    </h4>
                    <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                      {selectedLead.message}
                    </p>
                  </div>
                )}

                {/* Lead Score Breakdown */}
                {selectedLead.score !== undefined && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Lead Score: {selectedLead.score}/100
                    </h4>
                    {selectedLead.score_factors && (
                      <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg space-y-1">
                        {selectedLead.score_factors.companyEmail && (
                          <p className="text-green-600">✓ Business email domain</p>
                        )}
                        {selectedLead.score_factors.hasPhone && (
                          <p className="text-green-600">✓ Phone number provided</p>
                        )}
                        {selectedLead.score_factors.phoneMatchesState && (
                          <p className="text-green-600">✓ Local buyer (phone matches state)</p>
                        )}
                        {selectedLead.score_factors.highIntentMessage && (
                          <p className="text-green-600">✓ High-intent keywords detected</p>
                        )}
                        {selectedLead.score_factors.aiSentiment === 'very_positive' && (
                          <p className="text-green-600">✓ AI: Very positive sentiment</p>
                        )}
                        {selectedLead.score_factors.aiIntent === 'ready_to_buy' && (
                          <p className="text-green-600">✓ AI: Ready to buy</p>
                        )}
                        {selectedLead.score_factors.aiIntent === 'serious_inquiry' && (
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
                    onValueChange={(value) => setAssignedTo(value === 'unassigned' ? null : value)}
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
                        onChange={(e) => setFollowUpDate(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="follow-up-note" className="text-xs">Note</Label>
                      <Input
                        id="follow-up-note"
                        placeholder="Call back..."
                        value={followUpNote}
                        onChange={(e) => setFollowUpNote(e.target.value)}
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
                    onChange={(e) => setNotes(e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>

                {/* Save Button */}
                <Button
                  onClick={saveLeadDetails}
                  disabled={isSaving}
                  className="w-full"
                >
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
                    <a href={`mailto:${selectedLead.buyer_email}`}>
                      <Mail className="w-4 h-4 mr-2" />
                      Email
                    </a>
                  </Button>
                  {selectedLead.buyer_phone && (
                    <Button variant="outline" className="flex-1" asChild>
                      <a href={`tel:${selectedLead.buyer_phone}`}>
                        <Phone className="w-4 h-4 mr-2" />
                        Call
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function LeadCard({
  lead,
  onStatusChange,
  onViewDetails,
  teamMembers = [],
}: {
  lead: Lead;
  onStatusChange: (id: string, status: string) => void;
  onViewDetails: () => void;
  teamMembers?: TeamMember[];
}) {
  const priorityColors = {
    low: 'bg-gray-100 text-gray-700',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-red-100 text-red-700',
  };

  const nextStatus: Record<string, string> = {
    new: 'contacted',
    contacted: 'qualified',
    qualified: 'won',
  };

  // Score label and styling
  const getScoreDisplay = (score?: number) => {
    if (score === undefined || score === null) return null;
    if (score >= 70) return { label: 'Hot', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: Flame };
    if (score >= 50) return { label: 'Warm', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: TrendingUp };
    if (score >= 30) return { label: 'Cool', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: null };
    return { label: 'Cold', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', icon: null };
  };

  const scoreDisplay = getScoreDisplay(lead.score);

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onViewDetails}>
      <CardContent className="p-3 space-y-2">
        {/* Score Badge (if available) */}
        {scoreDisplay && (
          <div className="flex items-center justify-between mb-1">
            <Badge variant="secondary" className={`text-xs ${scoreDisplay.color}`}>
              {scoreDisplay.icon && <scoreDisplay.icon className="w-3 h-3 mr-1" />}
              {scoreDisplay.label} ({lead.score})
            </Badge>
          </div>
        )}

        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="font-medium truncate">{lead.buyer_name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {lead.buyer_email}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {nextStatus[lead.status] && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(lead.id, nextStatus[lead.status]);
                  }}
                >
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Move to {nextStatus[lead.status]}
                </DropdownMenuItem>
              )}
              {lead.status !== 'won' && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(lead.id, 'won');
                  }}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Mark as Won
                </DropdownMenuItem>
              )}
              {lead.status !== 'lost' && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(lead.id, 'lost');
                  }}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Mark as Lost
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a
                  href={`mailto:${lead.buyer_email}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Send Email
                </a>
              </DropdownMenuItem>
              {lead.buyer_phone && (
                <DropdownMenuItem asChild>
                  <a
                    href={`tel:${lead.buyer_phone}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Call
                  </a>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Listing reference */}
        {lead.listing && (
          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
            <Package className="w-3 h-3" />
            {lead.listing.title}
          </p>
        )}

        {/* Follow-up indicator */}
        {lead.follow_up_date && (
          <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">
            <Bell className="w-3 h-3" />
            <span>
              {new Date(lead.follow_up_date) <= new Date()
                ? 'Follow-up due!'
                : `Follow-up: ${new Date(lead.follow_up_date).toLocaleDateString()}`}
            </span>
          </div>
        )}

        {/* Assignment indicator */}
        {lead.assigned_to && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <UserCircle className="w-3 h-3" />
            <span>
              {teamMembers.find(m => m.id === lead.assigned_to)?.company_name ||
                teamMembers.find(m => m.id === lead.assigned_to)?.email ||
                'Assigned'}
            </span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <Badge
            variant="secondary"
            className={`text-xs ${priorityColors[lead.priority as keyof typeof priorityColors]}`}
          >
            {lead.priority}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {new Date(lead.created_at).toLocaleDateString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
