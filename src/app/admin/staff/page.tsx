'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeft,
  Loader2,
  Search,
  Users,
  UserCheck,
  UserX,
  Lock,
  Unlock,
  Key,
  MoreHorizontal,
  Building2,
  Shield,
  Clock,
  AlertTriangle,
  CheckCircle,
  Copy,
  Eye,
  Trash2,
} from 'lucide-react';

interface DealerStaff {
  id: string;
  dealer_id: string;
  name: string;
  role: string;
  email: string | null;
  phone_number: string | null;
  access_level: string;
  can_view_costs: boolean;
  can_view_margins: boolean;
  can_view_all_leads: boolean;
  can_modify_inventory: boolean;
  last_access_at: string | null;
  access_count: number;
  failed_attempts: number;
  locked_until: string | null;
  is_active: boolean;
  created_at: string;
  dealer?: {
    id: string;
    email: string;
    company_name: string | null;
  };
}

interface Stats {
  total: number;
  active: number;
  inactive: number;
  locked: number;
}

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<DealerStaff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, inactive: 0, locked: 0 });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Action dialogs
  const [selectedStaff, setSelectedStaff] = useState<DealerStaff | null>(null);
  const [actionDialog, setActionDialog] = useState<'unlock' | 'reset_pin' | 'disable' | 'delete' | 'details' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newPin, setNewPin] = useState<string | null>(null);

  const fetchStaff = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      if (searchQuery) {
        params.set('search', searchQuery);
      }

      const response = await fetch(`/api/admin/dealer-staff?${params}`);
      if (response.ok) {
        const data = await response.json();
        setStaff(data.data || []);
        setStats(data.stats || { total: 0, active: 0, inactive: 0, locked: 0 });
        setPagination(prev => ({
          ...prev,
          total: data.pagination?.total || 0,
          totalPages: data.pagination?.totalPages || 0,
        }));
      }
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, pagination.page]);

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchStaff();
  };

  const handleAction = async (action: 'unlock' | 'reset_pin' | 'disable' | 'enable' | 'delete') => {
    if (!selectedStaff) return;

    setIsSubmitting(true);
    try {
      if (action === 'delete') {
        const response = await fetch(`/api/admin/dealer-staff/${selectedStaff.id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          setActionDialog(null);
          fetchStaff();
        }
      } else {
        const response = await fetch(`/api/admin/dealer-staff/${selectedStaff.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });

        if (response.ok) {
          const data = await response.json();

          if (action === 'reset_pin' && data.new_pin) {
            setNewPin(data.new_pin);
          } else {
            setActionDialog(null);
            fetchStaff();
          }
        }
      }
    } catch (error) {
      console.error('Error performing action:', error);
    }
    setIsSubmitting(false);
  };

  const isLocked = (staff: DealerStaff) => {
    if (!staff.locked_until) return false;
    return new Date(staff.locked_until) > new Date();
  };

  const getStatusBadge = (staff: DealerStaff) => {
    if (!staff.is_active) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    if (isLocked(staff)) {
      return <Badge variant="destructive">Locked</Badge>;
    }
    return <Badge variant="default" className="bg-green-100 text-green-700">Active</Badge>;
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge variant="outline" className="border-purple-500 text-purple-600">Admin</Badge>;
      case 'manager':
        return <Badge variant="outline" className="border-blue-500 text-blue-600">Manager</Badge>;
      case 'service':
        return <Badge variant="outline" className="border-orange-500 text-orange-600">Service</Badge>;
      default:
        return <Badge variant="outline">Sales</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-xl font-bold">Dealer Staff Management</h1>
              <p className="text-sm text-muted-foreground">
                Manage voice PIN authentication for dealer staff
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Staff</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <UserCheck className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.active}</p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <UserX className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.inactive}</p>
                  <p className="text-xs text-muted-foreground">Inactive</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.locked}</p>
                  <p className="text-xs text-muted-foreground">Locked</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 flex gap-2">
                <Input
                  placeholder="Search by name, email, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="max-w-sm"
                />
                <Button variant="outline" onClick={handleSearch}>
                  <Search className="w-4 h-4" />
                </Button>
              </div>
              <Select value={statusFilter} onValueChange={(v) => {
                setStatusFilter(v);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Staff</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="locked">Locked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Staff Table */}
        <Card>
          <CardHeader>
            <CardTitle>Staff Members</CardTitle>
            <CardDescription>
              {pagination.total} total staff members
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : staff.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No staff found</p>
                <p className="text-sm">
                  {searchQuery || statusFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Dealers can add staff from their dashboard'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff Member</TableHead>
                    <TableHead>Dealer</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Access</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{member.name}</p>
                          {member.email && (
                            <p className="text-xs text-muted-foreground">{member.email}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">
                            {member.dealer?.company_name || 'Unknown'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(member.role)}</TableCell>
                      <TableCell>{getStatusBadge(member)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {member.can_view_costs && (
                            <Badge variant="outline" className="text-xs">Costs</Badge>
                          )}
                          {member.can_view_margins && (
                            <Badge variant="outline" className="text-xs">Margins</Badge>
                          )}
                          {member.access_level === 'admin' && (
                            <Shield className="w-4 h-4 text-purple-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {member.last_access_at ? (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {new Date(member.last_access_at).toLocaleDateString()}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Never</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                              setSelectedStaff(member);
                              setActionDialog('details');
                            }}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {isLocked(member) && (
                              <DropdownMenuItem onClick={() => {
                                setSelectedStaff(member);
                                setActionDialog('unlock');
                              }}>
                                <Unlock className="w-4 h-4 mr-2" />
                                Unlock Account
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => {
                              setSelectedStaff(member);
                              setActionDialog('reset_pin');
                            }}>
                              <Key className="w-4 h-4 mr-2" />
                              Reset PIN
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setSelectedStaff(member);
                              setActionDialog('disable');
                            }}>
                              <UserX className="w-4 h-4 mr-2" />
                              {member.is_active ? 'Disable' : 'Enable'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => {
                                setSelectedStaff(member);
                                setActionDialog('delete');
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Unlock Dialog */}
      <Dialog open={actionDialog === 'unlock'} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unlock Account</DialogTitle>
            <DialogDescription>
              This will unlock {selectedStaff?.name}&apos;s account and reset their failed attempt counter.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-3 p-4 bg-yellow-50 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-700">Account was locked</p>
                <p className="text-sm text-yellow-600">
                  Failed attempts: {selectedStaff?.failed_attempts || 0}
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              Cancel
            </Button>
            <Button onClick={() => handleAction('unlock')} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Unlock Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset PIN Dialog */}
      <Dialog open={actionDialog === 'reset_pin'} onOpenChange={() => {
        setActionDialog(null);
        setNewPin(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset PIN</DialogTitle>
            <DialogDescription>
              Generate a new PIN for {selectedStaff?.name}. Make sure to share this PIN securely.
            </DialogDescription>
          </DialogHeader>
          {newPin ? (
            <div className="py-4">
              <div className="flex flex-col items-center gap-4 p-6 bg-green-50 rounded-lg">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <div className="text-center">
                  <p className="font-medium text-green-700">New PIN Generated</p>
                  <p className="text-3xl font-mono font-bold mt-2">{newPin}</p>
                  <p className="text-sm text-green-600 mt-2">
                    This PIN will only be shown once. Make sure to save it.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(newPin);
                  }}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy PIN
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-4">
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                <Key className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-700">Generate New PIN</p>
                  <p className="text-sm text-blue-600">
                    A random 4-digit PIN will be generated
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            {newPin ? (
              <Button onClick={() => {
                setActionDialog(null);
                setNewPin(null);
                fetchStaff();
              }}>
                Done
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setActionDialog(null)}>
                  Cancel
                </Button>
                <Button onClick={() => handleAction('reset_pin')} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Generate New PIN
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable/Enable Dialog */}
      <Dialog open={actionDialog === 'disable'} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedStaff?.is_active ? 'Disable Account' : 'Enable Account'}
            </DialogTitle>
            <DialogDescription>
              {selectedStaff?.is_active
                ? `This will prevent ${selectedStaff?.name} from accessing the system via voice PIN.`
                : `This will allow ${selectedStaff?.name} to access the system via voice PIN again.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              Cancel
            </Button>
            <Button
              variant={selectedStaff?.is_active ? 'destructive' : 'default'}
              onClick={() => handleAction(selectedStaff?.is_active ? 'disable' : 'enable')}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {selectedStaff?.is_active ? 'Disable' : 'Enable'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={actionDialog === 'delete'} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Staff Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedStaff?.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <div>
                <p className="font-medium text-red-700">Warning</p>
                <p className="text-sm text-red-600">
                  All access logs for this staff member will be preserved but unlinked.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => handleAction('delete')} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={actionDialog === 'details'} onOpenChange={() => setActionDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Staff Details</DialogTitle>
            <DialogDescription>
              Detailed information for {selectedStaff?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedStaff && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{selectedStaff.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Role</p>
                  <p>{getRoleBadge(selectedStaff.role)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{selectedStaff.email || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{selectedStaff.phone_number || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Dealer</p>
                  <p className="font-medium">{selectedStaff.dealer?.company_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p>{getStatusBadge(selectedStaff)}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Permissions</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={selectedStaff.can_view_costs ? 'default' : 'outline'}>
                    {selectedStaff.can_view_costs ? 'Can' : 'Cannot'} View Costs
                  </Badge>
                  <Badge variant={selectedStaff.can_view_margins ? 'default' : 'outline'}>
                    {selectedStaff.can_view_margins ? 'Can' : 'Cannot'} View Margins
                  </Badge>
                  <Badge variant={selectedStaff.can_view_all_leads ? 'default' : 'outline'}>
                    {selectedStaff.can_view_all_leads ? 'Can' : 'Cannot'} View All Leads
                  </Badge>
                  <Badge variant={selectedStaff.can_modify_inventory ? 'default' : 'outline'}>
                    {selectedStaff.can_modify_inventory ? 'Can' : 'Cannot'} Modify Inventory
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <p className="text-2xl font-bold">{selectedStaff.access_count}</p>
                  <p className="text-xs text-muted-foreground">Total Accesses</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <p className="text-2xl font-bold">{selectedStaff.failed_attempts}</p>
                  <p className="text-xs text-muted-foreground">Failed Attempts</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <p className="text-2xl font-bold">
                    {selectedStaff.last_access_at
                      ? new Date(selectedStaff.last_access_at).toLocaleDateString()
                      : '-'}
                  </p>
                  <p className="text-xs text-muted-foreground">Last Access</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
