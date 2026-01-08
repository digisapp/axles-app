'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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
  Bot,
  CheckCircle,
  Plus,
  X,
  MessageCircle,
  Settings,
  HelpCircle,
  TrendingUp,
  Users,
  Sparkles,
  Lock,
  Crown,
} from 'lucide-react';

interface FAQ {
  question: string;
  answer: string;
}

interface AISettings {
  assistant_name: string;
  greeting_message: string;
  about_dealer: string;
  specialties: string[];
  value_propositions: string[];
  service_areas: string[];
  financing_info: string;
  warranty_info: string;
  faqs: FAQ[];
  tone: string;
  language_style: string;
  max_response_length: number;
  include_pricing: boolean;
  include_financing_cta: boolean;
  capture_leads: boolean;
  lead_capture_message: string;
  lead_notification_email: string;
  is_enabled: boolean;
  show_on_listings: boolean;
  show_on_storefront: boolean;
  total_conversations: number;
  total_messages: number;
  total_leads_generated: number;
}

const defaultSettings: AISettings = {
  assistant_name: 'AI Sales Assistant',
  greeting_message: "Hi! I'm here to help you find the perfect equipment. What are you looking for today?",
  about_dealer: '',
  specialties: [],
  value_propositions: [],
  service_areas: [],
  financing_info: '',
  warranty_info: '',
  faqs: [],
  tone: 'professional',
  language_style: 'concise',
  max_response_length: 300,
  include_pricing: true,
  include_financing_cta: true,
  capture_leads: true,
  lead_capture_message: "I'd love to connect you with one of our team members. Could you share your contact info?",
  lead_notification_email: '',
  is_enabled: false,
  show_on_listings: true,
  show_on_storefront: true,
  total_conversations: 0,
  total_messages: 0,
  total_leads_generated: 0,
};

