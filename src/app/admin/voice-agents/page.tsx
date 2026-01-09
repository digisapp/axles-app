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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  ArrowLeft,
  Phone,
  Building2,
  Loader2,
  Edit,
  Trash2,
  Plus,
  PhoneCall,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  Mic,
} from 'lucide-react';
import { DealerVoiceAgent } from '@/types';

const VOICE_OPTIONS = [
  { value: 'Sal', label: 'Sal (Male)' },
  { value: 'Ash', label: 'Ash (Female)' },
  { value: 'Ballad', label: 'Ballad (Male)' },
  { value: 'Coral', label: 'Coral (Female)' },
  { value: 'Sage', label: 'Sage (Female)' },
  { value: 'Verse', label: 'Verse (Male)' },
];

const PLAN_TIERS = [
  { value: 'trial', label: 'Trial (30 min)', minutes: 30 },
  { value: 'starter', label: 'Starter (100 min)', minutes: 100 },
  { value: 'pro', label: 'Pro (500 min)', minutes: 500 },
  { value: 'unlimited', label: 'Unlimited', minutes: 99999 },
];

interface DealerWithAgent extends DealerVoiceAgent {
  dealer?: {
    id: string;
    email: string;
    company_name: string | null;
    phone: string | null;
  };
  stats?: {
    total_calls: number;
    total_minutes: number;
  };
}

