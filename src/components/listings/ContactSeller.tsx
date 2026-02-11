'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Send, Loader2, CheckCircle, User, Phone } from 'lucide-react';

interface ContactSellerProps {
  listingId: string;
  sellerId: string;
  listingTitle: string;
}

export function ContactSeller({ listingId, sellerId, listingTitle }: ContactSellerProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
  });
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  const defaultMessage = `Hi, I'm interested in your listing: ${listingTitle}. Is it still available?`;

  // Check if user is logged in on mount
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
      if (user?.email) {
        setFormData(prev => ({ ...prev, email: user.email || '' }));
      }
    });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate required fields
    if (!formData.name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!formData.email.trim()) {
      setError('Please enter your email');
      return;
    }
    if (!formData.email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Check if user is trying to message themselves (only if seller is specified)
    if (sellerId && user?.id === sellerId) {
      setError("You can't contact yourself");
      return;
    }

    setIsSending(true);

    try {
      // Create lead via API
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: listingId,
          seller_id: sellerId,
          buyer_name: formData.name.trim(),
          buyer_email: formData.email.trim(),
          buyer_phone: formData.phone.trim() || null,
          message: formData.message.trim() || defaultMessage,
        }),
      });

      if (response.ok) {
        setIsSent(true);
        setFormData({ name: '', email: '', phone: '', message: '' });
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to send inquiry');
      }
    } catch (err) {
      setError('Failed to send inquiry. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  if (isSent) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="font-semibold mb-2">Inquiry Sent!</h3>
          <p className="text-sm text-muted-foreground mb-4">
            The seller will receive your message and contact you shortly.
          </p>
          <Button
            variant="outline"
            onClick={() => setIsSent(false)}
          >
            Send Another Inquiry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Determine if routing to AxlonAI (when no seller specified)
  const isAxlonAI = !sellerId;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mail className="w-5 h-5" />
          {isAxlonAI ? 'Contact AxlonAI' : 'Contact Seller'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="name"
                  name="name"
                  placeholder="Your name"
                  value={formData.name}
                  onChange={handleChange}
                  className="pl-9"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="pl-9"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={formData.phone}
                  onChange={handleChange}
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              name="message"
              placeholder={defaultMessage}
              value={formData.message}
              onChange={handleChange}
              rows={4}
              className="resize-none"
            />
          </div>

          <Button type="submit" className="w-full" disabled={isSending}>
            {isSending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Send Inquiry
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            {isAxlonAI
              ? 'Our team will respond to your inquiry shortly'
              : 'Your contact info will be shared with the seller'}
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
