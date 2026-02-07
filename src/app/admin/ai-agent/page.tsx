'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Shield,
  Phone,
  Bot,
  Mic,
  MessageSquare,
  Settings2,
  Save,
  Loader2,
  CheckCircle,
  Volume2,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface AIAgentSettings {
  id: string;
  voice: string;
  agent_name: string;
  greeting_message: string;
  instructions: string;
  model: string;
  temperature: number;
  phone_number: string;
  is_active: boolean;
  updated_at: string;
}

const VOICE_OPTIONS = [
  { value: 'Ara', label: 'Ara', description: 'Female, warm and friendly' },
  { value: 'Eve', label: 'Eve', description: 'Female, professional' },
  { value: 'Mika', label: 'Mika', description: 'Female, energetic' },
  { value: 'Leo', label: 'Leo', description: 'Male, casual and relaxed' },
  { value: 'Rex', label: 'Rex', description: 'Male, authoritative' },
  { value: 'Sal', label: 'Sal', description: 'Male, professional' },
];

export default function AIAgentSettingsPage() {
  const [settings, setSettings] = useState<AIAgentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch('/api/admin/ai-agent');
      if (!res.ok) throw new Error('Failed to fetch settings');
      const data = await res.json();
      setSettings(data);
    } catch (error) {
      logger.error('Error fetching settings', { error });
      toast.error('Failed to load AI agent settings');
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    if (!settings) return;

    setSaving(true);
    try {
      const res = await fetch('/api/admin/ai-agent', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!res.ok) throw new Error('Failed to save settings');

      const updated = await res.json();
      setSettings(updated);
      setHasChanges(false);
      toast.success('AI agent settings saved successfully');
    } catch (error) {
      logger.error('Error saving settings', { error });
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  function updateSetting<K extends keyof AIAgentSettings>(key: K, value: AIAgentSettings[K]) {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
    setHasChanges(true);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <p className="text-muted-foreground">Failed to load settings</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">AI Phone Agent</h1>
              <p className="text-sm text-muted-foreground">
                Configure your AI-powered phone assistant
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" asChild>
              <Link href="/admin">
                <Shield className="w-4 h-4 mr-2" />
                Back to Admin
              </Link>
            </Button>
            <Button onClick={saveSettings} disabled={saving || !hasChanges}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Status Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${settings.is_active ? 'bg-green-100' : 'bg-gray-100'}`}>
                  <Phone className={`w-6 h-6 ${settings.is_active ? 'text-green-600' : 'text-gray-400'}`} />
                </div>
                <div>
                  <h2 className="font-semibold text-lg">Phone Agent Status</h2>
                  <p className="text-muted-foreground">
                    {settings.phone_number || 'No phone number configured'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  {settings.is_active ? 'Active' : 'Inactive'}
                </span>
                <Switch
                  checked={settings.is_active}
                  onCheckedChange={(checked) => updateSetting('is_active', checked)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Voice Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="w-5 h-5" />
              Voice Settings
            </CardTitle>
            <CardDescription>
              Choose the voice and personality for your AI agent
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Agent Name</Label>
              <Input
                value={settings.agent_name}
                onChange={(e) => updateSetting('agent_name', e.target.value)}
                placeholder="e.g., Axles AI"
              />
              <p className="text-xs text-muted-foreground">
                The name the agent uses to identify itself
              </p>
            </div>

            <div className="space-y-2">
              <Label>Voice</Label>
              <Select
                value={settings.voice}
                onValueChange={(value) => updateSetting('voice', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VOICE_OPTIONS.map((voice) => (
                    <SelectItem key={voice.value} value={voice.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{voice.label}</span>
                        <span className="text-xs text-muted-foreground">{voice.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                xAI Grok voices - each has a unique personality
              </p>
            </div>

            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                value={settings.phone_number || ''}
                onChange={(e) => updateSetting('phone_number', e.target.value)}
                placeholder="+1 (555) 123-4567"
              />
              <p className="text-xs text-muted-foreground">
                The LiveKit phone number for incoming calls
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Greeting Message */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Greeting Message
            </CardTitle>
            <CardDescription>
              The first thing the AI says when someone calls
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={settings.greeting_message}
              onChange={(e) => updateSetting('greeting_message', e.target.value)}
              rows={3}
              placeholder="Hello! Thanks for calling..."
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Keep it concise - this plays immediately when the call connects
            </p>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              AI Instructions
            </CardTitle>
            <CardDescription>
              Define the agent&apos;s personality, knowledge, and behavior
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={settings.instructions}
              onChange={(e) => updateSetting('instructions', e.target.value)}
              rows={15}
              placeholder="You are a helpful AI assistant..."
              className="resize-none font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-2">
              This is the system prompt that guides the AI&apos;s responses. Include your business context,
              products/services, and how you want it to handle different situations.
            </p>
          </CardContent>
        </Card>

        {/* Advanced Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5" />
              Advanced Settings
            </CardTitle>
            <CardDescription>
              Fine-tune the AI model behavior
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Model</Label>
              <Select
                value={settings.model}
                onValueChange={(value) => updateSetting('model', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grok-2-public">Grok 2 (Recommended)</SelectItem>
                  <SelectItem value="grok-2-latest">Grok 2 Latest</SelectItem>
                  <SelectItem value="grok-3-mini">Grok 3 Mini (Faster)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Temperature: {settings.temperature}</Label>
                <span className="text-xs text-muted-foreground">
                  {settings.temperature < 0.3 ? 'More focused' : settings.temperature > 0.7 ? 'More creative' : 'Balanced'}
                </span>
              </div>
              <Slider
                value={[settings.temperature]}
                onValueChange={([value]) => updateSetting('temperature', value)}
                min={0}
                max={1}
                step={0.1}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Lower = more consistent responses, Higher = more varied/creative
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Last Updated */}
        <p className="text-sm text-muted-foreground text-center">
          Last updated: {new Date(settings.updated_at).toLocaleString()}
        </p>
      </main>
    </div>
  );
}
