'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  ArrowLeft,
  Upload,
  X,
  Sparkles,
  Loader2,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Video,
  Tag,
  CalendarDays,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { VINDecoder } from '@/components/listings/VINDecoder';
import { VideoUpload } from '@/components/listings/VideoUpload';
import type { Category, AIPriceEstimate } from '@/types';

export default function NewListingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [industries, setIndustries] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [priceEstimate, setPriceEstimate] = useState<AIPriceEstimate | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);

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
    listing_type: 'sale',
    rental_rate_daily: '',
    rental_rate_weekly: '',
    rental_rate_monthly: '',
    selected_industries: [] as string[],
    specs: {} as Record<string, string>,
  });

  useEffect(() => {
    const fetchCategories = async () => {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order');

      if (data) {
        // Build category tree
        const parentCategories = data.filter((c) => !c.parent_id);
        const tree = parentCategories.map((parent) => ({
          ...parent,
          children: data.filter((c) => c.parent_id === parent.id),
        }));
        setCategories(tree);
      }
    };

    const fetchIndustries = async () => {
      try {
        const response = await fetch('/api/industries');
        if (response.ok) {
          const { data } = await response.json();
          setIndustries(data || []);
        }
      } catch (error) {
        console.error('Error fetching industries:', error);
      }
    };

    fetchCategories();
    fetchIndustries();
  }, [supabase]);

  const handleVINDecode = (data: Record<string, unknown>) => {
    // Auto-fill form fields from VIN decode
    const updates: Partial<typeof formData> = {};

    if (data.year && typeof data.year === 'number') {
      updates.year = data.year.toString();
    }
    if (data.make && typeof data.make === 'string') {
      updates.make = data.make;
    }
    if (data.model && typeof data.model === 'string') {
      updates.model = data.model;
    }
    if (data.vin && typeof data.vin === 'string') {
      updates.vin = data.vin;
    }

    // Add additional specs from VIN
    const newSpecs: Record<string, string> = { ...formData.specs };
    if (data.trim && typeof data.trim === 'string') newSpecs.trim = data.trim;
    if (data.bodyClass && typeof data.bodyClass === 'string') newSpecs.bodyClass = data.bodyClass;
    if (data.fuelType && typeof data.fuelType === 'string') newSpecs.fuelType = data.fuelType;
    if (data.engineHP && typeof data.engineHP === 'string') newSpecs.engineHP = data.engineHP;
    if (data.engineCylinders && typeof data.engineCylinders === 'string') newSpecs.engineCylinders = data.engineCylinders;
    if (data.transmissionStyle && typeof data.transmissionStyle === 'string') newSpecs.transmission = data.transmissionStyle;
    if (data.driveType && typeof data.driveType === 'string') newSpecs.driveType = data.driveType;
    if (data.gvwr && typeof data.gvwr === 'string') newSpecs.gvwr = data.gvwr;

    updates.specs = newSpecs;

    setFormData({ ...formData, ...updates });
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

  const handleSubmit = async (e: React.FormEvent, status: 'draft' | 'active') => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login?redirect=/dashboard/listings/new');
        return;
      }

      const listingData = {
        title: formData.title,
        category_id: formData.category_id || null,
        price: formData.price ? parseFloat(formData.price) : null,
        price_type: formData.price_type,
        condition: formData.condition || null,
        year: formData.year ? parseInt(formData.year) : null,
        make: formData.make || null,
        model: formData.model || null,
        vin: formData.vin || null,
        mileage: formData.mileage ? parseInt(formData.mileage) : null,
        hours: formData.hours ? parseInt(formData.hours) : null,
        description: formData.description || null,
        city: formData.city || null,
        state: formData.state || null,
        zip_code: formData.zip_code || null,
        video_url: formData.video_url || null,
        listing_type: formData.listing_type,
        rental_rate_daily: formData.rental_rate_daily ? parseFloat(formData.rental_rate_daily) : null,
        rental_rate_weekly: formData.rental_rate_weekly ? parseFloat(formData.rental_rate_weekly) : null,
        rental_rate_monthly: formData.rental_rate_monthly ? parseFloat(formData.rental_rate_monthly) : null,
        specs: Object.keys(formData.specs).length > 0 ? formData.specs : {},
        status,
        ai_price_estimate: priceEstimate?.estimated_price || null,
        ai_price_confidence: priceEstimate?.confidence || null,
        published_at: status === 'active' ? new Date().toISOString() : null,
        industries: formData.selected_industries,
      };

      const response = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(listingData),
      });

      if (response.ok) {
        const { data } = await response.json();
        router.push(`/dashboard/listings/${data.id}/edit?success=true`);
      } else {
        alert('Failed to create listing');
      }
    } catch (error) {
      console.error('Create listing error:', error);
      alert('Failed to create listing');
    } finally {
      setIsLoading(false);
    }
  };

  const US_STATES = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <h1 className="text-xl font-bold">Create New Listing</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <form onSubmit={(e) => handleSubmit(e, 'active')}>
          <div className="space-y-6">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>
                  Enter the main details about your equipment
                </CardDescription>
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
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe your equipment in detail..."
                    rows={5}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* VIN Decoder */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  VIN Decoder
                </CardTitle>
                <CardDescription>
                  Enter a VIN to auto-fill vehicle details from the NHTSA database
                </CardDescription>
              </CardHeader>
              <CardContent>
                <VINDecoder onDecode={handleVINDecode} defaultValue={formData.vin} />
              </CardContent>
            </Card>

            {/* Equipment Details */}
            <Card>
              <CardHeader>
                <CardTitle>Equipment Details</CardTitle>
                <CardDescription>
                  {formData.make || formData.model ? (
                    <span className="text-green-600 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Some fields auto-filled from VIN
                    </span>
                  ) : (
                    'Enter details manually or use VIN decoder above'
                  )}
                </CardDescription>
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

                <div className="grid md:grid-cols-2 gap-4">
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
                    <Label htmlFor="hours">Hours (for equipment)</Label>
                    <Input
                      id="hours"
                      type="number"
                      placeholder="5000"
                      value={formData.hours}
                      onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                    />
                  </div>
                </div>

                {/* Display additional specs from VIN if present */}
                {Object.keys(formData.specs).length > 0 && (
                  <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Additional Specs (from VIN)</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                      {formData.specs.trim && (
                        <div><span className="text-muted-foreground">Trim:</span> {formData.specs.trim}</div>
                      )}
                      {formData.specs.bodyClass && (
                        <div><span className="text-muted-foreground">Body:</span> {formData.specs.bodyClass}</div>
                      )}
                      {formData.specs.engineHP && (
                        <div><span className="text-muted-foreground">Engine:</span> {formData.specs.engineHP} HP</div>
                      )}
                      {formData.specs.transmission && (
                        <div><span className="text-muted-foreground">Trans:</span> {formData.specs.transmission}</div>
                      )}
                      {formData.specs.fuelType && (
                        <div><span className="text-muted-foreground">Fuel:</span> {formData.specs.fuelType}</div>
                      )}
                      {formData.specs.driveType && (
                        <div><span className="text-muted-foreground">Drive:</span> {formData.specs.driveType}</div>
                      )}
                    </div>
                  </div>
                )}
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
                          Get a smart price suggestion based on market data
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
                        <div>
                          <p className="text-sm text-muted-foreground">Range</p>
                          <p className="text-sm">
                            ${priceEstimate.price_range.low.toLocaleString()} -{' '}
                            ${priceEstimate.price_range.high.toLocaleString()}
                          </p>
                        </div>
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
                        onClick={() => setFormData({
                          ...formData,
                          price: priceEstimate.estimated_price.toString()
                        })}
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
                  Add a video walk-around to help buyers see your equipment in action
                </CardDescription>
              </CardHeader>
              <CardContent>
                <VideoUpload
                  value={formData.video_url}
                  onChange={(url) => setFormData({ ...formData, video_url: url })}
                />
              </CardContent>
            </Card>

            {/* Listing Type & Rental */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5" />
                  Listing Type
                </CardTitle>
                <CardDescription>
                  Choose whether this equipment is for sale, rent, or both
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="listing_type">Availability</Label>
                  <Select
                    value={formData.listing_type}
                    onValueChange={(v) => setFormData({ ...formData, listing_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sale">For Sale Only</SelectItem>
                      <SelectItem value="rent">For Rent Only</SelectItem>
                      <SelectItem value="sale_or_rent">For Sale or Rent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(formData.listing_type === 'rent' || formData.listing_type === 'sale_or_rent') && (
                  <div className="grid md:grid-cols-3 gap-4 pt-4 border-t">
                    <div>
                      <Label htmlFor="rental_daily">Daily Rate</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="rental_daily"
                          type="number"
                          placeholder="250"
                          value={formData.rental_rate_daily}
                          onChange={(e) => setFormData({ ...formData, rental_rate_daily: e.target.value })}
                          className="pl-9"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="rental_weekly">Weekly Rate</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="rental_weekly"
                          type="number"
                          placeholder="1500"
                          value={formData.rental_rate_weekly}
                          onChange={(e) => setFormData({ ...formData, rental_rate_weekly: e.target.value })}
                          className="pl-9"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="rental_monthly">Monthly Rate</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="rental_monthly"
                          type="number"
                          placeholder="5000"
                          value={formData.rental_rate_monthly}
                          onChange={(e) => setFormData({ ...formData, rental_rate_monthly: e.target.value })}
                          className="pl-9"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Industry Tags */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="w-5 h-5" />
                  Industry Tags
                </CardTitle>
                <CardDescription>
                  Select industries this equipment is suited for (helps buyers find your listing)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {industries.map((industry) => (
                    <label
                      key={industry.id}
                      className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        checked={formData.selected_industries.includes(industry.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData({
                              ...formData,
                              selected_industries: [...formData.selected_industries, industry.id],
                            });
                          } else {
                            setFormData({
                              ...formData,
                              selected_industries: formData.selected_industries.filter((id) => id !== industry.id),
                            });
                          }
                        }}
                      />
                      <span className="text-sm">{industry.name}</span>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Submit Buttons */}
            <div className="flex items-center justify-between p-4 bg-background border rounded-xl">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                You can add photos after saving the listing
              </p>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={(e) => handleSubmit(e, 'draft')}
                  disabled={isLoading || !formData.title}
                >
                  Save as Draft
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || !formData.title}
                >
                  {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Publish Listing
                </Button>
              </div>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
