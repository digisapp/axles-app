'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ArrowLeft,
  Search,
  MessageSquare,
  Loader2,
  ImageIcon,
} from 'lucide-react';

interface Conversation {
  listing: {
    id: string;
    title: string;
    price: number | null;
    images: Array<{ url: string; is_primary: boolean }>;
  };
  otherUser: {
    id: string;
    company_name: string | null;
    email: string;
    avatar_url: string | null;
  };
  lastMessage: {
    id: string;
    content: string;
    created_at: string;
    sender_id: string;
  };
  unreadCount: number;
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const fetchConversations = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserId(user.id);

      const response = await fetch('/api/messages');
      if (response.ok) {
        const { data } = await response.json();
        setConversations(data || []);
      }
      setIsLoading(false);
    };

    fetchConversations();
  }, [supabase]);

  const filteredConversations = conversations.filter((conv) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      conv.listing?.title?.toLowerCase().includes(searchLower) ||
      conv.otherUser?.company_name?.toLowerCase().includes(searchLower) ||
      conv.otherUser?.email?.toLowerCase().includes(searchLower)
    );
  });

  const getPrimaryImage = (images: Array<{ url: string; is_primary: boolean }>) => {
    const primary = images?.find((img) => img.is_primary);
    return primary?.url || images?.[0]?.url || null;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-xl font-bold">Messages</h1>
              <p className="text-sm text-muted-foreground">
                {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {filteredConversations.length > 0 ? (
          <div className="space-y-2">
            {filteredConversations.map((conv) => {
              const imageUrl = getPrimaryImage(conv.listing?.images || []);
              const conversationId = `${conv.listing?.id}-${conv.otherUser?.id}`;
              const isFromMe = conv.lastMessage.sender_id === userId;

              return (
                <Link key={conversationId} href={`/dashboard/messages/${conversationId}`}>
                  <Card className={`hover:bg-muted/50 transition-colors ${conv.unreadCount > 0 ? 'border-primary/50' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        {/* Listing Image */}
                        <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                          {imageUrl ? (
                            <Image
                              src={imageUrl}
                              alt={conv.listing?.title || 'Listing'}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <Avatar className="w-6 h-6">
                                  <AvatarImage src={conv.otherUser?.avatar_url || undefined} />
                                  <AvatarFallback>
                                    {(conv.otherUser?.company_name || conv.otherUser?.email)?.[0]?.toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className={`font-medium truncate ${conv.unreadCount > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                                  {conv.otherUser?.company_name || conv.otherUser?.email}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground truncate mt-1">
                                {conv.listing?.title}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs text-muted-foreground">
                                {formatTime(conv.lastMessage.created_at)}
                              </p>
                              {conv.unreadCount > 0 && (
                                <span className="inline-flex items-center justify-center w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full mt-1">
                                  {conv.unreadCount}
                                </span>
                              )}
                            </div>
                          </div>
                          <p className={`text-sm truncate mt-2 ${conv.unreadCount > 0 ? 'font-medium' : 'text-muted-foreground'}`}>
                            {isFromMe && <span className="text-muted-foreground">You: </span>}
                            {conv.lastMessage.content}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No messages yet</h3>
              <p className="text-muted-foreground mb-6">
                When you contact sellers or receive inquiries, they&apos;ll appear here
              </p>
              <Button asChild>
                <Link href="/search">
                  Browse Listings
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
