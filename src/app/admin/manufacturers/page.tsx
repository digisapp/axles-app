'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  ArrowLeft,
  Plus,
  Search,
  Factory,
  Loader2,
  Pencil,
  Trash2,
  Star,
  Globe,
  Package,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
} from 'lucide-react';
import { Manufacturer } from '@/types';

const EQUIPMENT_TYPE_OPTIONS = [
  { value: 'trucks', label: 'Trucks' },
  { value: 'trailers', label: 'Trailers' },
  { value: 'heavy-equipment', label: 'Heavy Equipment' },
];

const FEATURE_TIER_OPTIONS = [
  { value: 'free', label: 'Free' },
  { value: 'featured', label: 'Featured' },
  { value: 'premium', label: 'Premium' },
];

const emptyManufacturer = {
  name: '',
  slug: '',
  logo_url: '',
  description: '',
  short_description: '',
  website: '',
  country: 'USA',
  headquarters: '',
  founded_year: undefined as number | undefined,
  equipment_types: [] as string[],
  canonical_name: '',
  name_variations: [] as string[],
  is_featured: false,
  feature_tier: 'free' as 'free' | 'featured' | 'premium',
};

export default function AdminManufacturersPage() {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [counts, setCounts] = useState({ total: 0, active: 0, featured: 0 });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyManufacturer);
  const [nameVariationsInput, setNameVariationsInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    fetchManufacturers();
  }, [statusFilter, searchQuery]);

  const fetchManufacturers = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('status', statusFilter);
      if (searchQuery) params.set('search', searchQuery);

      const response = await fetch(`/api/admin/manufacturers?${params}`);
      if (response.ok) {
        const data = await response.json();
        setManufacturers(data.data || []);
        setCounts(data.counts || { total: 0, active: 0, featured: 0 });
      }
    } catch (error) {
      console.error('Error fetching manufacturers:', error);
    }
    setIsLoading(false);
  };

  const openAddDialog = () => {
    setFormData(emptyManufacturer);
    setNameVariationsInput('');
    setIsEditing(false);
    setEditingId(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (manufacturer: Manufacturer) => {
    setFormData({
      name: manufacturer.name,
      slug: manufacturer.slug,
      logo_url: manufacturer.logo_url || '',
      description: manufacturer.description || '',
      short_description: manufacturer.short_description || '',
      website: manufacturer.website || '',
      country: manufacturer.country,
      headquarters: manufacturer.headquarters || '',
      founded_year: manufacturer.founded_year,
      equipment_types: manufacturer.equipment_types,
      canonical_name: manufacturer.canonical_name,
      name_variations: manufacturer.name_variations,
      is_featured: manufacturer.is_featured,
      feature_tier: manufacturer.feature_tier,
    });
    setNameVariationsInput(manufacturer.name_variations.join(', '));
    setIsEditing(true);
    setEditingId(manufacturer.id);
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.canonical_name) {
      alert('Name and canonical name are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        name_variations: nameVariationsInput
          .split(',')
          .map(v => v.trim().toLowerCase())
          .filter(Boolean),
      };

      const url = isEditing
        ? `/api/admin/manufacturers/${editingId}`
        : '/api/admin/manufacturers';

      const response = await fetch(url, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setIsDialogOpen(false);
        fetchManufacturers();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to save manufacturer');
      }
    } catch (error) {
      console.error('Error saving manufacturer:', error);
    }
    setIsSubmitting(false);
  };

  const toggleActive = async (manufacturer: Manufacturer) => {
    try {
      const response = await fetch(`/api/admin/manufacturers/${manufacturer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !manufacturer.is_active }),
      });

      if (response.ok) {
        fetchManufacturers();
      }
    } catch (error) {
      console.error('Error toggling manufacturer:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/manufacturers/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setDeleteConfirmId(null);
        fetchManufacturers();
      }
    } catch (error) {
      console.error('Error deleting manufacturer:', error);
    }
  };

  const toggleEquipmentType = (type: string) => {
    setFormData(prev => ({
      ...prev,
      equipment_types: prev.equipment_types.includes(type)
        ? prev.equipment_types.filter(t => t !== type)
        : [...prev.equipment_types, type],
    }));
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Manufacturer Directory</h1>
                <p className="text-sm text-muted-foreground">
                  Manage equipment manufacturers
                </p>
              </div>
            </div>
            <Button onClick={openAddDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add Manufacturer
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card
            className={`cursor-pointer transition-colors ${
              statusFilter === 'all' ? 'border-primary' : ''
            }`}
            onClick={() => setStatusFilter('all')}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Factory className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{counts.total}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-colors ${
              statusFilter === 'active' ? 'border-primary' : ''
            }`}
            onClick={() => setStatusFilter('active')}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <Package className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{counts.active}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-colors ${
              statusFilter === 'featured' ? 'border-primary' : ''
            }`}
            onClick={() => {
              setStatusFilter('active');
              // Could add featured filter
            }}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Star className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{counts.featured}</p>
                <p className="text-sm text-muted-foreground">Featured</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search manufacturers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Manufacturers List */}
        <Card>
          <CardHeader>
            <CardTitle>Manufacturers</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : manufacturers.length === 0 ? (
              <div className="text-center py-12">
                <Factory className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No manufacturers found</p>
                <Button className="mt-4" onClick={openAddDialog}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Manufacturer
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {manufacturers.map((manufacturer) => (
                  <div
                    key={manufacturer.id}
                    className={`flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors ${
                      !manufacturer.is_active ? 'opacity-60' : ''
                    } ${manufacturer.is_featured ? 'border-amber-300 bg-amber-50/30' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                        {manufacturer.logo_url ? (
                          <Image
                            src={manufacturer.logo_url}
                            alt={manufacturer.name}
                            width={48}
                            height={48}
                            className="object-contain"
                            unoptimized
                          />
                        ) : (
                          <Factory className="w-6 h-6 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{manufacturer.name}</h3>
                          {manufacturer.is_featured && (
                            <Badge className="bg-amber-500">
                              <Star className="w-3 h-3 mr-1" />
                              {manufacturer.feature_tier}
                            </Badge>
                          )}
                          {!manufacturer.is_active && (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span>{manufacturer.canonical_name}</span>
                          <span>•</span>
                          <span>{manufacturer.equipment_types.join(', ')}</span>
                          <span>•</span>
                          <span>{manufacturer.listing_count} listings</span>
                          {manufacturer.website && (
                            <>
                              <span>•</span>
                              <a
                                href={manufacturer.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-blue-600 hover:underline"
                              >
                                <Globe className="w-3 h-3" />
                                Website
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link href={`/manufacturers/${manufacturer.slug}`} target="_blank">
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive(manufacturer)}
                      >
                        {manufacturer.is_active ? (
                          <ToggleRight className="w-5 h-5 text-green-600" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(manufacturer)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setDeleteConfirmId(manufacturer.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Edit Manufacturer' : 'Add Manufacturer'}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Update manufacturer information'
                : 'Add a new manufacturer to the directory'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Name *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Peterbilt"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Canonical Name *</label>
                <Input
                  value={formData.canonical_name}
                  onChange={(e) => setFormData({ ...formData, canonical_name: e.target.value })}
                  placeholder="Exact match for listings.make"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Must match the make field in listings exactly
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Slug</label>
                <Input
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="Auto-generated from name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Logo URL</label>
                <Input
                  value={formData.logo_url}
                  onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Short Description</label>
              <Input
                value={formData.short_description}
                onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                placeholder="Brief description for cards"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Full Description</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed description..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Website</label>
                <Input
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="text-sm font-medium">Headquarters</label>
                <Input
                  value={formData.headquarters}
                  onChange={(e) => setFormData({ ...formData, headquarters: e.target.value })}
                  placeholder="City, State"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Founded Year</label>
                <Input
                  type="number"
                  value={formData.founded_year || ''}
                  onChange={(e) => setFormData({ ...formData, founded_year: parseInt(e.target.value) || undefined })}
                  placeholder="1950"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Equipment Types</label>
              <div className="flex gap-2 mt-2">
                {EQUIPMENT_TYPE_OPTIONS.map((option) => (
                  <Badge
                    key={option.value}
                    variant={formData.equipment_types.includes(option.value) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleEquipmentType(option.value)}
                  >
                    {option.label}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Name Variations</label>
              <Input
                value={nameVariationsInput}
                onChange={(e) => setNameVariationsInput(e.target.value)}
                placeholder="pete, peterbuilt (comma-separated)"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Alternative spellings for search matching
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Feature Tier</label>
                <Select
                  value={formData.feature_tier}
                  onValueChange={(value: 'free' | 'featured' | 'premium') =>
                    setFormData({ ...formData, feature_tier: value, is_featured: value !== 'free' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FEATURE_TIER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Country</label>
                <Input
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="USA"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Add Manufacturer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Manufacturer?</DialogTitle>
            <DialogDescription>
              This will hide the manufacturer from the public directory. You can reactivate it later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
