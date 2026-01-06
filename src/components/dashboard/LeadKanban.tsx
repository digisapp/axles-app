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
  Package,
} from 'lucide-react';

interface Lead {
  id: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone?: string;
  message?: string;
  status: string;
  priority: string;
  notes?: string;
  last_contacted_at?: string;
  created_at: string;
  listing?: {
    id: string;
    title: string;
    price?: number;
  } | null;
}

interface LeadKanbanProps {
  leads: Lead[];
}

const columns = [
  { id: 'new', label: 'New', color: 'bg-blue-500' },
  { id: 'contacted', label: 'Contacted', color: 'bg-yellow-500' },
  { id: 'qualified', label: 'Qualified', color: 'bg-purple-500' },
  { id: 'won', label: 'Won', color: 'bg-green-500' },
];

export function LeadKanban({ leads: initialLeads }: LeadKanbanProps) {
  const [leads, setLeads] = useState(initialLeads);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

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
                  onViewDetails={() => {
                    setSelectedLead(lead);
                    setIsDetailOpen(true);
                  }}
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

                {/* Notes */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Notes</h4>
                  <Textarea
                    placeholder="Add notes about this lead..."
                    defaultValue={selectedLead.notes || ''}
                    className="min-h-[100px]"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4">
                  <Button className="flex-1" asChild>
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
}: {
  lead: Lead;
  onStatusChange: (id: string, status: string) => void;
  onViewDetails: () => void;
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

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onViewDetails}>
      <CardContent className="p-3 space-y-2">
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
