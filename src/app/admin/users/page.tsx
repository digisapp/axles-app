'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  Search,
  Users,
  Building2,
  UserX,
  Shield,
  MoreVertical,
  Loader2,
  Package,
  ChevronLeft,
  ChevronRight,
  Ban,
  CheckCircle,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { logger } from '@/lib/logger';

interface User {
  id: string;
  email: string;
  company_name: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  is_dealer: boolean;
  dealer_status: string;
  is_admin: boolean;
  is_suspended: boolean;
  suspended_at: string | null;
  avatar_url: string | null;
  created_at: string;
  listing_count: number;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ total_users: 0, total_dealers: 0, suspended_users: 0 });

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionType, setActionType] = useState<'suspend' | 'unsuspend' | 'make_admin' | 'remove_admin' | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [search, typeFilter, statusFilter, page]);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        search,
        type: typeFilter,
        status: statusFilter,
      });
      const response = await fetch(`/api/admin/users?${params}`);
      if (response.ok) {
        const data = await response.json();
        setUsers(data.data || []);
        setTotalPages(data.total_pages || 1);
        setStats(data.stats || { total_users: 0, total_dealers: 0, suspended_users: 0 });
      }
    } catch (error) {
      logger.error('Error fetching users', { error });
    }
    setIsLoading(false);
  };

  const handleAction = async () => {
    if (!selectedUser || !actionType) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionType,
          reason: actionType === 'suspend' ? suspendReason : undefined,
        }),
      });

      if (response.ok) {
        setSelectedUser(null);
        setActionType(null);
        setSuspendReason('');
        fetchUsers();
      }
    } catch (error) {
      logger.error('Error updating user', { error });
    }
    setIsSubmitting(false);
  };

  const getActionDialogContent = () => {
    switch (actionType) {
      case 'suspend':
        return {
          title: 'Suspend User',
          description: `Are you sure you want to suspend ${selectedUser?.company_name || selectedUser?.email}? They will not be able to access their account.`,
          showReason: true,
          buttonText: 'Suspend',
          buttonVariant: 'destructive' as const,
        };
      case 'unsuspend':
        return {
          title: 'Unsuspend User',
          description: `Are you sure you want to unsuspend ${selectedUser?.company_name || selectedUser?.email}? They will regain access to their account.`,
          showReason: false,
          buttonText: 'Unsuspend',
          buttonVariant: 'default' as const,
        };
      case 'make_admin':
        return {
          title: 'Make Admin',
          description: `Are you sure you want to give admin privileges to ${selectedUser?.company_name || selectedUser?.email}?`,
          showReason: false,
          buttonText: 'Make Admin',
          buttonVariant: 'default' as const,
        };
      case 'remove_admin':
        return {
          title: 'Remove Admin',
          description: `Are you sure you want to remove admin privileges from ${selectedUser?.company_name || selectedUser?.email}?`,
          showReason: false,
          buttonText: 'Remove Admin',
          buttonVariant: 'destructive' as const,
        };
      default:
        return null;
    }
  };

  const dialogContent = getActionDialogContent();

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">User Management</h1>
              <p className="text-sm text-muted-foreground">
                Manage all users and their permissions
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total_users}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <Building2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total_dealers}</p>
                <p className="text-sm text-muted-foreground">Dealers</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <UserX className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.suspended_users}</p>
                <p className="text-sm text-muted-foreground">Suspended</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email or company name..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-10"
                />
              </div>
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="User Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="dealers">Dealers</SelectItem>
                  <SelectItem value="individuals">Individuals</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Users List */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No users found</p>
              </div>
            ) : (
              <div className="divide-y">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback>
                          {(user.company_name || user.email)?.[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">
                            {user.company_name || user.email.split('@')[0]}
                          </h3>
                          {user.is_admin && (
                            <Badge variant="default" className="gap-1">
                              <Shield className="w-3 h-3" />
                              Admin
                            </Badge>
                          )}
                          {user.is_dealer && (
                            <Badge variant="secondary">Dealer</Badge>
                          )}
                          {user.is_suspended && (
                            <Badge variant="destructive">Suspended</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Package className="w-3 h-3" />
                          {user.listing_count} listings
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Joined {new Date(user.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/${user.id}`}>
                              View Profile
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {user.is_suspended ? (
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedUser(user);
                                setActionType('unsuspend');
                              }}
                              className="text-green-600"
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Unsuspend
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedUser(user);
                                setActionType('suspend');
                              }}
                              className="text-red-600"
                            >
                              <Ban className="w-4 h-4 mr-2" />
                              Suspend
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {user.is_admin ? (
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedUser(user);
                                setActionType('remove_admin');
                              }}
                              className="text-orange-600"
                            >
                              <ShieldAlert className="w-4 h-4 mr-2" />
                              Remove Admin
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedUser(user);
                                setActionType('make_admin');
                              }}
                            >
                              <ShieldCheck className="w-4 h-4 mr-2" />
                              Make Admin
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 p-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Action Dialog */}
      <Dialog
        open={!!selectedUser && !!actionType && !!dialogContent}
        onOpenChange={() => {
          setSelectedUser(null);
          setActionType(null);
          setSuspendReason('');
        }}
      >
        {dialogContent && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{dialogContent.title}</DialogTitle>
              <DialogDescription>{dialogContent.description}</DialogDescription>
            </DialogHeader>

            {dialogContent.showReason && (
              <div className="py-4">
                <Textarea
                  placeholder="Reason for suspension..."
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedUser(null);
                  setActionType(null);
                  setSuspendReason('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant={dialogContent.buttonVariant}
                onClick={handleAction}
                disabled={isSubmitting || (actionType === 'suspend' && !suspendReason)}
              >
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {dialogContent.buttonText}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
