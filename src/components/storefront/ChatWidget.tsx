'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Bot,
  User,
  Minimize2,
  Sparkles,
} from 'lucide-react';
import { logger } from '@/lib/logger';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatWidgetProps {
  dealerId: string;
  dealerName: string;
  chatSettings?: {
    greeting?: string;
    personality?: string;
    collectLeadAfter?: number;
  };
}

export function ChatWidget({ dealerId, dealerName, chatSettings }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadInfo, setLeadInfo] = useState({ name: '', email: '', phone: '' });
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const greeting = chatSettings?.greeting || `Hi! I'm the AI assistant for ${dealerName}. How can I help you find the right equipment today?`;

  // Initialize with greeting
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: '1',
          role: 'assistant',
          content: greeting,
          timestamp: new Date(),
        },
      ]);
    }
  }, [isOpen, greeting, messages.length]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Show lead form after X messages
  useEffect(() => {
    const collectAfter = chatSettings?.collectLeadAfter || 3;
    const userMessages = messages.filter((m) => m.role === 'user').length;
    if (userMessages >= collectAfter && !leadSubmitted && !showLeadForm) {
      setShowLeadForm(true);
    }
  }, [messages, chatSettings?.collectLeadAfter, leadSubmitted, showLeadForm]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealerId,
          conversationId,
          message: userMessage.content,
          chatSettings,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // Save conversation ID for continuity
        if (data.conversationId) {
          setConversationId(data.conversationId);
        }

        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        // Error message
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: "I'm sorry, I'm having trouble connecting. Please try again or call us directly.",
            timestamp: new Date(),
          },
        ]);
      }
    } catch (error) {
      logger.error('Chat error', { error });
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: "I'm sorry, something went wrong. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeadSubmit = async () => {
    if (!leadInfo.name || !leadInfo.email) return;

    try {
      await fetch('/api/chat/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealerId,
          conversationId,
          ...leadInfo,
        }),
      });

      setLeadSubmitted(true);
      setShowLeadForm(false);

      // Add confirmation message
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: `Thanks ${leadInfo.name}! I've saved your contact info. A member of our team will follow up with you soon. In the meantime, feel free to keep asking questions!`,
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      logger.error('Lead submit error', { error });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg z-50"
        size="icon"
      >
        <MessageCircle className="w-6 h-6" />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 w-[360px] h-[500px] shadow-2xl z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold">{dealerName}</p>
            <p className="text-xs text-white/70">AI Sales Assistant</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20"
          onClick={() => setIsOpen(false)}
        >
          <Minimize2 className="w-5 h-5" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-primary" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-md'
                  : 'bg-card border rounded-bl-md'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            </div>
            {message.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="bg-card border rounded-2xl rounded-bl-md px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          </div>
        )}

        {/* Lead Collection Form */}
        {showLeadForm && !leadSubmitted && (
          <div className="bg-card border rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium">
              Want us to follow up with more details? Leave your info:
            </p>
            <Input
              placeholder="Your name"
              value={leadInfo.name}
              onChange={(e) => setLeadInfo({ ...leadInfo, name: e.target.value })}
              className="h-9 text-sm"
            />
            <Input
              placeholder="Email"
              type="email"
              value={leadInfo.email}
              onChange={(e) => setLeadInfo({ ...leadInfo, email: e.target.value })}
              className="h-9 text-sm"
            />
            <Input
              placeholder="Phone (optional)"
              type="tel"
              value={leadInfo.phone}
              onChange={(e) => setLeadInfo({ ...leadInfo, phone: e.target.value })}
              className="h-9 text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleLeadSubmit} disabled={!leadInfo.name || !leadInfo.email}>
                Submit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowLeadForm(false)}>
                Maybe later
              </Button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t bg-background">
        <div className="flex gap-2">
          <Input
            placeholder="Ask about inventory, pricing, availability..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={!input.trim() || isLoading} size="icon">
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Powered by AI - Responses may not be 100% accurate
        </p>
      </div>
    </Card>
  );
}
