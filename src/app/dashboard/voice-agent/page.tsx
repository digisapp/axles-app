'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Loader2,
  Phone,
  Mic,
  MessageSquare,
  Clock,
  CheckCircle,
  Settings,
  PhoneCall,
  Shield,
  Zap,
  Building2,
  AlertTriangle,
  PhoneIncoming,
  PhoneMissed,
  Play,
  UserPlus,
  TrendingUp,
} from 'lucide-react';
import { DealerVoiceAgent } from '@/types';

interface CallLog {
  id: string;
  caller_phone: string;
  caller_name: string | null;
  duration_seconds: number | null;
  status: string;
  recording_url: string | null;
  interest: string | null;
  lead_id: string | null;
  started_at: string;
}

interface CallStats {
  totalCalls: number;
  totalMinutes: number;
  leadsCapture: number;
  avgDuration: number;
}

const VOICE_OPTIONS = [
  { value: 'Sal', label: 'Sal', description: 'Warm, professional male voice' },
  { value: 'Ash', label: 'Ash', description: 'Friendly female voice' },
  { value: 'Coral', label: 'Coral', description: 'Clear, articulate female voice' },
  { value: 'Sage', label: 'Sage', description: 'Calm, reassuring female voice' },
  { value: 'Ballad', label: 'Ballad', description: 'Deep, authoritative male voice' },
  { value: 'Verse', label: 'Verse', description: 'Energetic male voice' },
];

