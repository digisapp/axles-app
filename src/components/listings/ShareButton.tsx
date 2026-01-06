'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Share2, Link2, Facebook, Twitter, Mail, Check } from 'lucide-react';
import { toast } from 'sonner';

interface ShareButtonProps {
  title: string;
  size?: 'sm' | 'default';
}

export function ShareButton({ title, size = 'default' }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy link');
    }
  };

  const shareLinks = [
    {
      label: 'Copy Link',
      icon: copied ? Check : Link2,
      onClick: copyToClipboard,
    },
    {
      label: 'Facebook',
      icon: Facebook,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      label: 'Twitter',
      icon: Twitter,
      href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    },
    {
      label: 'Email',
      icon: Mail,
      href: `mailto:?subject=${encodedTitle}&body=Check out this listing: ${encodedUrl}`,
    },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size={size}>
          <Share2 className={size === 'sm' ? 'w-4 h-4' : 'w-4 h-4 mr-2'} />
          {size !== 'sm' && 'Share'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {shareLinks.map((link) => (
          <DropdownMenuItem
            key={link.label}
            onClick={link.onClick}
            asChild={!!link.href}
            className="cursor-pointer"
          >
            {link.href ? (
              <a href={link.href} target="_blank" rel="noopener noreferrer">
                <link.icon className="w-4 h-4 mr-2" />
                {link.label}
              </a>
            ) : (
              <span className="flex items-center">
                <link.icon className="w-4 h-4 mr-2" />
                {link.label}
              </span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
