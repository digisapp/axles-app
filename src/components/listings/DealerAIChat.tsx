'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import {
  Bot,
  Send,
  Loader2,
  X,
  Minimize2,
  Maximize2,
  User,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestedListings?: SuggestedListing[];
}

interface SuggestedListing {
  id: string;
  title: string;
  price: number | null;
  year: number | null;
  make: string | null;
  model: string | null;
  location?: string;
}

interface DealerAIChatProps {
  dealerId: string;
  dealerName: string;
  listingId?: string;
  listingTitle?: string;
  className?: string;
}

export function DealerAIChat({
  dealerId,
  dealerName,
  listingId,
  listingTitle,
  className,
}: DealerAIChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [assistantName, setAssistantName] = useState('Axlon');
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [visitorInfo, setVisitorInfo] = useState({
    name: '',
    email: '',
    phone: '',
    interest: '',
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize conversation when chat opens
  const initConversation = useCallback(async () => {
    if (conversationId) return;

    try {
      const response = await fetch('/api/ai/dealer-chat', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealerId,
          listingId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setConversationId(data.conversationId);
      }
    } catch (error) {
      logger.error('Failed to init conversation', { error });
    }
  }, [dealerId, listingId, conversationId]);

  // Fetch greeting when chat opens
  const fetchGreeting = useCallback(async () => {
    if (messages.length > 0) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/ai/dealer-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealerId,
          query: listingId
            ? `I'm looking at the ${listingTitle || 'listing'}. Can you tell me about it?`
            : 'Hello',
          listingId,
          messages: [],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.assistantName) {
          setAssistantName(data.assistantName);
        }

        const greeting: Message = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
          suggestedListings: data.suggestedListings,
        };
        setMessages([greeting]);
      }
    } catch (error) {
      logger.error('Failed to fetch greeting', { error });
      // Fallback greeting
      setMessages([{
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: `Hey there! I'm Axlon, here to help you explore ${dealerName}'s inventory. What are you looking for today?`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [dealerId, dealerName, listingId, listingTitle, messages.length]);

  const handleOpen = () => {
    setIsOpen(true);
    setIsMinimized(false);
    initConversation();
    fetchGreeting();
  };

  const handleMinimize = () => {
    setIsMinimized(true);
  };

  const handleMaximize = () => {
    setIsMinimized(false);
    inputRef.current?.focus();
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsMinimized(false);
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/dealer-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealerId,
          query: userMessage.content,
          conversationId,
          listingId,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (response.ok) {
        const data = await response.json();

        const assistantMessage: Message = {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
          suggestedListings: data.suggestedListings,
        };

        setMessages(prev => [...prev, assistantMessage]);

        // Show lead form if AI suggests capturing
        if (data.shouldCaptureLead && !leadCaptured) {
          setTimeout(() => {
            setShowLeadForm(true);
          }, 500);
        }
      }
    } catch (error) {
      logger.error('Failed to send message', { error });
      setMessages(prev => [...prev, {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: "I'm having trouble responding right now. Please try again or contact us directly.",
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!visitorInfo.email && !visitorInfo.phone) return;

    try {
      const response = await fetch('/api/ai/dealer-chat', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealerId,
          conversationId,
          visitorName: visitorInfo.name,
          visitorEmail: visitorInfo.email,
          visitorPhone: visitorInfo.phone,
          visitorIntent: visitorInfo.interest || listingTitle,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.leadCaptured) {
          setLeadCaptured(true);
          setShowLeadForm(false);

          // Add confirmation message
          setMessages(prev => [...prev, {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: `Thanks ${visitorInfo.name || 'for your info'}! A team member from ${dealerName} will be in touch with you shortly. Is there anything else I can help you with in the meantime?`,
            timestamp: new Date(),
          }]);
        }
      }
    } catch (error) {
      logger.error('Failed to submit lead', { error });
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      {/* Chat Button */}
      {!isOpen && (
        <Button
          onClick={handleOpen}
          className={cn(
            'flex items-center gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70',
            className
          )}
        >
          <Bot className="w-4 h-4" />
          <span>Ask AI About This</span>
          <Sparkles className="w-3 h-3" />
        </Button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <Card
          className={cn(
            'fixed z-50 shadow-2xl transition-all duration-200 border-2',
            isMinimized
              ? 'bottom-4 right-4 w-72'
              : 'bottom-4 right-4 w-[400px] max-w-[calc(100vw-2rem)]'
          )}
        >
          {/* Header */}
          <CardHeader className="p-3 border-b bg-gradient-to-r from-primary/10 to-primary/5">
            <div className="flex items-center justify-between">
              <div
                className="flex items-center gap-3 cursor-pointer"
                onClick={isMinimized ? handleMaximize : undefined}
              >
                <div className="relative">
                  <Avatar className="w-10 h-10 bg-primary">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <Bot className="w-5 h-5" />
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{assistantName}</p>
                  <p className="text-xs text-muted-foreground">
                    {dealerName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
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
                  className="h-8 w-8"
                  onClick={handleClose}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          {/* Chat Content */}
          {!isMinimized && (
            <>
              <CardContent className="p-0">
                <div className="h-[350px] overflow-y-auto p-4 space-y-4">
                  {messages.map((msg) => (
                    <div key={msg.id}>
                      <div
                        className={cn(
                          'flex',
                          msg.role === 'user' ? 'justify-end' : 'justify-start'
                        )}
                      >
                        <div className="flex items-start gap-2 max-w-[85%]">
                          {msg.role === 'assistant' && (
                            <Avatar className="w-7 h-7 flex-shrink-0">
                              <AvatarFallback className="bg-primary/10 text-primary">
                                <Bot className="w-4 h-4" />
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <div>
                            <div
                              className={cn(
                                'rounded-2xl px-4 py-2.5',
                                msg.role === 'user'
                                  ? 'bg-primary text-primary-foreground rounded-br-md'
                                  : 'bg-muted rounded-bl-md'
                              )}
                            >
                              <p className="text-sm whitespace-pre-wrap break-words">
                                {msg.content}
                              </p>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1 px-2">
                              {formatTime(msg.timestamp)}
                            </p>
                          </div>
                          {msg.role === 'user' && (
                            <Avatar className="w-7 h-7 flex-shrink-0">
                              <AvatarFallback className="bg-secondary">
                                <User className="w-4 h-4" />
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                      </div>

                      {/* Suggested Listings */}
                      {msg.suggestedListings && msg.suggestedListings.length > 0 && (
                        <div className="ml-9 mt-3 space-y-2">
                          <p className="text-xs text-muted-foreground font-medium">
                            Recommended for you:
                          </p>
                          {msg.suggestedListings.slice(0, 2).map((listing) => (
                            <Link
                              key={listing.id}
                              href={`/listing/${listing.id}`}
                              className="block p-3 bg-background border rounded-lg hover:border-primary transition-colors"
                            >
                              <p className="font-medium text-sm truncate">
                                {listing.title}
                              </p>
                              <div className="flex items-center justify-between mt-1">
                                <p className="text-sm text-primary font-semibold">
                                  {listing.price
                                    ? `$${listing.price.toLocaleString()}`
                                    : 'Call for price'}
                                </p>
                                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="flex items-center gap-2">
                        <Avatar className="w-7 h-7">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            <Bot className="w-4 h-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                          <div className="flex gap-1">
                            <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Lead Capture Form */}
                  {showLeadForm && !leadCaptured && (
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mt-4">
                      <p className="font-medium text-sm mb-3">
                        Want us to reach out to you?
                      </p>
                      <form onSubmit={handleLeadSubmit} className="space-y-3">
                        <div>
                          <Label htmlFor="name" className="text-xs">Name</Label>
                          <Input
                            id="name"
                            placeholder="Your name"
                            value={visitorInfo.name}
                            onChange={(e) => setVisitorInfo({ ...visitorInfo, name: e.target.value })}
                            className="h-9"
                          />
                        </div>
                        <div>
                          <Label htmlFor="email" className="text-xs">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="your@email.com"
                            value={visitorInfo.email}
                            onChange={(e) => setVisitorInfo({ ...visitorInfo, email: e.target.value })}
                            className="h-9"
                          />
                        </div>
                        <div>
                          <Label htmlFor="phone" className="text-xs">Phone (optional)</Label>
                          <Input
                            id="phone"
                            type="tel"
                            placeholder="(555) 123-4567"
                            value={visitorInfo.phone}
                            onChange={(e) => setVisitorInfo({ ...visitorInfo, phone: e.target.value })}
                            className="h-9"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowLeadForm(false)}
                            className="flex-1"
                          >
                            Maybe later
                          </Button>
                          <Button
                            type="submit"
                            size="sm"
                            className="flex-1"
                            disabled={!visitorInfo.email && !visitorInfo.phone}
                          >
                            Contact me
                          </Button>
                        </div>
                      </form>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </CardContent>

              {/* Input */}
              <div className="p-3 border-t">
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    placeholder="Ask me anything..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={isLoading || !inputValue.trim()}
                    size="icon"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground text-center mt-2">
                  Powered by Axlon • {dealerName}
                </p>
              </div>
            </>
          )}
        </Card>
      )}
    </>
  );
}
