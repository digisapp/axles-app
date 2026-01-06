'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Loader2,
  Store,
  MessageCircle,
  Palette,
  Globe,
  CheckCircle,
  ExternalLink,
  Upload,
  Facebook,
  Instagram,
  Clock,
} from 'lucide-react';

export default function StorefrontSettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isDealer, setIsDealer] = useState(false);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    slug: '',
    tagline: '',
    about: '',
    banner_url: '',
    website: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    chat_enabled: false,
    chat_greeting: '',
    chat_personality: 'friendly and professional',
    collect_lead_after: 3,
    social_facebook: '',
    social_instagram: '',
    business_hours: {
      monday: { open: '09:00', close: '17:00', closed: false },
      tuesday: { open: '09:00', close: '17:00', closed: false },
      wednesday: { open: '09:00', close: '17:00', closed: false },
      thursday: { open: '09:00', close: '17:00', closed: false },
      friday: { open: '09:00', close: '17:00', closed: false },
      saturday: { open: '10:00', close: '14:00', closed: false },
      sunday: { open: '', close: '', closed: true },
    },
  });

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login?redirect=/dashboard/storefront');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        setIsDealer(profile.is_dealer || false);

        const socialLinks = profile.social_links || {};
        const chatSettings = profile.chat_settings || {};
        const businessHours = profile.business_hours || formData.business_hours;

        setFormData({
          slug: profile.slug || '',
          tagline: profile.tagline || '',
          about: profile.about || '',
          banner_url: profile.banner_url || '',
          website: profile.website || '',
          address: profile.address || '',
          city: profile.city || '',
          state: profile.state || '',
          zip_code: profile.zip_code || '',
          chat_enabled: profile.chat_enabled || false,
          chat_greeting: chatSettings.greeting || '',
          chat_personality: chatSettings.personality || 'friendly and professional',
          collect_lead_after: chatSettings.collectLeadAfter || 3,
          social_facebook: socialLinks.facebook || '',
          social_instagram: socialLinks.instagram || '',
          business_hours: businessHours,
        });
      }

      setIsLoading(false);
    };

    fetchProfile();
  }, [router, supabase]);

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBannerFile(file);
      setBannerPreview(URL.createObjectURL(file));
    }
  };

  const generateSlug = () => {
    // Auto-generate slug from company name if empty
    fetch('/api/profile')
      .then((res) => res.json())
      .then((data) => {
        if (data.company_name) {
          const slug = data.company_name
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '-')
            .trim();
          setFormData((prev) => ({ ...prev, slug }));
        }
      });
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let bannerUrl = formData.banner_url;

      // Upload new banner if selected
      if (bannerFile) {
        const fileExt = bannerFile.name.split('.').pop();
        const fileName = `${user.id}/banner.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('listing-images')
          .upload(fileName, bannerFile, { upsert: true });

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('listing-images')
            .getPublicUrl(fileName);
          bannerUrl = publicUrl;
        }
      }

      // Update profile
      const { error } = await supabase
        .from('profiles')
        .update({
          slug: formData.slug || null,
          tagline: formData.tagline || null,
          about: formData.about || null,
          banner_url: bannerUrl || null,
          website: formData.website || null,
          address: formData.address || null,
          city: formData.city || null,
          state: formData.state || null,
          zip_code: formData.zip_code || null,
          chat_enabled: formData.chat_enabled,
          chat_settings: {
            greeting: formData.chat_greeting,
            personality: formData.chat_personality,
            collectLeadAfter: formData.collect_lead_after,
          },
          social_links: {
            facebook: formData.social_facebook || null,
            instagram: formData.social_instagram || null,
          },
          business_hours: formData.business_hours,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (!error) {
        setFormData((prev) => ({ ...prev, banner_url: bannerUrl }));
        setBannerFile(null);
        setBannerPreview(null);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
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
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <h1 className="text-xl font-bold">Storefront Settings</h1>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-12">
          <Card>
            <CardContent className="py-12 text-center">
              <Store className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Dealer Account Required</h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Storefronts are available for dealer accounts. Upgrade to access your own branded page with AI chat assistant.
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
          <span>Storefront settings saved!</span>
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
              <h1 className="text-xl font-bold">Storefront Settings</h1>
            </div>
            {formData.slug && (
              <Link
                href={`/${formData.slug}`}
                target="_blank"
                className="flex items-center gap-2 text-primary hover:underline"
              >
                View Storefront
                <ExternalLink className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">
              <Store className="w-4 h-4 mr-2" />
              General
            </TabsTrigger>
            <TabsTrigger value="appearance">
              <Palette className="w-4 h-4 mr-2" />
              Appearance
            </TabsTrigger>
            <TabsTrigger value="chat">
              <MessageCircle className="w-4 h-4 mr-2" />
              AI Chat
            </TabsTrigger>
            <TabsTrigger value="hours">
              <Clock className="w-4 h-4 mr-2" />
              Hours
            </TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Storefront URL</CardTitle>
                <CardDescription>
                  Your unique storefront address
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex items-center px-3 bg-muted rounded-l-md border border-r-0 text-sm text-muted-foreground">
                    axles.ai/
                  </div>
                  <Input
                    placeholder="your-company-name"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    className="rounded-l-none"
                  />
                  <Button variant="outline" onClick={generateSlug}>
                    Auto
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Only lowercase letters, numbers, and hyphens allowed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Business Information</CardTitle>
                <CardDescription>
                  Details shown on your storefront
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="tagline">Tagline</Label>
                  <Input
                    id="tagline"
                    placeholder="Your dealership's slogan or specialty"
                    value={formData.tagline}
                    onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="about">About</Label>
                  <Textarea
                    id="about"
                    placeholder="Tell customers about your dealership, history, specialties..."
                    value={formData.about}
                    onChange={(e) => setFormData({ ...formData, about: e.target.value })}
                    rows={4}
                  />
                </div>

                <div>
                  <Label htmlFor="website" className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Website
                  </Label>
                  <Input
                    id="website"
                    type="url"
                    placeholder="https://yourwebsite.com"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  />
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="address">Street Address</Label>
                    <Input
                      id="address"
                      placeholder="123 Main St"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      placeholder="Houston"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      placeholder="TX"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="zip_code">ZIP Code</Label>
                    <Input
                      id="zip_code"
                      placeholder="77001"
                      value={formData.zip_code}
                      onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Social Media</CardTitle>
                <CardDescription>
                  Links displayed on your storefront
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="facebook" className="flex items-center gap-2">
                    <Facebook className="w-4 h-4" />
                    Facebook
                  </Label>
                  <Input
                    id="facebook"
                    placeholder="https://facebook.com/yourpage"
                    value={formData.social_facebook}
                    onChange={(e) => setFormData({ ...formData, social_facebook: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="instagram" className="flex items-center gap-2">
                    <Instagram className="w-4 h-4" />
                    Instagram
                  </Label>
                  <Input
                    id="instagram"
                    placeholder="https://instagram.com/yourhandle"
                    value={formData.social_instagram}
                    onChange={(e) => setFormData({ ...formData, social_instagram: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Settings */}
          <TabsContent value="appearance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Banner Image</CardTitle>
                <CardDescription>
                  Displayed at the top of your storefront (1200x400 recommended)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(bannerPreview || formData.banner_url) && (
                    <div className="relative w-full h-40 rounded-lg overflow-hidden bg-muted">
                      <Image
                        src={bannerPreview || formData.banner_url}
                        alt="Banner preview"
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-4">
                    <label className="cursor-pointer">
                      <Button variant="outline" asChild>
                        <span>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Banner
                        </span>
                      </Button>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleBannerChange}
                        className="hidden"
                      />
                    </label>
                    {(bannerPreview || formData.banner_url) && (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setBannerFile(null);
                          setBannerPreview(null);
                          setFormData((prev) => ({ ...prev, banner_url: '' }));
                        }}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Chat Settings */}
          <TabsContent value="chat" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>AI Sales Assistant</CardTitle>
                <CardDescription>
                  Configure your AI chatbot that answers customer questions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">Enable AI Chat</p>
                    <p className="text-sm text-muted-foreground">
                      Show chat widget on your storefront
                    </p>
                  </div>
                  <Switch
                    checked={formData.chat_enabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, chat_enabled: checked })}
                  />
                </div>

                {formData.chat_enabled && (
                  <>
                    <Separator />

                    <div>
                      <Label htmlFor="greeting">Greeting Message</Label>
                      <Textarea
                        id="greeting"
                        placeholder="Hi! I'm the AI assistant for [Your Company]. How can I help you find the right equipment today?"
                        value={formData.chat_greeting}
                        onChange={(e) => setFormData({ ...formData, chat_greeting: e.target.value })}
                        rows={3}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        First message shown when customers open the chat
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="personality">AI Personality</Label>
                      <Input
                        id="personality"
                        placeholder="friendly and professional"
                        value={formData.chat_personality}
                        onChange={(e) => setFormData({ ...formData, chat_personality: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        How should the AI sound? E.g., &quot;friendly and professional&quot;, &quot;casual and helpful&quot;
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="lead_after">Collect Lead Info After</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="lead_after"
                          type="number"
                          min="1"
                          max="10"
                          value={formData.collect_lead_after}
                          onChange={(e) => setFormData({ ...formData, collect_lead_after: parseInt(e.target.value) || 3 })}
                          className="w-20"
                        />
                        <span className="text-muted-foreground">messages</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Show contact form after this many customer messages
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Business Hours */}
          <TabsContent value="hours" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Business Hours</CardTitle>
                <CardDescription>
                  Your operating hours (optional)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(formData.business_hours).map(([day, hours]) => (
                    <div key={day} className="flex items-center gap-4">
                      <div className="w-24 capitalize font-medium">{day}</div>
                      <Switch
                        checked={!hours.closed}
                        onCheckedChange={(open) => {
                          setFormData((prev) => ({
                            ...prev,
                            business_hours: {
                              ...prev.business_hours,
                              [day]: { ...hours, closed: !open },
                            },
                          }));
                        }}
                      />
                      {!hours.closed ? (
                        <>
                          <Input
                            type="time"
                            value={hours.open}
                            onChange={(e) => {
                              setFormData((prev) => ({
                                ...prev,
                                business_hours: {
                                  ...prev.business_hours,
                                  [day]: { ...hours, open: e.target.value },
                                },
                              }));
                            }}
                            className="w-32"
                          />
                          <span className="text-muted-foreground">to</span>
                          <Input
                            type="time"
                            value={hours.close}
                            onChange={(e) => {
                              setFormData((prev) => ({
                                ...prev,
                                business_hours: {
                                  ...prev.business_hours,
                                  [day]: { ...hours, close: e.target.value },
                                },
                              }));
                            }}
                            className="w-32"
                          />
                        </>
                      ) : (
                        <span className="text-muted-foreground">Closed</span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Save Button */}
        <div className="flex justify-end mt-6">
          <Button onClick={handleSave} disabled={isSaving} size="lg">
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Storefront Settings
          </Button>
        </div>
      </main>
    </div>
  );
}