export default function AIAssistantPage() {
  const router = useRouter();
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isDealer, setIsDealer] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<string>('free');
  const [dealerName, setDealerName] = useState<string>('');
  const [settings, setSettings] = useState<AISettings>(defaultSettings);
  const [newSpecialty, setNewSpecialty] = useState('');
  const [newValueProp, setNewValueProp] = useState('');
  const [newServiceArea, setNewServiceArea] = useState('');
  const [newFaq, setNewFaq] = useState<FAQ>({ question: '', answer: '' });

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login?redirect=/dashboard/ai-assistant');
        return;
      }

      // Fetch profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        setIsDealer(profile.is_dealer || false);
        setSubscriptionTier(profile.subscription_tier || 'free');
        setDealerName(profile.company_name || '');
      }

      // Fetch AI settings
      const { data: aiSettings } = await supabase
        .from('dealer_ai_settings')
        .select('*')
        .eq('dealer_id', user.id)
        .single();

      if (aiSettings) {
        setSettings({
          assistant_name: aiSettings.assistant_name || defaultSettings.assistant_name,
          greeting_message: aiSettings.greeting_message || defaultSettings.greeting_message,
          about_dealer: aiSettings.about_dealer || '',
          specialties: aiSettings.specialties || [],
          value_propositions: aiSettings.value_propositions || [],
          service_areas: aiSettings.service_areas || [],
          financing_info: aiSettings.financing_info || '',
          warranty_info: aiSettings.warranty_info || '',
          faqs: aiSettings.faqs || [],
          tone: aiSettings.tone || 'professional',
          language_style: aiSettings.language_style || 'concise',
          max_response_length: aiSettings.max_response_length || 300,
          include_pricing: aiSettings.include_pricing !== false,
          include_financing_cta: aiSettings.include_financing_cta !== false,
          capture_leads: aiSettings.capture_leads !== false,
          lead_capture_message: aiSettings.lead_capture_message || defaultSettings.lead_capture_message,
          lead_notification_email: aiSettings.lead_notification_email || '',
          is_enabled: aiSettings.is_enabled || false,
          show_on_listings: aiSettings.show_on_listings !== false,
          show_on_storefront: aiSettings.show_on_storefront !== false,
          total_conversations: aiSettings.total_conversations || 0,
          total_messages: aiSettings.total_messages || 0,
          total_leads_generated: aiSettings.total_leads_generated || 0,
        });
      }

      setIsLoading(false);
    };

    fetchData();
  }, [router, supabase]);

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Upsert AI settings
      const { error } = await supabase
        .from('dealer_ai_settings')
        .upsert({
          dealer_id: user.id,
          assistant_name: settings.assistant_name,
          greeting_message: settings.greeting_message,
          about_dealer: settings.about_dealer,
          specialties: settings.specialties,
          value_propositions: settings.value_propositions,
          service_areas: settings.service_areas,
          financing_info: settings.financing_info,
          warranty_info: settings.warranty_info,
          faqs: settings.faqs,
          tone: settings.tone,
          language_style: settings.language_style,
          max_response_length: settings.max_response_length,
          include_pricing: settings.include_pricing,
          include_financing_cta: settings.include_financing_cta,
          capture_leads: settings.capture_leads,
          lead_capture_message: settings.lead_capture_message,
          lead_notification_email: settings.lead_notification_email,
          is_enabled: settings.is_enabled,
          show_on_listings: settings.show_on_listings,
          show_on_storefront: settings.show_on_storefront,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'dealer_id',
        });

      if (!error) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const addSpecialty = () => {
    if (newSpecialty.trim()) {
      setSettings(prev => ({
        ...prev,
        specialties: [...prev.specialties, newSpecialty.trim()],
      }));
      setNewSpecialty('');
    }
  };

  const removeSpecialty = (index: number) => {
    setSettings(prev => ({
      ...prev,
      specialties: prev.specialties.filter((_, i) => i !== index),
    }));
  };

  const addValueProp = () => {
    if (newValueProp.trim()) {
      setSettings(prev => ({
        ...prev,
        value_propositions: [...prev.value_propositions, newValueProp.trim()],
      }));
      setNewValueProp('');
    }
  };

  const removeValueProp = (index: number) => {
    setSettings(prev => ({
      ...prev,
      value_propositions: prev.value_propositions.filter((_, i) => i !== index),
    }));
  };

  const addServiceArea = () => {
    if (newServiceArea.trim()) {
      setSettings(prev => ({
        ...prev,
        service_areas: [...prev.service_areas, newServiceArea.trim()],
      }));
      setNewServiceArea('');
    }
  };

  const removeServiceArea = (index: number) => {
    setSettings(prev => ({
      ...prev,
      service_areas: prev.service_areas.filter((_, i) => i !== index),
    }));
  };

  const addFaq = () => {
    if (newFaq.question.trim() && newFaq.answer.trim()) {
      setSettings(prev => ({
        ...prev,
        faqs: [...prev.faqs, { question: newFaq.question.trim(), answer: newFaq.answer.trim() }],
      }));
      setNewFaq({ question: '', answer: '' });
    }
  };

  const removeFaq = (index: number) => {
    setSettings(prev => ({
      ...prev,
      faqs: prev.faqs.filter((_, i) => i !== index),
    }));
  };

  const isPro = subscriptionTier === 'pro' || subscriptionTier === 'enterprise';

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
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <h1 className="text-xl font-bold">AI Sales Assistant</h1>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-12">
          <Card>
            <CardContent className="py-12 text-center">
              <Bot className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Dealer Account Required</h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                AI Sales Assistant is available for dealer accounts. Upgrade to get your own AI that knows your inventory and sells for you 24/7.
              </p>
              <Link href="/dashboard/settings">
                <Button>Upgrade to Dealer</Button>
              </Link>
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
          <span>AI Assistant settings saved!</span>
        </div>
      )}

      {/* Header */}
      <header className="bg-background border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Bot className="w-5 h-5" />
                  AI Sales Assistant
                </h1>
                <p className="text-sm text-muted-foreground">
                  Your 24/7 AI-powered salesperson
                </p>
              </div>
            </div>
            <Badge variant={isPro ? 'default' : 'secondary'} className="flex items-center gap-1">
              {isPro ? <Crown className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              {subscriptionTier === 'enterprise' ? 'Enterprise' : isPro ? 'Pro' : 'Free'}
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <MessageCircle className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{settings.total_conversations}</p>
                  <p className="text-sm text-muted-foreground">Conversations</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Users className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{settings.total_leads_generated}</p>
                  <p className="text-sm text-muted-foreground">Leads Captured</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{settings.total_messages}</p>
                  <p className="text-sm text-muted-foreground">Messages</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enable Toggle */}
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${settings.is_enabled ? 'bg-green-500' : 'bg-muted'}`}>
                  <Bot className={`w-6 h-6 ${settings.is_enabled ? 'text-white' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <p className="font-semibold text-lg">
                    {settings.is_enabled ? 'AI Assistant is Active' : 'AI Assistant is Disabled'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {settings.is_enabled
                      ? 'Your AI is answering customer questions right now'
                      : 'Enable to start converting visitors into leads'}
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.is_enabled}
                onCheckedChange={(checked) => setSettings({ ...settings, is_enabled: checked })}
              />
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="identity" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="identity">
              <Bot className="w-4 h-4 mr-2" />
              Identity
            </TabsTrigger>
            <TabsTrigger value="knowledge">
              <Sparkles className="w-4 h-4 mr-2" />
              Knowledge
            </TabsTrigger>
            <TabsTrigger value="faqs">
              <HelpCircle className="w-4 h-4 mr-2" />
              FAQs
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Identity Tab */}
          <TabsContent value="identity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Assistant Identity</CardTitle>
                <CardDescription>
                  How your AI introduces itself and greets customers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="assistant_name">Assistant Name</Label>
                  <Input
                    id="assistant_name"
                    placeholder="AI Sales Assistant"
                    value={settings.assistant_name}
                    onChange={(e) => setSettings({ ...settings, assistant_name: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    E.g., &quot;{dealerName} Sales Bot&quot; or &quot;Alex from {dealerName}&quot;
                  </p>
                </div>

                <div>
                  <Label htmlFor="greeting">Greeting Message</Label>
                  <Textarea
                    id="greeting"
                    placeholder="Hi! I'm here to help you find the perfect equipment..."
                    value={settings.greeting_message}
                    onChange={(e) => setSettings({ ...settings, greeting_message: e.target.value })}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    First message shown when customers open the chat
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="tone">Tone</Label>
                    <Select
                      value={settings.tone}
                      onValueChange={(value) => setSettings({ ...settings, tone: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="friendly">Friendly</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="style">Response Style</Label>
                    <Select
                      value={settings.language_style}
                      onValueChange={(value) => setSettings({ ...settings, language_style: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="concise">Concise</SelectItem>
                        <SelectItem value="detailed">Detailed</SelectItem>
                        <SelectItem value="conversational">Conversational</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>About Your Dealership</CardTitle>
                <CardDescription>
                  Information the AI will use to tell customers about your business
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="about">Company Description</Label>
                  <Textarea
                    id="about"
                    placeholder="Tell the AI about your dealership history, mission, what makes you different..."
                    value={settings.about_dealer}
                    onChange={(e) => setSettings({ ...settings, about_dealer: e.target.value })}
                    rows={4}
                  />
                </div>

                <div>
                  <Label>Value Propositions</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    What makes your dealership special? The AI will highlight these.
                  </p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {settings.value_propositions.map((prop, index) => (
                      <Badge key={index} variant="secondary" className="flex items-center gap-1">
                        {prop}
                        <button onClick={() => removeValueProp(index)}>
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="E.g., Family owned since 1985"
                      value={newValueProp}
                      onChange={(e) => setNewValueProp(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addValueProp())}
                    />
                    <Button type="button" variant="outline" onClick={addValueProp}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label>Service Areas</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Where do you sell and deliver?
                  </p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {settings.service_areas.map((area, index) => (
                      <Badge key={index} variant="secondary" className="flex items-center gap-1">
                        {area}
                        <button onClick={() => removeServiceArea(index)}>
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="E.g., Texas, Oklahoma, Louisiana"
                      value={newServiceArea}
                      onChange={(e) => setNewServiceArea(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addServiceArea())}
                    />
                    <Button type="button" variant="outline" onClick={addServiceArea}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Knowledge Tab */}
          <TabsContent value="knowledge" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Equipment Specialties</CardTitle>
                <CardDescription>
                  What types of equipment does your dealership specialize in?
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-4">
                  {settings.specialties.map((specialty, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {specialty}
                      <button onClick={() => removeSpecialty(index)}>
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="E.g., Lowboy trailers, Reefers, Day Cabs"
                    value={newSpecialty}
                    onChange={(e) => setNewSpecialty(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSpecialty())}
                  />
                  <Button type="button" variant="outline" onClick={addSpecialty}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  The AI will emphasize these when recommending equipment
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Financing Information</CardTitle>
                <CardDescription>
                  Tell the AI about your financing options
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="E.g., We offer in-house financing with as low as 10% down. Rates starting at 6.9% APR for qualified buyers. We work with all credit types..."
                  value={settings.financing_info}
                  onChange={(e) => setSettings({ ...settings, financing_info: e.target.value })}
                  rows={4}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Warranty Information</CardTitle>
                <CardDescription>
                  What warranties do you offer?
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="E.g., All used equipment comes with a 30-day powertrain warranty. Extended warranties available up to 3 years..."
                  value={settings.warranty_info}
                  onChange={(e) => setSettings({ ...settings, warranty_info: e.target.value })}
                  rows={4}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* FAQs Tab */}
          <TabsContent value="faqs" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Custom FAQs</CardTitle>
                <CardDescription>
                  Add common questions and answers. The AI will use these to respond accurately.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {settings.faqs.map((faq, index) => (
                  <div key={index} className="p-4 bg-muted/50 rounded-lg relative">
                    <button
                      onClick={() => removeFaq(index)}
                      className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <p className="font-medium mb-2">Q: {faq.question}</p>
                    <p className="text-sm text-muted-foreground">A: {faq.answer}</p>
                  </div>
                ))}

                <Separator />

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="new_question">Question</Label>
                    <Input
                      id="new_question"
                      placeholder="E.g., Do you offer delivery?"
                      value={newFaq.question}
                      onChange={(e) => setNewFaq({ ...newFaq, question: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="new_answer">Answer</Label>
                    <Textarea
                      id="new_answer"
                      placeholder="E.g., Yes! We offer nationwide delivery. Delivery costs vary by distance..."
                      value={newFaq.answer}
                      onChange={(e) => setNewFaq({ ...newFaq, answer: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <Button type="button" variant="outline" onClick={addFaq} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Add FAQ
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Display Settings</CardTitle>
                <CardDescription>
                  Where should your AI assistant appear?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">Show on Your Listings</p>
                    <p className="text-sm text-muted-foreground">
                      Display chat widget on all your listing pages
                    </p>
                  </div>
                  <Switch
                    checked={settings.show_on_listings}
                    onCheckedChange={(checked) => setSettings({ ...settings, show_on_listings: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">Show on Storefront</p>
                    <p className="text-sm text-muted-foreground">
                      Display chat widget on your dealer storefront page
                    </p>
                  </div>
                  <Switch
                    checked={settings.show_on_storefront}
                    onCheckedChange={(checked) => setSettings({ ...settings, show_on_storefront: checked })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Response Settings</CardTitle>
                <CardDescription>
                  Control how the AI responds to customers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">Include Pricing</p>
                    <p className="text-sm text-muted-foreground">
                      AI can share equipment prices from your listings
                    </p>
                  </div>
                  <Switch
                    checked={settings.include_pricing}
                    onCheckedChange={(checked) => setSettings({ ...settings, include_pricing: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">Financing CTA</p>
                    <p className="text-sm text-muted-foreground">
                      AI mentions financing options when discussing prices
                    </p>
                  </div>
                  <Switch
                    checked={settings.include_financing_cta}
                    onCheckedChange={(checked) => setSettings({ ...settings, include_financing_cta: checked })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Lead Capture</CardTitle>
                <CardDescription>
                  Convert conversations into leads
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">Capture Leads</p>
                    <p className="text-sm text-muted-foreground">
                      AI will ask for contact info when customers show interest
                    </p>
                  </div>
                  <Switch
                    checked={settings.capture_leads}
                    onCheckedChange={(checked) => setSettings({ ...settings, capture_leads: checked })}
                  />
                </div>

                {settings.capture_leads && (
                  <>
                    <div>
                      <Label htmlFor="lead_message">Lead Capture Message</Label>
                      <Textarea
                        id="lead_message"
                        placeholder="I'd love to connect you with one of our team members..."
                        value={settings.lead_capture_message}
                        onChange={(e) => setSettings({ ...settings, lead_capture_message: e.target.value })}
                        rows={2}
                      />
                    </div>

                    <div>
                      <Label htmlFor="lead_email">Lead Notification Email</Label>
                      <Input
                        id="lead_email"
                        type="email"
                        placeholder="sales@yourcompany.com (leave blank to use account email)"
                        value={settings.lead_notification_email}
                        onChange={(e) => setSettings({ ...settings, lead_notification_email: e.target.value })}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Save Button */}
        <div className="flex justify-end mt-6 gap-4">
          <Link href="/dashboard/conversations">
            <Button variant="outline">
              <MessageCircle className="w-4 h-4 mr-2" />
              View Conversations
            </Button>
          </Link>
          <Button onClick={handleSave} disabled={isSaving} size="lg">
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save AI Settings
          </Button>
        </div>

        {/* Upgrade Banner for Free Users */}
        {!isPro && (
          <Card className="mt-8 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary rounded-full">
                    <Crown className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg">Upgrade to Pro</p>
                    <p className="text-sm text-muted-foreground">
                      Get unlimited conversations, advanced analytics, and priority support
                    </p>
                  </div>
                </div>
                <Link href="/dashboard/billing">
                  <Button>
                    Upgrade Now - $49/mo
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
