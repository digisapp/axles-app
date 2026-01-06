'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MobileSidebar } from './MobileSidebar';
import {
  Plus,
  Bell,
  Settings,
  LogOut,
  User,
  CreditCard,
  HelpCircle,
} from 'lucide-react';

interface DashboardHeaderProps {
  user: {
    email: string;
    id: string;
  };
  profile?: {
    company_name?: string | null;
    avatar_url?: string | null;
  } | null;
  unreadMessages?: number;
  newLeads?: number;
}

export function DashboardHeader({
  user,
  profile,
  unreadMessages = 0,
  newLeads = 0,
}: DashboardHeaderProps) {
  const displayName = profile?.company_name || user.email?.split('@')[0] || 'User';
  const initials = displayName.slice(0, 2).toUpperCase();
  const totalNotifications = unreadMessages + newLeads;

  return (
    <header className="h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30">
      <div className="h-full px-4 flex items-center justify-between gap-4">
        {/* Mobile Menu Trigger */}
        <MobileSidebar unreadMessages={unreadMessages} newLeads={newLeads} />

        {/* Page Title - Hidden on mobile, visible on desktop */}
        <div className="hidden lg:block">
          <h1 className="text-lg font-semibold">Dashboard</h1>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-2 ml-auto">
          {/* New Listing Button */}
          <Button size="sm" className="hidden sm:flex gap-2" asChild>
            <Link href="/dashboard/listings/new">
              <Plus className="w-4 h-4" />
              <span className="hidden md:inline">New Listing</span>
            </Link>
          </Button>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5" />
                {totalNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">
                    {totalNotifications > 9 ? '9+' : totalNotifications}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {unreadMessages > 0 && (
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/messages" className="cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full" />
                      <span>{unreadMessages} new message{unreadMessages !== 1 ? 's' : ''}</span>
                    </div>
                  </Link>
                </DropdownMenuItem>
              )}
              {newLeads > 0 && (
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/leads" className="cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full" />
                      <span>{newLeads} new lead{newLeads !== 1 ? 's' : ''}</span>
                    </div>
                  </Link>
                </DropdownMenuItem>
              )}
              {totalNotifications === 0 && (
                <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                  No new notifications
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>{displayName}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings" className="cursor-pointer">
                  <User className="w-4 h-4 mr-2" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/billing" className="cursor-pointer">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Billing
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings" className="cursor-pointer">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/help" className="cursor-pointer">
                  <HelpCircle className="w-4 h-4 mr-2" />
                  Help & Support
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <form action="/api/auth/signout" method="POST" className="w-full">
                  <button type="submit" className="flex items-center w-full">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </button>
                </form>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
