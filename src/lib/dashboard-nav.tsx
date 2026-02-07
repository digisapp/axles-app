import {
  LayoutDashboard,
  Package,
  BarChart3,
  Users,
  Warehouse,
  Upload,
  Settings,
  MessageSquare,
  Store,
  Bot,
  Phone,
  UserCog,
  Landmark,
  Handshake,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export const dashboardNavItems: NavItem[] = [
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
    href: '/dashboard/voice-agent',
    label: 'Voice Agent',
    icon: <Phone className="w-5 h-5" />,
  },
  {
    href: '/dashboard/staff',
    label: 'Staff Access',
    icon: <UserCog className="w-5 h-5" />,
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

export function getNavItemsWithBadges(
  items: NavItem[],
  unreadMessages: number,
  newLeads: number
): NavItem[] {
  return items.map((item) => {
    if (item.href === '/dashboard/messages' && unreadMessages > 0) {
      return { ...item, badge: unreadMessages };
    }
    if (item.href === '/dashboard/leads' && newLeads > 0) {
      return { ...item, badge: newLeads };
    }
    return item;
  });
}
