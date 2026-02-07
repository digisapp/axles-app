'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  LayoutDashboard,
  Package,
  BarChart3,
  Users,
  Warehouse,
  Upload,
  Settings,
  MessageSquare,
  Heart,
  Menu,
  Store,
  Bot,
  Bell,
  Search,
  Landmark,
  Handshake,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

const navItems: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Overview',
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    href: '/dashboard/listings',
    label: 'Listings',
    icon: <Package className="w-5 h-5" />,
  },
  {
    href: '/dashboard/analytics',
    label: 'Analytics',
    icon: <BarChart3 className="w-5 h-5" />,
  },
  {
    href: '/dashboard/leads',
    label: 'Leads',
    icon: <Users className="w-5 h-5" />,
  },
  {
    href: '/dashboard/deal-desk',
    label: 'Deal Desk',
    icon: <Handshake className="w-5 h-5" />,
  },
  {
    href: '/dashboard/inventory',
    label: 'Inventory',
    icon: <Warehouse className="w-5 h-5" />,
  },
  {
    href: '/dashboard/floor-plan',
    label: 'Floor Plan',
    icon: <Landmark className="w-5 h-5" />,
  },
  {
    href: '/dashboard/bulk',
    label: 'Bulk Import',
    icon: <Upload className="w-5 h-5" />,
  },
  {
    href: '/dashboard/storefront',
    label: 'Storefront',
    icon: <Store className="w-5 h-5" />,
  },
  {
    href: '/dashboard/conversations',
    label: 'AI Chats',
    icon: <Bot className="w-5 h-5" />,
  },
  {
    href: '/dashboard/messages',
    label: 'Messages',
    icon: <MessageSquare className="w-5 h-5" />,
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    icon: <Settings className="w-5 h-5" />,
  },
];

interface MobileSidebarProps {
  unreadMessages?: number;
  newLeads?: number;
}

export function MobileSidebar({
  unreadMessages = 0,
  newLeads = 0,
}: MobileSidebarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const itemsWithBadges = navItems.map((item) => {
    if (item.href === '/dashboard/messages' && unreadMessages > 0) {
      return { ...item, badge: unreadMessages };
    }
    if (item.href === '/dashboard/leads' && newLeads > 0) {
      return { ...item, badge: newLeads };
    }
    return item;
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="w-5 h-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="h-16 border-b px-4 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="/images/axlonai-logo.png"
              alt="AxlonAI"
              width={32}
              height={32}
              className="w-8 h-8"
            />
            <SheetTitle className="font-bold text-lg">AxlonAI</SheetTitle>
          </div>
        </SheetHeader>

        <nav className="p-3 space-y-1">
          {itemsWithBadges.map((item) => {
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
                {item.badge && item.badge > 0 && (
                  <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Banner */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background">
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-4">
            <p className="font-medium text-sm mb-1">Upgrade to Pro</p>
            <p className="text-xs text-muted-foreground mb-3">
              Get featured listings & advanced analytics
            </p>
            <Button size="sm" className="w-full" asChild>
              <Link href="/dashboard/billing" onClick={() => setOpen(false)}>
                Upgrade
              </Link>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
