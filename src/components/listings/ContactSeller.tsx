'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Send, Loader2, CheckCircle } from 'lucide-react';

interface ContactSellerProps {
  listingId: string;
  sellerId: string;
  listingTitle: string;
}

export function ContactSeller({ listingId, sellerId, listingTitle }: ContactSellerProps) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  const defaultMessage = `Hi, I'm interested in your listing: ${listingTitle}. Is it still available?`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push(`/login?redirect=/listing/${listingId}`);
      return;
    }

    if (user.id === sellerId) {
      setError("You can't message yourself");
      return;
    }

    setIsSending(true);

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: listingId,
          recipient_id: sellerId,
          content: message || defaultMessage,
        }),
      });

      if (response.ok) {
        setIsSent(true);
        setMessage('');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to send message');
      }
    } catch (err) {
      setError('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  if (isSent) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="font-semibold mb-2">Message Sent!</h3>
          <p className="text-sm text-muted-foreground mb-4">
            The seller will receive your message and can respond directly.
          </p>
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard/messages')}
          >
            View Messages
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mail className="w-5 h-5" />
          Contact Seller
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg">
              {error}
            </div>
          )}

          <Textarea
            placeholder={defaultMessage}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="resize-none"
          />

          <Button type="submit" className="w-full" disabled={isSending}>
            {isSending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Send Message
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
