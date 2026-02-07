// AxlonAI Type Definitions

export interface User {
  id: string;
  email: string;
  company_name?: string;
  phone?: string;
  location?: string;
  avatar_url?: string;
  is_dealer: boolean;
  stripe_customer_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id?: string;
  icon?: string;
  sort_order: number;
  children?: Category[];
}

export interface ListingSpecs {
  engine?: string;
  horsepower?: number;
  transmission?: string;
  sleeper_size?: string;
  fuel_type?: string;
  axle_config?: string;
  suspension?: string;
  brakes?: string;
  tires?: string;
  gvwr?: number;
  payload_capacity?: number;
  [key: string]: string | number | boolean | undefined;
}

export interface Listing {
  id: string;
  user_id: string;
  category_id: string;

  // Basic Info
  title: string;
  description?: string;
  price?: number;
  price_type: 'fixed' | 'negotiable' | 'auction' | 'call';
  condition?: 'new' | 'used' | 'certified' | 'salvage';

  // Equipment Details
  year?: number;
  make?: string;
  model?: string;
  vin?: string;
  mileage?: number;
  hours?: number;

  // Specifications
  specs: ListingSpecs;

  // Location
  city?: string;
  state?: string;
  zip_code?: string;
  country: string;
  latitude?: number;
  longitude?: number;

  // AI-Generated Fields
  ai_price_estimate?: number;
  ai_price_confidence?: number;
  ai_description?: string;
  ai_tags?: string[];

  // Status
  status: 'draft' | 'active' | 'sold' | 'expired';
  is_featured: boolean;
  featured_until?: string;
  views_count: number;

  // Timestamps
  created_at: string;
  updated_at: string;
  published_at?: string;

  // Relations (populated via joins)
  images?: ListingImage[];
  category?: Category;
  user?: User;
}

export interface ListingImage {
  id: string;
  listing_id: string;
  url: string;
  thumbnail_url?: string;
  sort_order: number;
  is_primary: boolean;
  ai_analysis?: {
    detected_type?: string;
    damage_detected?: boolean;
    quality_score?: number;
    tags?: string[];
  };
  created_at: string;
}

export interface SavedSearch {
  id: string;
  user_id: string;
  name?: string;
  query: string;
  filters: SearchFilters;
  notify_email: boolean;
  created_at: string;
}

export interface SearchFilters {
  category_id?: string;
  category_slug?: string;
  min_price?: number;
  max_price?: number;
  min_year?: number;
  max_year?: number;
  make?: string;
  model?: string;
  condition?: string[];
  state?: string;
  city?: string;
  max_mileage?: number;
  is_featured?: boolean;
}

export interface AISearchResult {
  query: string;
  interpretation: string;
  filters: SearchFilters;
  suggested_categories?: string[];
  confidence: number;
}

export interface AIPriceEstimate {
  estimated_price: number;
  confidence: number;
  price_range: {
    low: number;
    high: number;
  };
  comparable_listings?: number;
  market_trend?: 'rising' | 'stable' | 'declining';
  factors?: string[];
}

export interface AIImageAnalysis {
  detected_type?: string;
  detected_make?: string;
  detected_model?: string;
  damage_detected: boolean;
  damage_areas?: string[];
  quality_score: number;
  suggested_tags: string[];
  is_valid_equipment_photo: boolean;
}

// Manufacturer Directory
export interface Manufacturer {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  description?: string;
  short_description?: string;
  website?: string;
  country: string;
  headquarters?: string;
  founded_year?: number;
  equipment_types: string[];
  canonical_name: string;
  name_variations: string[];
  is_featured: boolean;
  feature_tier: 'free' | 'featured' | 'premium';
  feature_expires_at?: string;
  listing_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Dealer Voice Agent (Multi-tenant AI Phone System)
export interface DealerVoiceAgent {
  id: string;
  dealer_id: string;
  phone_number?: string;
  phone_number_id?: string;
  agent_name: string;
  voice: string;
  greeting: string;
  instructions?: string;
  business_name?: string;
  business_description?: string;
  business_hours?: {
    timezone: string;
    hours: Record<string, string>;
  };
  after_hours_message?: string;
  can_search_inventory: boolean;
  can_capture_leads: boolean;
  can_transfer_calls: boolean;
  transfer_phone_number?: string;
  plan_tier: 'starter' | 'pro' | 'unlimited' | 'trial';
  minutes_included: number;
  minutes_used: number;
  billing_cycle_start: string;
  stripe_subscription_id?: string;
  is_active: boolean;
  is_provisioned: boolean;
  created_at: string;
  updated_at: string;
  activated_at?: string;
}

// API Response Types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}
