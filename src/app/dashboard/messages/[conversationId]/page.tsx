'use client';

import { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ArrowLeft,
  Send,
  Loader2,
  ImageIcon,
  ExternalLink,
} from 'lucide-react';
import { logger } from '@/lib/logger';

interface Message {
  id: string;
  listing_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  sender?: {
    id: string;
    company_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

interface Listing {
  id: string;
  title: string;
  price: number | null;
  images: Array<{ url: string; is_primary: boolean }>;
}

interface OtherUser {
  id: string;
  company_name: string | null;
  email: string;
  avatar_url: string | null;
}

interface PageProps {
  params: Promise<{ conversationId: string }>;
}

export default function ConversationPage({ params }: PageProps) {
  const { conversationId } = use(params);
  const [messages, setMessages] = useState<Message[]>([]);
  const [listing, setListing] = useState<Listing | null>(null);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserId(user.id);

      const response = await fetch(`/api/messages/${conversationId}`);
      if (response.ok) {
        const { data } = await response.json();
        setMessages(data.messages || []);
        setListing(data.listing);
        setOtherUser(data.otherUser);
      }
      setIsLoading(false);
    };

    fetchData();
  }, [conversationId, supabase]);

  // Real-time subscription for live chat
  useEffect(() => {
    if (!userId || !listing || !otherUser) return;

    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `listing_id=eq.${listing.id}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          // Only add if it's for this conversation
          if (
            (newMsg.sender_id === userId && newMsg.recipient_id === otherUser.id) ||
            (newMsg.sender_id === otherUser.id && newMsg.recipient_id === userId)
          ) {
            setMessages((prev) => {
              // Avoid duplicates
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, listing, otherUser, conversationId, supabase]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !listing || !otherUser) return;

    setIsSending(true);

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: listing.id,
          recipient_id: otherUser.id,
          content: newMessage.trim(),
        }),
      });

      if (response.ok) {
        const { data } = await response.json();
        setMessages((prev) => [...prev, { ...data, sender: { id: userId } }]);
        setNewMessage('');
      }
    } catch (error) {
      logger.error('Send error', { error });
    } finally {
      setIsSending(false);
    }
  };

  const getPrimaryImage = (images: Array<{ url: string; is_primary: boolean }>) => {
    const primary = images?.find((img) => img.is_primary);
    return primary?.url || images?.[0]?.url || null;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
    }
  };

  const groupMessagesByDate = (messages: Message[]) => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = '';

    messages.forEach((msg) => {
      const msgDate = new Date(msg.created_at).toDateString();
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msg.created_at, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    });

    return groups;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const messageGroups = groupMessagesByDate(messages);

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      {/* Header */}
      <header className="bg-background border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/messages"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            {otherUser && (
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={otherUser.avatar_url || undefined} />
                  <AvatarFallback>
                    {(otherUser.company_name || otherUser.email)?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {otherUser.company_name || otherUser.email}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {otherUser.email}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Listing Info */}
      {listing && (
        <div className="bg-background border-b">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <Link
              href={`/listing/${listing.id}`}
              target="_blank"
              className="flex items-center gap-3 hover:bg-muted/50 -mx-2 px-2 py-1 rounded-lg transition-colors"
            >
              <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                {getPrimaryImage(listing.images) ? (
                  <Image
                    src={getPrimaryImage(listing.images)!}
                    alt={listing.title}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{listing.title}</p>
                <p className="text-sm text-primary font-medium">
                  {listing.price ? `$${listing.price.toLocaleString()}` : 'No price'}
                </p>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </Link>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          {messageGroups.map((group, groupIndex) => (
            <div key={groupIndex}>
              {/* Date Separator */}
              <div className="flex items-center justify-center mb-4">
                <span className="px-3 py-1 bg-muted text-muted-foreground text-xs rounded-full">
                  {formatDate(group.date)}
                </span>
              </div>

              {/* Messages */}
              <div className="space-y-3">
                {group.messages.map((msg) => {
                  const isFromMe = msg.sender_id === userId;

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isFromMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                          isFromMe
                            ? 'bg-primary text-primary-foreground rounded-br-md'
                            : 'bg-background border rounded-bl-md'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        <p
                          className={`text-xs mt-1 ${
                            isFromMe ? 'text-primary-foreground/70' : 'text-muted-foreground'
                          }`}
                        >
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input */}
      <div className="bg-background border-t sticky bottom-0">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <form onSubmit={handleSend} className="flex gap-2">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={isSending}
              className="flex-1"
            />
            <Button type="submit" disabled={isSending || !newMessage.trim()}>
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