export default function AdminVoiceAgentsPage() {
  const [agents, setAgents] = useState<DealerWithAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<DealerWithAgent | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [counts, setCounts] = useState({ total: 0, active: 0, inactive: 0 });

  // Edit form state
  const [editForm, setEditForm] = useState({
    phone_number: '',
    agent_name: '',
    voice: 'Sal',
    greeting: '',
    business_name: '',
    business_description: '',
    instructions: '',
    plan_tier: 'starter',
    minutes_included: 100,
    is_active: false,
  });

  useEffect(() => {
    fetchAgents();
  }, [statusFilter, searchQuery]);

  const fetchAgents = async () => {
    setIsLoading(true);
    try {
      let url = `/api/admin/dealer-voice-agents?status=${statusFilter}`;
      if (searchQuery) {
        url += `&search=${encodeURIComponent(searchQuery)}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setAgents(data.data || []);
        // Calculate counts
        const all = data.total || 0;
        const active = (data.data || []).filter((a: DealerWithAgent) => a.is_active).length;
        setCounts({
          total: all,
          active: active,
          inactive: all - active,
        });
      }
    } catch (error) {
      console.error('Error fetching voice agents:', error);
    }
    setIsLoading(false);
  };

  const openEditDialog = (agent: DealerWithAgent) => {
    setSelectedAgent(agent);
    setEditForm({
      phone_number: agent.phone_number || '',
      agent_name: agent.agent_name || 'AI Assistant',
      voice: agent.voice || 'Sal',
      greeting: agent.greeting || '',
      business_name: agent.business_name || '',
      business_description: agent.business_description || '',
      instructions: agent.instructions || '',
      plan_tier: agent.plan_tier || 'starter',
      minutes_included: agent.minutes_included || 100,
      is_active: agent.is_active || false,
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!selectedAgent) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/dealer-voice-agents/${selectedAgent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (response.ok) {
        setIsEditing(false);
        setSelectedAgent(null);
        fetchAgents();
      }
    } catch (error) {
      console.error('Error updating voice agent:', error);
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (agent: DealerWithAgent) => {
    if (!confirm(`Are you sure you want to delete the voice agent for ${agent.business_name || agent.dealer?.company_name}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/dealer-voice-agents/${agent.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchAgents();
      }
    } catch (error) {
      console.error('Error deleting voice agent:', error);
    }
  };

  const toggleActive = async (agent: DealerWithAgent) => {
    try {
      const response = await fetch(`/api/admin/dealer-voice-agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !agent.is_active }),
      });

      if (response.ok) {
        fetchAgents();
      }
    } catch (error) {
      console.error('Error toggling voice agent:', error);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Dealer Voice Agents</h1>
                <p className="text-sm text-muted-foreground">
                  Manage AI phone agents for dealers
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card
            className={`cursor-pointer transition-colors ${statusFilter === 'all' ? 'border-primary' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Phone className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{counts.total}</p>
                <p className="text-sm text-muted-foreground">Total Agents</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-colors ${statusFilter === 'active' ? 'border-primary' : ''}`}
            onClick={() => setStatusFilter('active')}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{counts.active}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-colors ${statusFilter === 'inactive' ? 'border-primary' : ''}`}
            onClick={() => setStatusFilter('inactive')}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-2 bg-gray-100 rounded-lg">
                <XCircle className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{counts.inactive}</p>
                <p className="text-sm text-muted-foreground">Inactive</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by business name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Agents List */}
        <Card>
          <CardHeader>
            <CardTitle>Voice Agents</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : agents.length === 0 ? (
              <div className="text-center py-12">
                <Mic className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No voice agents found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar className="w-12 h-12">
                        <AvatarFallback className={agent.is_active ? 'bg-green-100' : 'bg-gray-100'}>
                          <Phone className={`w-5 h-5 ${agent.is_active ? 'text-green-600' : 'text-gray-400'}`} />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold flex items-center gap-2">
                          {agent.business_name || agent.dealer?.company_name || 'Unnamed Agent'}
                          <Badge variant={agent.is_active ? 'default' : 'secondary'}>
                            {agent.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          <Badge variant="outline">{agent.plan_tier}</Badge>
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {agent.phone_number ? (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {agent.phone_number}
                            </span>
                          ) : (
                            <span className="text-amber-600">No phone assigned</span>
                          )}
                          <span className="flex items-center gap-1">
                            <Mic className="w-3 h-3" />
                            {agent.voice}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {agent.minutes_used || 0}/{agent.minutes_included} min
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Dealer: {agent.dealer?.email || 'Unknown'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={agent.is_active}
                        onCheckedChange={() => toggleActive(agent)}
                        disabled={!agent.phone_number}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(agent)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDelete(agent)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Edit Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Voice Agent</DialogTitle>
            <DialogDescription>
              Configure the AI voice agent settings for {selectedAgent?.business_name || selectedAgent?.dealer?.company_name}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone_number">Phone Number (DID)</Label>
                <Input
                  id="phone_number"
                  placeholder="+1-555-123-4567"
                  value={editForm.phone_number}
                  onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent_name">Agent Name</Label>
                <Input
                  id="agent_name"
                  placeholder="AI Assistant"
                  value={editForm.agent_name}
                  onChange={(e) => setEditForm({ ...editForm, agent_name: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="voice">Voice</Label>
                <Select
                  value={editForm.voice}
                  onValueChange={(value) => setEditForm({ ...editForm, voice: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VOICE_OPTIONS.map((voice) => (
                      <SelectItem key={voice.value} value={voice.value}>
                        {voice.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan_tier">Plan</Label>
                <Select
                  value={editForm.plan_tier}
                  onValueChange={(value) => {
                    const plan = PLAN_TIERS.find(p => p.value === value);
                    setEditForm({
                      ...editForm,
                      plan_tier: value,
                      minutes_included: plan?.minutes || 100,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAN_TIERS.map((plan) => (
                      <SelectItem key={plan.value} value={plan.value}>
                        {plan.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="business_name">Business Name</Label>
              <Input
                id="business_name"
                placeholder="ABC Trucking"
                value={editForm.business_name}
                onChange={(e) => setEditForm({ ...editForm, business_name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="greeting">Greeting Message</Label>
              <Textarea
                id="greeting"
                placeholder="Thanks for calling ABC Trucking! How can I help you today?"
                value={editForm.greeting}
                onChange={(e) => setEditForm({ ...editForm, greeting: e.target.value })}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="business_description">Business Description</Label>
              <Textarea
                id="business_description"
                placeholder="We specialize in selling quality used trucks and trailers..."
                value={editForm.business_description}
                onChange={(e) => setEditForm({ ...editForm, business_description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructions">Custom Instructions</Label>
              <Textarea
                id="instructions"
                placeholder="Additional instructions for the AI agent..."
                value={editForm.instructions}
                onChange={(e) => setEditForm({ ...editForm, instructions: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={editForm.is_active}
                onCheckedChange={(checked) => setEditForm({ ...editForm, is_active: checked })}
                disabled={!editForm.phone_number}
              />
              <Label htmlFor="is_active">
                Active {!editForm.phone_number && '(requires phone number)'}
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
