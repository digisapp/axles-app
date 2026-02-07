'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Share2, Link2, Facebook, Twitter, Mail, Check, MessageCircle, Send } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ShareButtonProps {
  title: string;
  price?: number | null;
  description?: string;
  url?: string;
  size?: 'sm' | 'default' | 'icon';
  variant?: 'default' | 'outline' | 'ghost';
  className?: string;
}

// WhatsApp icon component
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

export function ShareButton({
  title,
  price,
  description,
  url,
  size = 'default',
  variant = 'ghost',
  className,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
  const shareText = price ? `${title} - $${price.toLocaleString()}` : title;
  const fullDescription = description || `Check out this listing on AxlonAI: ${title}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareText,
          text: fullDescription,
          url: shareUrl,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      }
    }
  };

  const handleSmsShare = () => {
    const text = encodeURIComponent(`${shareText}\n${shareUrl}`);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const smsUrl = isIOS ? `sms:&body=${text}` : `sms:?body=${text}`;
    window.open(smsUrl, '_blank');
  };

  const handleWhatsAppShare = () => {
    const waUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`;
    window.open(waUrl, '_blank');
  };

  const canNativeShare = typeof navigator !== 'undefined' && navigator.share;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={cn(size !== 'icon' && 'gap-2', className)}>
          <Share2 className="w-4 h-4" />
          {size !== 'sm' && size !== 'icon' && 'Share'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {canNativeShare && (
          <>
            <DropdownMenuItem onClick={handleNativeShare} className="cursor-pointer">
              <Send className="w-4 h-4 mr-2" />
              Share...
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuItem onClick={copyToClipboard} className="cursor-pointer">
          {copied ? (
            <Check className="w-4 h-4 mr-2 text-green-500" />
          ) : (
            <Link2 className="w-4 h-4 mr-2" />
          )}
          {copied ? 'Copied!' : 'Copy Link'}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild className="cursor-pointer">
          <a
            href={`mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(`${fullDescription}\n\n${shareUrl}`)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Mail className="w-4 h-4 mr-2" />
            Email
          </a>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleSmsShare} className="cursor-pointer">
          <MessageCircle className="w-4 h-4 mr-2" />
          Text Message
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleWhatsAppShare} className="cursor-pointer">
          <WhatsAppIcon className="w-4 h-4 mr-2" />
          WhatsApp
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="cursor-pointer">
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Facebook className="w-4 h-4 mr-2" />
            Facebook
          </a>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="cursor-pointer">
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Twitter className="w-4 h-4 mr-2" />
            X (Twitter)
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Quick share bar for mobile-friendly inline sharing
export function QuickShareBar({
  title,
  price,
  url,
  className,
}: Pick<ShareButtonProps, 'title' | 'price' | 'url' | 'className'>) {
  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
  const shareText = price ? `${title} - $${price.toLocaleString()}` : title;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied!');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: shareText, url: shareUrl });
      } catch {
        // User cancelled
      }
    }
  };

  const canNativeShare = typeof navigator !== 'undefined' && navigator.share;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Button variant="outline" size="sm" className="flex-1" onClick={handleCopy}>
        <Link2 className="w-4 h-4 mr-2" />
        Copy Link
      </Button>
      {canNativeShare && (
        <Button variant="default" size="sm" className="flex-1" onClick={handleNativeShare}>
          <Share2 className="w-4 h-4 mr-2" />
          Share
        </Button>
      )}
    </div>
  );
}
