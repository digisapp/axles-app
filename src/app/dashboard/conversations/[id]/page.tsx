'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Loader2,
  Bot,
  User,
  Send,
  Mail,
  Phone,
  Clock,
  CheckCircle,
  XCircle,
  UserCheck,
  ChevronUp,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: {
    from_dealer?: boolean;
  };
  created_at: string;
}

interface Pagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface Conversation {
  id: string;
  visitor_name: string | null;
  visitor_email: string | null;
  visitor_phone: string | null;
  status: 'active' | 'closed' | 'converted';
  created_at: string;
  updated_at: string;
  messages: Message[];
  lead: {
    id: string;
    status: string;
    buyer_name: string;
    buyer_email: string;
    buyer_phone: string;
  } | null;
}

const MESSAGES_PER_PAGE = 50;

export default function ConversationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const conversationId = params.id as string;
  const supabase = createClient();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const fetchConversation = useCallback(async (loadMore = false) => {
    const offset = loadMore && pagination ? pagination.offset + MESSAGES_PER_PAGE : 0;

    const response = await fetch(
      `/api/dashboard/conversations/${conversationId}?limit=${MESSAGES_PER_PAGE}&offset=${offset}`
    );
    if (response.ok) {
      const data = await response.json();
      if (loadMore && conversation) {
        // Prepend older messages
        setConversation({
          ...data.conversation,
          messages: [...data.conversation.messages, ...conversation.messages],
        });
      } else {
        setConversation(data.conversation);
      }
      setPagination(data.pagination);
    } else if (!loadMore) {
      router.push('/dashboard/conversations');
    }
    setIsLoading(false);
    setIsLoadingMore(false);
  }, [conversationId, pagination, conversation, router]);

  const loadMoreMessages = async () => {
    if (!pagination?.hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    await fetchConversation(true);
  };

  // Initial fetch - only runs when conversationId changes
  useEffect(() => {
    setIsLoading(true);
    setConversation(null);
    setPagination(null);
    fetchConversation(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Real-time message updates - add new messages directly
  useEffect(() => {
    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setConversation(prev => {
            if (!prev) return prev;
            // Check if message already exists
            if (prev.messages.some(m => m.id === newMessage.id)) {
              return prev;
            }
            return {
              ...prev,
              messages: [...prev.messages, newMessage],
            };
          });
          // Update pagination total
          setPagination(prev => prev ? { ...prev, total: prev.total + 1 } : prev);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, supabase]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages]);

  const handleSendReply = async () => {
    if (!replyText.trim() || isSending) return;

    setIsSending(true);

    try {
      const response = await fetch(`/api/dashboard/conversations/${conversationId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyText }),
      });

      if (response.ok) {
        setReplyText('');
        await fetchConversation();
      }
    } catch (error) {
      console.error('Reply error:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  const updateStatus = async (newStatus: 'active' | 'closed' | 'converted') => {
    await fetch(`/api/dashboard/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    await fetchConversation();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!conversation) {
    return null;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/conversations">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">
                {conversation.visitor_name || 'Anonymous Visitor'}
              </h1>
              {conversation.status === 'active' && (
                <Badge className="bg-green-500">Active</Badge>
              )}
              {conversation.status === 'converted' && (
                <Badge className="bg-blue-500">Lead</Badge>
              )}
              {conversation.status === 'closed' && (
                <Badge variant="secondary">Closed</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Started {formatDistanceToNow(new Date(conversation.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {conversation.status !== 'closed' && (
            <Button variant="outline" size="sm" onClick={() => updateStatus('closed')}>
              <XCircle className="w-4 h-4 mr-2" />
              Close
            </Button>
          )}
          {conversation.status === 'closed' && (
            <Button variant="outline" size="sm" onClick={() => updateStatus('active')}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Reopen
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-1 gap-4 pt-4 overflow-hidden">
        {/* Messages */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Card className="flex-1 flex flex-col overflow-hidden">
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Load more button */}
              {pagination?.hasMore && (
                <div className="flex justify-center pb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadMoreMessages}
                    disabled={isLoadingMore}
                    className="text-muted-foreground"
                  >
                    {isLoadingMore ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <ChevronUp className="w-4 h-4 mr-2" />
                    )}
                    Load older messages ({pagination.total - conversation.messages.length} more)
                  </Button>
                </div>
              )}
              {conversation.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role !== 'user' && (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      message.metadata?.from_dealer ? 'bg-blue-100' : 'bg-primary/10'
                    }`}>
                      {message.metadata?.from_dealer ? (
                        <User className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Bot className="w-4 h-4 text-primary" />
                      )}
                    </div>
                  )}
                  <div className={`max-w-[70%] ${message.role === 'user' ? 'order-first' : ''}`}>
                    <div
                      className={`rounded-2xl px-4 py-2 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : message.metadata?.from_dealer
                          ? 'bg-blue-100 border border-blue-200 rounded-bl-md'
                          : 'bg-muted rounded-bl-md'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                    <div className={`flex items-center gap-2 mt-1 text-xs text-muted-foreground ${
                      message.role === 'user' ? 'justify-end' : ''
                    }`}>
                      {message.metadata?.from_dealer && (
                        <span className="text-blue-600">You</span>
                      )}
                      {message.role === 'assistant' && !message.metadata?.from_dealer && (
                        <span>AI</span>
                      )}
                      <span>{format(new Date(message.created_at), 'h:mm a')}</span>
                    </div>
                  </div>
                  {message.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply Input */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  placeholder="Type a reply to take over from AI..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isSending || conversation.status === 'closed'}
                />
                <Button
                  onClick={handleSendReply}
                  disabled={!replyText.trim() || isSending || conversation.status === 'closed'}
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Your reply will appear to the visitor as a response from your team
              </p>
            </div>
          </Card>
        </div>

        {/* Sidebar - Contact Info */}
        <div className="w-80 space-y-4">
          {/* Visitor Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Visitor Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {conversation.visitor_name ? (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span>{conversation.visitor_name}</span>
                  </div>
                  {conversation.visitor_email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <a
                        href={`mailto:${conversation.visitor_email}`}
                        className="text-primary hover:underline"
                      >
                        {conversation.visitor_email}
                      </a>
                    </div>
                  )}
                  {conversation.visitor_phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <a
                        href={`tel:${conversation.visitor_phone}`}
                        className="text-primary hover:underline"
                      >
                        {conversation.visitor_phone}
                      </a>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No contact info collected yet
                </p>
              )}
            </CardContent>
          </Card>

          {/* Lead Info */}
          {conversation.lead && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <UserCheck className="w-4 h-4" />
                  Lead Created
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link href="/dashboard/leads">
                  <Button variant="outline" size="sm" className="w-full">
                    View in Leads
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Stats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Conversation Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Messages</span>
                <span className="font-medium">{pagination?.total || conversation.messages.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Loaded</span>
                <span className="font-medium">{conversation.messages.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Visitor Messages</span>
                <span className="font-medium">
                  {conversation.messages.filter((m) => m.role === 'user').length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">AI Responses</span>
                <span className="font-medium">
                  {conversation.messages.filter((m) => m.role === 'assistant' && !m.metadata?.from_dealer).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Your Replies</span>
                <span className="font-medium">
                  {conversation.messages.filter((m) => m.metadata?.from_dealer).length}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
