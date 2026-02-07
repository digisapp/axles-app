'use client';

import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
  Mail,
  Phone,
  MoreVertical,
  CheckCircle,
  XCircle,
  ArrowRight,
  UserCircle,
  Package,
  Flame,
  TrendingUp,
  Bell,
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
  follow_up_date?: string;
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

interface LeadCardProps {
  lead: Lead;
  onStatusChange: (id: string, status: string) => void;
  onViewDetails: () => void;
  teamMembers?: TeamMember[];
}

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-red-100 text-red-700',
};

const nextStatus: Record<string, string> = {
  new: 'contacted',
  contacted: 'qualified',
  qualified: 'won',
};

function getScoreDisplay(score?: number) {
  if (score === undefined || score === null) return null;
  if (score >= 70) return { label: 'Hot', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: Flame };
  if (score >= 50) return { label: 'Warm', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: TrendingUp };
  if (score >= 30) return { label: 'Cool', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: null };
  return { label: 'Cold', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', icon: null };
}

export const LeadCard = memo(function LeadCard({
  lead,
  onStatusChange,
  onViewDetails,
  teamMembers = [],
}: LeadCardProps) {
  const scoreDisplay = getScoreDisplay(lead.score);

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onViewDetails}>
      <CardContent className="p-3 space-y-2">
        {/* Score Badge */}
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
            <p className="text-xs text-muted-foreground truncate">{lead.buyer_email}</p>
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
                <a href={`mailto:${lead.buyer_email}`} onClick={(e) => e.stopPropagation()}>
                  <Mail className="w-4 h-4 mr-2" />
                  Send Email
                </a>
              </DropdownMenuItem>
              {lead.buyer_phone && (
                <DropdownMenuItem asChild>
                  <a href={`tel:${lead.buyer_phone}`} onClick={(e) => e.stopPropagation()}>
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
            className={`text-xs ${priorityColors[lead.priority] || ''}`}
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
});
