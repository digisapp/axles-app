'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  Plus,
  Phone,
  Mail,
  Shield,
  Key,
  Trash2,
  Edit,
  Loader2,
  CheckCircle,
  Eye,
  EyeOff,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface StaffMember {
  id: string;
  name: string;
  role: string;
  phone_number: string | null;
  email: string | null;
  voice_pin: string;
  access_level: string;
  can_view_costs: boolean;
  can_view_margins: boolean;
  can_view_all_leads: boolean;
  can_modify_inventory: boolean;
  is_active: boolean;
  last_access_at: string | null;
  access_count: number;
  created_at: string;
}

export default function StaffManagementPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [showPin, setShowPin] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    role: 'sales',
    phone_number: '',
    email: '',
    voice_pin: '',
    access_level: 'standard',
    can_view_costs: false,
    can_view_margins: false,
    can_view_all_leads: true,
    can_modify_inventory: false,
  });

  useEffect(() => {
    fetchStaff();
  }, []);

  async function fetchStaff() {
    try {
      const res = await fetch('/api/dealer/staff');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setStaff(data.data || []);
    } catch (error) {
      logger.error('Error fetching staff', { error });
      toast.error('Failed to load staff members');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormData({
      name: '',
      role: 'sales',
      phone_number: '',
      email: '',
      voice_pin: '',
      access_level: 'standard',
      can_view_costs: false,
      can_view_margins: false,
      can_view_all_leads: true,
      can_modify_inventory: false,
    });
  }

  function generatePin() {
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    setFormData({ ...formData, voice_pin: pin });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const url = editingStaff
        ? `/api/dealer/staff/${editingStaff.id}`
        : '/api/dealer/staff';
      const method = editingStaff ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      toast.success(editingStaff ? 'Staff member updated' : 'Staff member added');
      setIsAddDialogOpen(false);
      setEditingStaff(null);
      resetForm();
      fetchStaff();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save staff member');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(staffId: string) {
    if (!confirm('Are you sure you want to remove this staff member?')) return;

    try {
      const res = await fetch(`/api/dealer/staff/${staffId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Staff member removed');
      fetchStaff();
    } catch (error) {
      toast.error('Failed to remove staff member');
    }
  }

  async function toggleActive(staffMember: StaffMember) {
    try {
      const res = await fetch(`/api/dealer/staff/${staffMember.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !staffMember.is_active }),
      });
      if (!res.ok) throw new Error('Failed to update');
      fetchStaff();
    } catch (error) {
      toast.error('Failed to update staff member');
    }
  }

  function openEditDialog(staffMember: StaffMember) {
    setEditingStaff(staffMember);
    setFormData({
      name: staffMember.name,
      role: staffMember.role,
      phone_number: staffMember.phone_number || '',
      email: staffMember.email || '',
      voice_pin: '', // Don't show existing PIN
      access_level: staffMember.access_level,
      can_view_costs: staffMember.can_view_costs,
      can_view_margins: staffMember.can_view_margins,
      can_view_all_leads: staffMember.can_view_all_leads,
      can_modify_inventory: staffMember.can_modify_inventory,
    });
    setIsAddDialogOpen(true);
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'manager': return 'bg-purple-100 text-purple-700';
      case 'admin': return 'bg-red-100 text-red-700';
      case 'service': return 'bg-blue-100 text-blue-700';
      default: return 'bg-green-100 text-green-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6" />
            Staff Voice Access
          </h1>
          <p className="text-muted-foreground">
            Manage voice PIN access for your team to query AI internally
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) {
            setEditingStaff(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Staff Member
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}
              </DialogTitle>
              <DialogDescription>
                {editingStaff
                  ? 'Update staff member details and permissions'
                  : 'Add a team member who can access internal data via voice PIN'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="John Smith"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales">Sales</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="service">Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="voice_pin">Voice PIN *</Label>
                <div className="flex gap-2">
                  <Input
                    id="voice_pin"
                    value={formData.voice_pin}
                    onChange={(e) => setFormData({ ...formData, voice_pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                    placeholder={editingStaff ? 'Leave blank to keep current' : '4-6 digit PIN'}
                    maxLength={6}
                    required={!editingStaff}
                  />
                  <Button type="button" variant="outline" onClick={generatePin}>
                    Generate
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Staff will say this PIN to authenticate when calling
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone (optional)</Label>
                  <Input
                    id="phone"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email (optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john@company.com"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t">
                <Label className="text-sm font-medium">Permissions</Label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="costs" className="text-sm font-normal">View acquisition costs</Label>
                    <Switch
                      id="costs"
                      checked={formData.can_view_costs}
                      onCheckedChange={(checked) => setFormData({ ...formData, can_view_costs: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="margins" className="text-sm font-normal">View profit margins</Label>
                    <Switch
                      id="margins"
                      checked={formData.can_view_margins}
                      onCheckedChange={(checked) => setFormData({ ...formData, can_view_margins: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="leads" className="text-sm font-normal">View all leads</Label>
                    <Switch
                      id="leads"
                      checked={formData.can_view_all_leads}
                      onCheckedChange={(checked) => setFormData({ ...formData, can_view_all_leads: checked })}
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingStaff ? 'Update' : 'Add Staff Member'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* How it works */}
      <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <Phone className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-800 dark:text-blue-200 mb-1">
                How Voice PIN Access Works
              </p>
              <ol className="list-decimal list-inside space-y-1 text-blue-700 dark:text-blue-300">
                <li>Staff calls your AI phone number</li>
                <li>Says "Internal access" to trigger authentication</li>
                <li>AI asks: "Please say your name and access code"</li>
                <li>Staff says: "John, 4521"</li>
                <li>AI verifies and unlocks internal database access</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Staff List */}
      {staff.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No staff members yet</h3>
            <p className="text-muted-foreground mb-4">
              Add team members to give them voice access to internal data
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Staff Member
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {staff.map((member) => (
            <Card key={member.id} className={!member.is_active ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="font-semibold text-primary">
                        {member.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{member.name}</h3>
                        <Badge className={getRoleBadgeColor(member.role)}>
                          {member.role}
                        </Badge>
                        {!member.is_active && (
                          <Badge variant="outline" className="text-muted-foreground">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Key className="w-3 h-3" />
                          PIN: {showPin === member.id ? member.voice_pin : '••••'}
                          <button
                            onClick={() => setShowPin(showPin === member.id ? null : member.id)}
                            className="hover:text-foreground"
                          >
                            {showPin === member.id ? (
                              <EyeOff className="w-3 h-3" />
                            ) : (
                              <Eye className="w-3 h-3" />
                            )}
                          </button>
                        </span>
                        {member.phone_number && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {member.phone_number}
                          </span>
                        )}
                        {member.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {member.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {member.last_access_at
                          ? `Last access: ${new Date(member.last_access_at).toLocaleDateString()}`
                          : 'Never accessed'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {member.access_count} total accesses
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={member.is_active}
                        onCheckedChange={() => toggleActive(member)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(member)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(member.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Permissions */}
                <div className="flex gap-2 mt-3 pt-3 border-t">
                  {member.can_view_costs && (
                    <Badge variant="secondary" className="text-xs">
                      <Shield className="w-3 h-3 mr-1" />
                      View Costs
                    </Badge>
                  )}
                  {member.can_view_margins && (
                    <Badge variant="secondary" className="text-xs">
                      <Shield className="w-3 h-3 mr-1" />
                      View Margins
                    </Badge>
                  )}
                  {member.can_view_all_leads && (
                    <Badge variant="secondary" className="text-xs">
                      <Shield className="w-3 h-3 mr-1" />
                      All Leads
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
