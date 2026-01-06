'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Store,
  Bot,
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
    href: '/dashboard/inventory',
    label: 'Inventory',
    icon: <Warehouse className="w-5 h-5" />,
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
    href: '/dashboard/saved',
    label: 'Saved',
    icon: <Heart className="w-5 h-5" />,
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    icon: <Settings className="w-5 h-5" />,
  },
];

interface SidebarProps {
  unreadMessages?: number;
  newLeads?: number;
}

export function Sidebar({ unreadMessages = 0, newLeads = 0 }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
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
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen bg-background border-r transition-all duration-300 flex flex-col',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Logo */}
        <div className="h-16 border-b flex items-center px-4">
          <Link href="/" className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary flex-shrink-0" />
            {!collapsed && (
              <span className="font-bold text-lg">AxlesAI</span>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {itemsWithBadges.map((item) => {
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href);

            const linkContent = (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors relative',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                  collapsed && 'justify-center px-2'
                )}
              >
                {item.icon}
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {item.badge && item.badge > 0 && (
                      <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
                {collapsed && item.badge && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 flex items-center justify-center rounded-full">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right" className="flex items-center gap-2">
                    {item.label}
                    {item.badge && item.badge > 0 && (
                      <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return linkContent;
          })}
        </nav>

        {/* Upgrade Banner */}
        {!collapsed && (
          <div className="p-3 border-t">
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-4">
              <p className="font-medium text-sm mb-1">Upgrade to Pro</p>
              <p className="text-xs text-muted-foreground mb-3">
                Get featured listings & advanced analytics
              </p>
              <Button size="sm" className="w-full" asChild>
                <Link href="/dashboard/billing">Upgrade</Link>
              </Button>
            </div>
          </div>
        )}

        {/* Collapse Toggle */}
        <div className="p-3 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className={cn('w-full', collapsed && 'px-2')}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Collapse
              </>
            )}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  );
}

export function SidebarSpacer({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div
      className={cn(
        'flex-shrink-0 transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    />
  );
}
