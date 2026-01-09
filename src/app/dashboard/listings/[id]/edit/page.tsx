'use client';

import { useState, useEffect, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  Loader2,
  DollarSign,
  TrendingUp,
  Sparkles,
  Trash2,
  Eye,
  CheckCircle,
  Wand2,
  Video,
  Copy,
  CalendarClock,
} from 'lucide-react';
import { ImageUpload } from '@/components/listings/ImageUpload';
import type { Category, AIPriceEstimate } from '@/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface UploadedImage {
  id?: string;
  url: string;
  thumbnail_url?: string;
  is_primary: boolean;
  sort_order: number;
  file?: File;
  uploading?: boolean;
}

export default function EditListingPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [priceEstimate, setPriceEstimate] = useState<AIPriceEstimate | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    category_id: '',
    price: '',
    price_type: 'fixed',
    condition: '',
    year: '',
    make: '',
    model: '',
    vin: '',
    mileage: '',
    hours: '',
    description: '',
    city: '',
    state: '',
    zip_code: '',
    video_url: '',
    status: 'draft',
    specs: {} as Record<string, string>,
    publish_at: '',
    unpublish_at: '',
  });

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    }
  }, [searchParams]);

  useEffect(() => {
    const checkDealerStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?redirect=/dashboard/listings/' + id + '/edit');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_dealer')
        .eq('id', user.id)
        .single();

      if (!profile?.is_dealer) {
        router.push('/become-a-dealer');
        return;
      }
    };

    checkDealerStatus();
  }, [supabase, router, id]);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch categories
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order');

      if (categoriesData) {
        const parentCategories = categoriesData.filter((c) => !c.parent_id);
        const tree = parentCategories.map((parent) => ({
          ...parent,
          children: categoriesData.filter((c) => c.parent_id === parent.id),
        }));
        setCategories(tree);
      }

      // Fetch listing
      const { data: listing } = await supabase
        .from('listings')
        .select(`
          *,
          images:listing_images(id, url, thumbnail_url, is_primary, sort_order)
        `)
        .eq('id', id)
        .single();

      if (listing) {
        setFormData({
          title: listing.title || '',
          category_id: listing.category_id || '',
          price: listing.price?.toString() || '',
          price_type: listing.price_type || 'fixed',
          condition: listing.condition || '',
          year: listing.year?.toString() || '',
          make: listing.make || '',
          model: listing.model || '',
          vin: listing.vin || '',
          mileage: listing.mileage?.toString() || '',
          hours: listing.hours?.toString() || '',
          description: listing.description || '',
          city: listing.city || '',
          state: listing.state || '',
          zip_code: listing.zip_code || '',
          video_url: listing.video_url || '',
          status: listing.status || 'draft',
          specs: listing.specs || {},
          publish_at: listing.publish_at ? listing.publish_at.split('T')[0] : '',
          unpublish_at: listing.unpublish_at ? listing.unpublish_at.split('T')[0] : '',
        });

        if (listing.images) {
          setImages(listing.images.sort((a: UploadedImage, b: UploadedImage) => a.sort_order - b.sort_order));
        }

        if (listing.ai_price_estimate) {
          setPriceEstimate({
            estimated_price: listing.ai_price_estimate,
            confidence: listing.ai_price_confidence || 0,
            price_range: { low: 0, high: 0 },
            factors: [],
          });
        }
      }

      setIsLoading(false);
    };

    fetchData();
  }, [id, supabase]);

  // Handle AI detections from image upload
  const handleAIDetection = (data: { make?: string; model?: string; type?: string; tags?: string[] }) => {
    const updates: Partial<typeof formData> = {};

    // Only auto-fill if fields are empty
    if (data.make && !formData.make) {
      updates.make = data.make;
    }
    if (data.model && !formData.model) {
      updates.model = data.model;
    }

    if (Object.keys(updates).length > 0) {
      setFormData({ ...formData, ...updates });
    }
  };

  // Generate AI description from images
  const handleGenerateDescription = async () => {
    if (images.length === 0) {
      alert('Please upload at least one image first');
      return;
    }

    setIsGeneratingDescription(true);

    try {
      const imageUrls = images
        .filter((img) => !img.uploading && img.url)
        .slice(0, 4)
        .map((img) => img.url);

      const response = await fetch('/api/ai/describe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrls,
          specs: {
            year: formData.year,
            make: formData.make,
            model: formData.model,
            mileage: formData.mileage,
            hours: formData.hours,
            condition: formData.condition,
            ...formData.specs,
          },
        }),
      });

      if (response.ok) {
        const { data } = await response.json();
        setFormData({ ...formData, description: data.description });
      } else {
        alert('Failed to generate description');
      }
    } catch (error) {
      console.error('Description generation error:', error);
      alert('Failed to generate description');
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const handleGetPriceEstimate = async () => {
    if (!formData.make || !formData.model) {
      alert('Please enter make and model first');
      return;
    }

    setIsEstimating(true);

    try {
      const response = await fetch('/api/ai/price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: formData.year ? parseInt(formData.year) : undefined,
          make: formData.make,
          model: formData.model,
          mileage: formData.mileage ? parseInt(formData.mileage) : undefined,
          hours: formData.hours ? parseInt(formData.hours) : undefined,
          condition: formData.condition,
          city: formData.city,
          state: formData.state,
          specs: formData.specs,
        }),
      });

      if (response.ok) {
        const { data } = await response.json();
        setPriceEstimate(data);
      }
    } catch (error) {
      console.error('Price estimation error:', error);
    } finally {
      setIsEstimating(false);
    }
  };

  const handleSave = async (status: 'draft' | 'active') => {
    setIsSaving(true);

    try {
      // Update listing
      const response = await fetch(`/api/listings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          status,
          ai_price_estimate: priceEstimate?.estimated_price || null,
          ai_price_confidence: priceEstimate?.confidence || null,
          publish_at: formData.publish_at ? new Date(formData.publish_at).toISOString() : null,
          unpublish_at: formData.unpublish_at ? new Date(formData.unpublish_at).toISOString() : null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update listing');
      }

      // Save images
      const imagesToSave = images.filter((img) => !img.uploading);

      // Add new images (ones without id)
      const newImages = imagesToSave.filter((img) => !img.id);
      if (newImages.length > 0) {
        await fetch(`/api/listings/${id}/images`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ images: newImages }),
        });
      }

      // Update existing images order/primary
      const existingImages = imagesToSave.filter((img) => img.id);
      if (existingImages.length > 0) {
        await fetch(`/api/listings/${id}/images`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ images: existingImages }),
        });
      }

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save listing');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/listings/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push('/dashboard?deleted=true');
      } else {
        throw new Error('Failed to delete');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete listing');
      setIsDeleting(false);
    }
  };

  const handleClone = async () => {
    setIsCloning(true);

    try {
      const response = await fetch(`/api/listings/${id}/clone`, {
        method: 'POST',
      });

      if (response.ok) {
        const { data } = await response.json();
        router.push(`/dashboard/listings/${data.id}/edit?cloned=true`);
      } else {
        throw new Error('Failed to clone');
      }
    } catch (error) {
      console.error('Clone error:', error);
      alert('Failed to clone listing');
      setIsCloning(false);
    }
  };

  const US_STATES = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Success Toast */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg">
          <CheckCircle className="w-5 h-5" />
          <span>Listing saved successfully!</span>
        </div>
      )}

      {/* Header */}
      <header className="bg-background border-b sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </Link>
            <h1 className="text-xl font-bold">Edit Listing</h1>
            <span
              className={`px-2 py-1 text-xs rounded-full ${
                formData.status === 'active'
                  ? 'bg-green-100 text-green-700'
                  : formData.status === 'draft'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {formData.status}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/listing/${id}`} target="_blank">
                <Eye className="w-4 h-4 mr-2" />
                Preview
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClone}
              disabled={isCloning}
            >
              {isCloning ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Copy className="w-4 h-4 mr-2" />
              )}
              Clone
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Listing?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your
                    listing and all associated images.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={isDeleting}
                  >
                    {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Images */}
          <Card>
            <CardHeader>
              <CardTitle>Photos</CardTitle>
              <CardDescription>
                Add up to 20 photos. The primary photo will be shown in search results.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ImageUpload
                listingId={id}
                images={images}
                onChange={setImages}
                onAIDetection={handleAIDetection}
              />
            </CardContent>
          </Card>

          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., 2020 Peterbilt 579 Sleeper Truck"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category_id}
                    onValueChange={(v) => setFormData({ ...formData, category_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((parent) => (
                        <div key={parent.id}>
                          <SelectItem value={parent.id} disabled className="font-semibold">
                            {parent.name}
                          </SelectItem>
                          {parent.children?.map((child) => (
                            <SelectItem key={child.id} value={child.id} className="pl-6">
                              {child.name}
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="condition">Condition</Label>
                  <Select
                    value={formData.condition}
                    onValueChange={(v) => setFormData({ ...formData, condition: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select condition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="used">Used</SelectItem>
                      <SelectItem value="certified">Certified Pre-Owned</SelectItem>
                      <SelectItem value="salvage">Salvage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="description">Description</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateDescription}
                    disabled={isGeneratingDescription || images.length === 0}
                    className="text-xs"
                  >
                    {isGeneratingDescription ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Wand2 className="w-3 h-3 mr-1" />
                    )}
                    AI Generate
                  </Button>
                </div>
                <Textarea
                  id="description"
                  placeholder="Describe your equipment in detail..."
                  rows={5}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
                {images.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Upload photos to enable AI description generation
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Equipment Details */}
          <Card>
            <CardHeader>
              <CardTitle>Equipment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="year">Year</Label>
                  <Input
                    id="year"
                    type="number"
                    placeholder="2020"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="make">Make</Label>
                  <Input
                    id="make"
                    placeholder="Peterbilt"
                    value={formData.make}
                    onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="model">Model</Label>
                  <Input
                    id="model"
                    placeholder="579"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="mileage">Mileage</Label>
                  <Input
                    id="mileage"
                    type="number"
                    placeholder="450000"
                    value={formData.mileage}
                    onChange={(e) => setFormData({ ...formData, mileage: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="hours">Hours</Label>
                  <Input
                    id="hours"
                    type="number"
                    placeholder="5000"
                    value={formData.hours}
                    onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="vin">VIN</Label>
                  <Input
                    id="vin"
                    placeholder="1XPWD40X1ED215307"
                    value={formData.vin}
                    onChange={(e) => setFormData({ ...formData, vin: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Pricing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price">Price (USD)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="price"
                      type="number"
                      placeholder="85000"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="price_type">Price Type</Label>
                  <Select
                    value={formData.price_type}
                    onValueChange={(v) => setFormData({ ...formData, price_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed Price</SelectItem>
                      <SelectItem value="negotiable">Negotiable</SelectItem>
                      <SelectItem value="auction">Auction</SelectItem>
                      <SelectItem value="call">Call for Price</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* AI Price Estimate */}
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Sparkles className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">AI Price Estimation</p>
                      <p className="text-sm text-muted-foreground">
                        Get a smart price suggestion
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGetPriceEstimate}
                    disabled={isEstimating || !formData.make || !formData.model}
                  >
                    {isEstimating ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <TrendingUp className="w-4 h-4 mr-2" />
                    )}
                    Get Estimate
                  </Button>
                </div>

                {priceEstimate && (
                  <div className="mt-4 pt-4 border-t border-primary/20">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Suggested Price</p>
                        <p className="text-2xl font-bold text-primary">
                          ${priceEstimate.estimated_price.toLocaleString()}
                        </p>
                      </div>
                      {priceEstimate.price_range.low > 0 && (
                        <div>
                          <p className="text-sm text-muted-foreground">Range</p>
                          <p className="text-sm">
                            ${priceEstimate.price_range.low.toLocaleString()} -{' '}
                            ${priceEstimate.price_range.high.toLocaleString()}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm text-muted-foreground">Confidence</p>
                        <p className="text-sm">
                          {Math.round(priceEstimate.confidence * 100)}%
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="mt-2 p-0 h-auto"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          price: priceEstimate.estimated_price.toString(),
                        })
                      }
                    >
                      Use this price
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Location */}
          <Card>
            <CardHeader>
              <CardTitle>Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    placeholder="Houston"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Select
                    value={formData.state}
                    onValueChange={(v) => setFormData({ ...formData, state: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="zip_code">ZIP Code</Label>
                  <Input
                    id="zip_code"
                    placeholder="77001"
                    value={formData.zip_code}
                    onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Video Walkaround */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="w-5 h-5" />
                Video Walkaround
              </CardTitle>
              <CardDescription>
                Add a YouTube or Vimeo video URL to showcase your equipment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="video_url">Video URL</Label>
                <Input
                  id="video_url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={formData.video_url}
                  onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Supports YouTube and Vimeo links
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Scheduling */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="w-5 h-5" />
                Scheduling
              </CardTitle>
              <CardDescription>
                Schedule when your listing goes live and expires automatically
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="publish_at">Publish Date</Label>
                  <Input
                    id="publish_at"
                    type="date"
                    value={formData.publish_at}
                    onChange={(e) => setFormData({ ...formData, publish_at: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Schedule listing to go live on this date
                  </p>
                </div>
                <div>
                  <Label htmlFor="unpublish_at">Expiration Date</Label>
                  <Input
                    id="unpublish_at"
                    type="date"
                    value={formData.unpublish_at}
                    onChange={(e) => setFormData({ ...formData, unpublish_at: e.target.value })}
                    min={formData.publish_at || new Date().toISOString().split('T')[0]}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Automatically unpublish after this date
                  </p>
                </div>
              </div>
              {(formData.publish_at || formData.unpublish_at) && (
                <div className="p-3 bg-muted/50 rounded-lg text-sm">
                  {formData.publish_at && (
                    <p>
                      <span className="font-medium">Publishes:</span>{' '}
                      {new Date(formData.publish_at).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  )}
                  {formData.unpublish_at && (
                    <p className="mt-1">
                      <span className="font-medium">Expires:</span>{' '}
                      {new Date(formData.unpublish_at).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  )}
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setFormData({ ...formData, publish_at: '', unpublish_at: '' })}
                className="text-muted-foreground"
              >
                Clear Schedule
              </Button>
            </CardContent>
          </Card>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-3 p-4 bg-background border rounded-xl sticky bottom-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSave('draft')}
              disabled={isSaving || !formData.title}
            >
              Save as Draft
            </Button>
            <Button
              type="button"
              onClick={() => handleSave('active')}
              disabled={isSaving || !formData.title}
            >
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {formData.status === 'active' ? 'Save Changes' : 'Publish Listing'}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
