'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  MessageCircle,
  Send,
  Loader2,
  X,
  Minimize2,
  Maximize2,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

interface LiveChatProps {
  listingId: string;
  sellerId: string;
  sellerName: string;
  sellerAvatar?: string | null;
  listingTitle: string;
}

export function LiveChat({
  listingId,
  sellerId,
  sellerName,
  sellerAvatar,
  listingTitle,
}: LiveChatProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Check auth state
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);
      setUserId(user?.id || null);
    };
    checkAuth();
  }, [supabase]);

  // Fetch existing messages when chat opens
  const fetchMessages = useCallback(async () => {
    if (!userId || !isOpen) return;

    setIsLoading(true);
    try {
      const conversationId = `${listingId}-${sellerId}`;
      const response = await fetch(`/api/messages/${conversationId}`);
      if (response.ok) {
        const { data } = await response.json();
        setMessages(data?.messages || []);
      }
    } catch (error) {
      console.error('Fetch messages error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, isOpen, listingId, sellerId]);

  useEffect(() => {
    if (isOpen && userId) {
      fetchMessages();
    }
  }, [isOpen, userId, fetchMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Real-time subscription
  useEffect(() => {
    if (!userId || !isOpen) return;

    const channel = supabase
      .channel(`messages-${listingId}-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `listing_id=eq.${listingId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          // Only add if it's for this conversation
          if (
            (newMsg.sender_id === userId && newMsg.recipient_id === sellerId) ||
            (newMsg.sender_id === sellerId && newMsg.recipient_id === userId)
          ) {
            setMessages((prev) => {
              // Avoid duplicates
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });

            // Increment unread if chat is minimized and message is from seller
            if (isMinimized && newMsg.sender_id === sellerId) {
              setUnreadCount((prev) => prev + 1);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, sellerId, listingId, isOpen, isMinimized, supabase]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !userId) return;

    // Don't let user message themselves
    if (userId === sellerId) {
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
          content: newMessage.trim(),
        }),
      });

      if (response.ok) {
        const { data } = await response.json();
        // Add to local state immediately
        setMessages((prev) => [...prev, { ...data, sender_id: userId }]);
        setNewMessage('');
        inputRef.current?.focus();
      }
    } catch (error) {
      console.error('Send error:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleOpen = () => {
    if (!isLoggedIn) {
      router.push(`/login?redirect=/listing/${listingId}`);
      return;
    }

    if (userId === sellerId) {
      return; // Can't chat with yourself
    }

    setIsOpen(true);
    setIsMinimized(false);
    setUnreadCount(0);
  };

  const handleMinimize = () => {
    setIsMinimized(true);
  };

  const handleMaximize = () => {
    setIsMinimized(false);
    setUnreadCount(0);
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsMinimized(false);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Don't show chat button if user is the seller
  if (userId === sellerId) {
    return null;
  }

  return (
    <>
      {/* Chat Button */}
      {!isOpen && (
        <Button
          onClick={handleOpen}
          className="w-full"
          variant="outline"
        >
          <MessageCircle className="w-4 h-4 mr-2" />
          Chat with Dealer
        </Button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <Card
          className={cn(
            'fixed z-50 shadow-2xl transition-all duration-200',
            isMinimized
              ? 'bottom-4 right-4 w-72'
              : 'bottom-4 right-4 w-96 max-w-[calc(100vw-2rem)]'
          )}
        >
          {/* Header */}
          <CardHeader className="p-3 border-b">
            <div className="flex items-center justify-between">
              <div
                className="flex items-center gap-2 cursor-pointer"
                onClick={isMinimized ? handleMaximize : undefined}
              >
                <Avatar className="w-8 h-8">
                  <AvatarImage src={sellerAvatar || undefined} />
                  <AvatarFallback>
                    {sellerName?.[0]?.toUpperCase() || <User className="w-4 h-4" />}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{sellerName}</p>
                  {!isMinimized && (
                    <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                      {listingTitle}
                    </p>
                  )}
                </div>
                {isMinimized && unreadCount > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={isMinimized ? handleMaximize : handleMinimize}
                >
                  {isMinimized ? (
                    <Maximize2 className="w-4 h-4" />
                  ) : (
                    <Minimize2 className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleClose}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          {/* Messages */}
          {!isMinimized && (
            <>
              <CardContent className="p-0">
                <div className="h-80 overflow-y-auto p-3 space-y-3">
                  {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <MessageCircle className="w-10 h-10 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Start a conversation with {sellerName}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Ask about this listing
                      </p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isFromMe = msg.sender_id === userId;

                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            'flex',
                            isFromMe ? 'justify-end' : 'justify-start'
                          )}
                        >
                          <div
                            className={cn(
                              'max-w-[80%] rounded-2xl px-3 py-2',
                              isFromMe
                                ? 'bg-primary text-primary-foreground rounded-br-md'
                                : 'bg-muted rounded-bl-md'
                            )}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {msg.content}
                            </p>
                            <p
                              className={cn(
                                'text-[10px] mt-1',
                                isFromMe
                                  ? 'text-primary-foreground/70'
                                  : 'text-muted-foreground'
                              )}
                            >
                              {formatTime(msg.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </CardContent>

              {/* Input */}
              <div className="p-3 border-t">
                <form onSubmit={handleSend} className="flex gap-2">
                  <Input
                    ref={inputRef}
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    disabled={isSending}
                    className="flex-1"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={isSending || !newMessage.trim()}
                  >
                    {isSending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </form>
              </div>
            </>
          )}
        </Card>
      )}
    </>
  );
}
