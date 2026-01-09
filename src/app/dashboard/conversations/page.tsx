'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MessageCircle,
  User,
  Clock,
  ArrowRight,
  Loader2,
  Inbox,
  CheckCircle,
  UserCheck,
  Bot,
  AlertCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Conversation {
  id: string;
  dealer_id: string;
  visitor_name: string | null;
  visitor_email: string | null;
  visitor_phone: string | null;
  status: 'active' | 'closed' | 'converted';
  message_count: number;
  user_message_count: number;
  last_message: string | null;
  last_message_at: string;
  created_at: string;
  lead: { id: string; status: string; buyer_name: string } | null;
}

export default function ConversationsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'converted' | 'closed'>('all');

  useEffect(() => {
    const checkDealerAndFetch = async () => {
      setIsLoading(true);

      // Check if user is a dealer
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?redirect=/dashboard/conversations');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_dealer')
        .eq('id', user.id)
        .single();

      if (!profile?.is_dealer) {
        router.push('/become-a-dealer');
        return;
      }

      // Fetch conversations
      const response = await fetch(`/api/dashboard/conversations?status=${filter}`);
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }

      setIsLoading(false);
    };

    checkDealerAndFetch();
  }, [filter, router, supabase]);

  // Set up real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('chat-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_conversations',
        },
        () => {
          // Refresh conversations on any change
          fetch(`/api/dashboard/conversations?status=${filter}`)
            .then((res) => res.json())
            .then((data) => setConversations(data.conversations || []));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, filter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Active</Badge>;
      case 'converted':
        return <Badge className="bg-blue-500">Lead Captured</Badge>;
      case 'closed':
        return <Badge variant="secondary">Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const stats = {
    total: conversations.length,
    active: conversations.filter((c) => c.status === 'active').length,
    converted: conversations.filter((c) => c.status === 'converted').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Chat Conversations</h1>
        <p className="text-muted-foreground">
          View and manage AI chat conversations from your storefront
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Chats</p>
                <p className="text-3xl font-bold">{stats.total}</p>
              </div>
              <MessageCircle className="w-10 h-10 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Now</p>
                <p className="text-3xl font-bold text-green-600">{stats.active}</p>
              </div>
              <Bot className="w-10 h-10 text-green-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Leads Captured</p>
                <p className="text-3xl font-bold text-blue-600">{stats.converted}</p>
              </div>
              <UserCheck className="w-10 h-10 text-blue-500/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="converted">Leads</TabsTrigger>
          <TabsTrigger value="closed">Closed</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Conversations List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : conversations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Inbox className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-1">No conversations yet</h3>
            <p className="text-muted-foreground mb-4">
              Conversations will appear here when visitors chat with your AI assistant
            </p>
            <Link href="/dashboard/storefront">
              <Button>Configure Chat Settings</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {conversations.map((conversation) => (
            <Link
              key={conversation.id}
              href={`/dashboard/conversations/${conversation.id}`}
            >
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        {conversation.visitor_name ? (
                          <User className="w-6 h-6 text-primary" />
                        ) : (
                          <Bot className="w-6 h-6 text-primary" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {conversation.visitor_name || 'Anonymous Visitor'}
                          </p>
                          {getStatusBadge(conversation.status)}
                        </div>
                        {conversation.last_message && (
                          <p className="text-sm text-muted-foreground line-clamp-1 max-w-md">
                            {conversation.last_message}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MessageCircle className="w-3 h-3" />
                            {conversation.message_count} messages
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {conversation.visitor_email && (
                        <Badge variant="outline" className="text-xs">
                          {conversation.visitor_email}
                        </Badge>
                      )}
                      <ArrowRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