export default function VoiceAgentPage() {
  const router = useRouter();
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [agent, setAgent] = useState<DealerVoiceAgent | null>(null);
  const [isDealer, setIsDealer] = useState(false);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [callStats, setCallStats] = useState<CallStats | null>(null);
  const [isLoadingCalls, setIsLoadingCalls] = useState(false);

  const [formData, setFormData] = useState({
    agent_name: 'AI Assistant',
    voice: 'Sal',
    greeting: 'Thanks for calling! How can I help you today?',
    business_name: '',
    business_description: '',
    instructions: '',
    after_hours_message: 'We are currently closed. Please leave your name and number and we will call you back.',
    can_search_inventory: true,
    can_capture_leads: true,
    can_transfer_calls: false,
    transfer_phone_number: '',
  });

  useEffect(() => {
    fetchVoiceAgent();
  }, []);

  useEffect(() => {
    if (agent) {
      fetchCallLogs();
    }
  }, [agent]);

  const fetchCallLogs = async () => {
    setIsLoadingCalls(true);
    try {
      const response = await fetch('/api/dealer/call-logs?limit=10');
      if (response.ok) {
        const data = await response.json();
        setCallLogs(data.data || []);
        setCallStats(data.stats || null);
      }
    } catch (error) {
      console.error('Error fetching call logs:', error);
    }
    setIsLoadingCalls(false);
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPhoneNumber = (phone: string) => {
    if (!phone) return 'Unknown';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const getUsagePercentage = () => {
    if (!agent) return 0;
    return Math.round((agent.minutes_used / agent.minutes_included) * 100);
  };

  const isNearingLimit = () => {
    return getUsagePercentage() >= 80;
  };

  const isOverLimit = () => {
    return getUsagePercentage() >= 100;
  };

  const fetchVoiceAgent = async () => {
    setIsLoading(true);
    try {
      // Check if user is a dealer
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?redirect=/dashboard/voice-agent');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_dealer, company_name')
        .eq('id', user.id)
        .single();

      setIsDealer(profile?.is_dealer || false);

      if (!profile?.is_dealer) {
        setIsLoading(false);
        return;
      }

      // Fetch voice agent settings
      const response = await fetch('/api/dealer/voice-agent');
      if (response.ok) {
        const data = await response.json();
        if (data.data) {
          setAgent(data.data);
          setFormData({
            agent_name: data.data.agent_name || 'AI Assistant',
            voice: data.data.voice || 'Sal',
            greeting: data.data.greeting || 'Thanks for calling! How can I help you today?',
            business_name: data.data.business_name || profile?.company_name || '',
            business_description: data.data.business_description || '',
            instructions: data.data.instructions || '',
            after_hours_message: data.data.after_hours_message || 'We are currently closed. Please leave your name and number and we will call you back.',
            can_search_inventory: data.data.can_search_inventory ?? true,
            can_capture_leads: data.data.can_capture_leads ?? true,
            can_transfer_calls: data.data.can_transfer_calls ?? false,
            transfer_phone_number: data.data.transfer_phone_number || '',
          });
        }
      }
    } catch (error) {
      console.error('Error fetching voice agent:', error);
    }
    setIsLoading(false);
  };

  const handleSetup = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/dealer/voice-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        setAgent(data.data);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Error creating voice agent:', error);
    }
    setIsSaving(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/dealer/voice-agent', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        setAgent(data.data);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Error saving voice agent:', error);
    }
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isDealer) {
    return (
      <div className="min-h-screen bg-muted/30">
        <header className="bg-background border-b">
          <div className="max-w-2xl mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <h1 className="text-xl font-bold">AI Voice Agent</h1>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <Phone className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Dealer Account Required</h2>
              <p className="text-muted-foreground mb-6">
                The AI Voice Agent is available exclusively for verified dealers.
                Upgrade your account to get your own AI receptionist.
              </p>
              <Button asChild>
                <Link href="/become-a-dealer">Become a Dealer</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Success Toast */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg">
          <CheckCircle className="w-5 h-5" />
          <span>Settings saved successfully!</span>
        </div>
      )}

      {/* Header */}
      <header className="bg-background border-b">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex-1">
              <h1 className="text-xl font-bold">AI Voice Agent</h1>
              <p className="text-sm text-muted-foreground">
                Your personal AI receptionist for handling phone calls
              </p>
            </div>
            {agent && (
              <Badge variant={agent.is_active ? 'default' : 'secondary'}>
                {agent.is_active ? 'Active' : 'Inactive'}
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {!agent ? (
          /* Setup Card */
          <Card>
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <PhoneCall className="w-8 h-8 text-primary" />
              </div>
              <CardTitle>Get Your AI Voice Agent</CardTitle>
              <CardDescription>
                Never miss a call again. Your AI receptionist answers calls 24/7,
                searches your inventory, and captures leads for you.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Features */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                  <Mic className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Natural Conversations</p>
                    <p className="text-xs text-muted-foreground">
                      Sounds like a real person
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                  <Zap className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Instant Inventory Search</p>
                    <p className="text-xs text-muted-foreground">
                      Answers questions about your stock
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                  <MessageSquare className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Lead Capture</p>
                    <p className="text-xs text-muted-foreground">
                      Collects caller info automatically
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Initial Setup Form */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="business_name">Business Name</Label>
                  <Input
                    id="business_name"
                    placeholder="ABC Truck Sales"
                    value={formData.business_name}
                    onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="greeting">Greeting Message</Label>
                  <Textarea
                    id="greeting"
                    placeholder="Thanks for calling ABC Truck Sales! How can I help you today?"
                    value={formData.greeting}
                    onChange={(e) => setFormData({ ...formData, greeting: e.target.value })}
                    rows={2}
                  />
                </div>

                <div>
                  <Label htmlFor="voice">Voice</Label>
                  <Select
                    value={formData.voice}
                    onValueChange={(value) => setFormData({ ...formData, voice: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VOICE_OPTIONS.map((voice) => (
                        <SelectItem key={voice.value} value={voice.value}>
                          <div>
                            <span className="font-medium">{voice.label}</span>
                            <span className="text-muted-foreground ml-2">- {voice.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={handleSetup} disabled={isSaving} className="w-full">
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Start Free Trial (30 minutes)
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Your trial includes 30 minutes of call time. Contact us to get a dedicated phone number.
              </p>
            </CardContent>
          </Card>
        ) : (
          /* Agent Configuration */
          <>
            {/* Usage Alert */}
            {isNearingLimit() && (
              <Card className={isOverLimit() ? 'border-red-500 bg-red-50' : 'border-yellow-500 bg-yellow-50'}>
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className={`w-5 h-5 ${isOverLimit() ? 'text-red-600' : 'text-yellow-600'}`} />
                    <div className="flex-1">
                      <p className={`font-medium ${isOverLimit() ? 'text-red-700' : 'text-yellow-700'}`}>
                        {isOverLimit()
                          ? 'You\'ve used all your minutes!'
                          : `You've used ${getUsagePercentage()}% of your minutes`}
                      </p>
                      <p className={`text-sm ${isOverLimit() ? 'text-red-600' : 'text-yellow-600'}`}>
                        {isOverLimit()
                          ? 'Upgrade now to continue receiving calls.'
                          : `${agent.minutes_included - agent.minutes_used} minutes remaining this billing cycle.`}
                      </p>
                    </div>
                    <Button size="sm" variant={isOverLimit() ? 'destructive' : 'outline'} asChild>
                      <Link href="/dashboard/billing">Upgrade Plan</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Status Card */}
            <Card>
              <CardContent className="py-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      agent.is_active ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      <Phone className={`w-6 h-6 ${agent.is_active ? 'text-green-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold">
                        {agent.phone_number || 'No phone number assigned'}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {agent.is_active
                          ? 'Your AI agent is answering calls'
                          : agent.phone_number
                            ? 'Agent is inactive'
                            : 'Contact us to get a dedicated number'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{agent.minutes_used || 0}</span>
                      <span className="text-muted-foreground">/ {agent.minutes_included} min</span>
                    </div>
                    <div className="w-32 h-2 bg-gray-200 rounded-full mt-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isOverLimit() ? 'bg-red-500' : isNearingLimit() ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(getUsagePercentage(), 100)}%` }}
                      />
                    </div>
                    <Badge variant="outline" className="mt-2 capitalize">
                      {agent.plan_tier} plan
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Call Stats */}
            {callStats && callStats.totalCalls > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                      <PhoneIncoming className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="text-2xl font-bold">{callStats.totalCalls}</p>
                        <p className="text-xs text-muted-foreground">Total Calls</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-green-500" />
                      <div>
                        <p className="text-2xl font-bold">{callStats.totalMinutes}</p>
                        <p className="text-xs text-muted-foreground">Minutes Used</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                      <UserPlus className="w-5 h-5 text-purple-500" />
                      <div>
                        <p className="text-2xl font-bold">{callStats.leadsCapture}</p>
                        <p className="text-xs text-muted-foreground">Leads Captured</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="w-5 h-5 text-orange-500" />
                      <div>
                        <p className="text-2xl font-bold">{formatDuration(callStats.avgDuration)}</p>
                        <p className="text-xs text-muted-foreground">Avg Duration</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Agent Settings
                </CardTitle>
                <CardDescription>
                  Customize how your AI agent handles calls
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="agent_name">Agent Name</Label>
                    <Input
                      id="agent_name"
                      placeholder="AI Assistant"
                      value={formData.agent_name}
                      onChange={(e) => setFormData({ ...formData, agent_name: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      How the agent introduces itself
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="voice">Voice</Label>
                    <Select
                      value={formData.voice}
                      onValueChange={(value) => setFormData({ ...formData, voice: value })}
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
                </div>

                <div>
                  <Label htmlFor="business_name" className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Business Name
                  </Label>
                  <Input
                    id="business_name"
                    placeholder="ABC Truck Sales"
                    value={formData.business_name}
                    onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="greeting">Greeting Message</Label>
                  <Textarea
                    id="greeting"
                    placeholder="Thanks for calling! How can I help you today?"
                    value={formData.greeting}
                    onChange={(e) => setFormData({ ...formData, greeting: e.target.value })}
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    The first thing callers hear when the agent answers
                  </p>
                </div>

                <div>
                  <Label htmlFor="business_description">Business Description</Label>
                  <Textarea
                    id="business_description"
                    placeholder="We specialize in quality used semi trucks and trailers..."
                    value={formData.business_description}
                    onChange={(e) => setFormData({ ...formData, business_description: e.target.value })}
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Helps the AI understand your business to answer questions better
                  </p>
                </div>

                <div>
                  <Label htmlFor="instructions">Custom Instructions</Label>
                  <Textarea
                    id="instructions"
                    placeholder="Always mention our financing options. Direct warranty questions to the service department..."
                    value={formData.instructions}
                    onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Special instructions for how the agent should behave
                  </p>
                </div>

                <div>
                  <Label htmlFor="after_hours_message">After-Hours Message</Label>
                  <Textarea
                    id="after_hours_message"
                    placeholder="We are currently closed. Please leave your name and number and we will call you back."
                    value={formData.after_hours_message}
                    onChange={(e) => setFormData({ ...formData, after_hours_message: e.target.value })}
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Greeting message when calling outside business hours
                  </p>
                </div>

                <Separator />

                {/* Features */}
                <div className="space-y-4">
                  <h4 className="font-medium">Features</h4>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Search Inventory</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow agent to search and describe your listings
                      </p>
                    </div>
                    <Switch
                      checked={formData.can_search_inventory}
                      onCheckedChange={(checked) => setFormData({ ...formData, can_search_inventory: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Capture Leads</Label>
                      <p className="text-sm text-muted-foreground">
                        Collect caller information for follow-up
                      </p>
                    </div>
                    <Switch
                      checked={formData.can_capture_leads}
                      onCheckedChange={(checked) => setFormData({ ...formData, can_capture_leads: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Call Transfer</Label>
                      <p className="text-sm text-muted-foreground">
                        Transfer calls to your phone on request
                      </p>
                    </div>
                    <Switch
                      checked={formData.can_transfer_calls}
                      onCheckedChange={(checked) => setFormData({ ...formData, can_transfer_calls: checked })}
                    />
                  </div>

                  {formData.can_transfer_calls && (
                    <div className="ml-4">
                      <Label htmlFor="transfer_phone_number">Transfer Number</Label>
                      <Input
                        id="transfer_phone_number"
                        type="tel"
                        placeholder="+1-555-123-4567"
                        value={formData.transfer_phone_number}
                        onChange={(e) => setFormData({ ...formData, transfer_phone_number: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </div>

            {/* Recent Calls */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PhoneIncoming className="w-5 h-5" />
                  Recent Calls
                </CardTitle>
                <CardDescription>
                  Your last 10 incoming calls handled by the AI agent
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingCalls ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : callLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Phone className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No calls yet</p>
                    <p className="text-sm">Calls will appear here once your agent starts receiving them</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {callLogs.map((call) => (
                      <div
                        key={call.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            call.status === 'completed' ? 'bg-green-100' : 'bg-gray-100'
                          }`}>
                            {call.status === 'completed' ? (
                              <PhoneIncoming className="w-5 h-5 text-green-600" />
                            ) : (
                              <PhoneMissed className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">
                              {call.caller_name || formatPhoneNumber(call.caller_phone)}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>{new Date(call.started_at).toLocaleDateString()}</span>
                              <span>at</span>
                              <span>{new Date(call.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              {call.lead_id && (
                                <Badge variant="secondary" className="text-xs">
                                  <UserPlus className="w-3 h-3 mr-1" />
                                  Lead
                                </Badge>
                              )}
                            </div>
                            {call.interest && (
                              <p className="text-sm text-muted-foreground mt-1 truncate max-w-md">
                                {call.interest}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-medium">{formatDuration(call.duration_seconds)}</p>
                            <p className="text-xs text-muted-foreground">duration</p>
                          </div>
                          {call.recording_url && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() => window.open(call.recording_url!, '_blank')}
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    {callLogs.length >= 10 && (
                      <div className="text-center pt-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href="/dashboard/calls">View All Calls</Link>
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Upgrade CTA */}
            {agent.plan_tier === 'trial' && (
              <Card className="border-primary">
                <CardContent className="py-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">Upgrade Your Plan</h3>
                      <p className="text-sm text-muted-foreground">
                        Get more minutes and a dedicated phone number
                      </p>
                    </div>
                    <Button asChild>
                      <Link href="/dashboard/billing">View Plans</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}
