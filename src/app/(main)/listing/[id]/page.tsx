export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  MapPin,
  Calendar,
  Gauge,
  Phone,
  Share2,
  Shield,
  TrendingUp,
  Check,
  AlertCircle,
  Building2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { FavoriteButton } from '@/components/listings/FavoriteButton';
import { ContactSeller } from '@/components/listings/ContactSeller';
import { ShareButton } from '@/components/listings/ShareButton';
import { ImageGallery } from '@/components/listings/ImageGallery';
import { TrackViewClient } from '@/components/listings/TrackViewClient';
import { RecentlyViewed } from '@/components/listings/RecentlyViewed';
import { CompareButton } from '@/components/listings/CompareButton';
import { FinancingCalculator } from '@/components/listings/FinancingCalculator';
import { VideoPlayer } from '@/components/listings/VideoPlayer';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ListingPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: listing, error } = await supabase
    .from('listings')
    .select(`
      *,
      category:categories!left(id, name, slug),
      images:listing_images!left(id, url, thumbnail_url, is_primary, sort_order, ai_analysis),
      user:profiles!listings_user_id_fkey(id, company_name, phone, email, avatar_url, is_dealer, created_at)
    `)
    .eq('id', id)
    .single();

  if (error || !listing) {
    notFound();
  }

  // Increment view count
  await supabase
    .from('listings')
    .update({ views_count: (listing.views_count || 0) + 1 })
    .eq('id', id);

  // Get similar listings
  const { data: similarListings } = await supabase
    .from('listings')
    .select(`
      id, title, price, year, make, model, city, state,
      images:listing_images!left(url, is_primary)
    `)
    .eq('status', 'active')
    .neq('id', id)
    .or(`make.eq.${listing.make},category_id.eq.${listing.category_id}`)
    .limit(4);

  // Sort images by sort_order, primary first
  const sortedImages = [...(listing.images || [])]
    .sort((a: { is_primary: boolean; sort_order: number }, b: { is_primary: boolean; sort_order: number }) => {
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      return (a.sort_order || 0) - (b.sort_order || 0);
    });

  // Prepare data for tracking
  const primaryImage = sortedImages[0];
  const trackingData = {
    id: listing.id,
    title: listing.title,
    price: listing.price,
    year: listing.year,
    make: listing.make,
    model: listing.model,
    city: listing.city,
    state: listing.state,
    imageUrl: primaryImage?.url || null,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Track view client-side */}
      <TrackViewClient listing={trackingData} />

      <div className="max-w-7xl mx-auto px-4 py-4 md:py-6">
        {/* Back link - Mobile */}
        <div className="flex items-center justify-between mb-4 md:hidden">
          <Link
            href="/search"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </Link>
          <div className="flex items-center gap-2">
            <CompareButton
              listing={{
                id: listing.id,
                title: listing.title,
                price: listing.price,
                year: listing.year,
                make: listing.make,
                model: listing.model,
                mileage: listing.mileage,
                hours: listing.hours,
                condition: listing.condition,
                image_url: sortedImages[0]?.thumbnail_url || sortedImages[0]?.url,
              }}
              variant="icon"
            />
            <FavoriteButton listingId={id} size="sm" />
            <ShareButton title={listing.title} size="sm" />
          </div>
        </div>

        {/* Back link - Desktop */}
        <div className="hidden md:flex items-center justify-between mb-6">
          <Link
            href="/search"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Search
          </Link>
          <div className="flex items-center gap-2">
            <CompareButton
              listing={{
                id: listing.id,
                title: listing.title,
                price: listing.price,
                year: listing.year,
                make: listing.make,
                model: listing.model,
                mileage: listing.mileage,
                hours: listing.hours,
                condition: listing.condition,
                image_url: sortedImages[0]?.thumbnail_url || sortedImages[0]?.url,
              }}
              variant="icon"
            />
            <FavoriteButton listingId={id} />
            <ShareButton title={listing.title} />
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4 md:gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            {/* Image Gallery */}
            <div className="relative">
              <ImageGallery images={sortedImages} title={listing.title} />
              {listing.is_featured && (
                <Badge className="absolute top-3 left-3 md:top-4 md:left-4 bg-secondary text-secondary-foreground z-10">
                  Featured
                </Badge>
              )}
            </div>

            {/* Title & Price */}
            <div>
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 md:gap-4">
                <div>
                  <h1 className="text-xl md:text-2xl lg:text-3xl font-bold">{listing.title}</h1>
                  <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-2 text-sm text-muted-foreground">
                    {listing.year && <span>{listing.year}</span>}
                    {listing.make && <span>{listing.make}</span>}
                    {listing.model && <span>{listing.model}</span>}
                    {listing.condition && (
                      <Badge variant="outline" className="capitalize text-xs">
                        {listing.condition}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="md:text-right">
                  <p className="text-2xl md:text-3xl font-bold text-primary">
                    {listing.price ? `$${listing.price.toLocaleString()}` : 'Call for Price'}
                  </p>
                  {listing.price_type === 'negotiable' && (
                    <p className="text-sm text-muted-foreground">Negotiable</p>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile Contact CTA */}
            <div className="lg:hidden">
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      {listing.user?.avatar_url ? (
                        <Image
                          src={listing.user.avatar_url}
                          alt={listing.user.company_name || 'Seller'}
                          width={40}
                          height={40}
                          className="rounded-full"
                        />
                      ) : (
                        <Building2 className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">
                        {listing.user?.company_name || 'Private Seller'}
                      </p>
                      {listing.user?.is_dealer && (
                        <Badge variant="secondary" className="text-xs mt-0.5">
                          <Shield className="w-3 h-3 mr-1" />
                          Verified Dealer
                        </Badge>
                      )}
                    </div>
                  </div>
                  {listing.user?.phone && (
                    <Button className="w-full" size="lg" asChild>
                      <a href={`tel:${listing.user.phone}`}>
                        <Phone className="w-4 h-4 mr-2" />
                        Call Seller
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* AI Price Analysis */}
            {listing.ai_price_estimate && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 md:p-2 bg-primary/10 rounded-lg flex-shrink-0">
                      <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm md:text-base">AI Price Analysis</h3>
                      <p className="text-xs md:text-sm text-muted-foreground mt-1">
                        Estimated market value:{' '}
                        <strong>${listing.ai_price_estimate.toLocaleString()}</strong>
                        {listing.ai_price_confidence && (
                          <span className="ml-2">
                            ({Math.round(listing.ai_price_confidence * 100)}% confidence)
                          </span>
                        )}
                      </p>
                      {listing.price && listing.ai_price_estimate && (
                        <p className="text-xs md:text-sm mt-1">
                          {listing.price < listing.ai_price_estimate * 0.95 ? (
                            <span className="text-green-600 flex items-center gap-1">
                              <Check className="w-3 h-3 md:w-4 md:h-4" />
                              Good deal - below market value
                            </span>
                          ) : listing.price > listing.ai_price_estimate * 1.05 ? (
                            <span className="text-amber-600 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 md:w-4 md:h-4" />
                              Above estimated market value
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              Fair market price
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Details */}
            <Card>
              <CardHeader className="pb-2 md:pb-4">
                <CardTitle className="text-base md:text-lg">Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  {listing.year && (
                    <DetailRow icon={<Calendar className="w-4 h-4" />} label="Year" value={listing.year} />
                  )}
                  {listing.make && (
                    <DetailRow icon={null} label="Make" value={listing.make} />
                  )}
                  {listing.model && (
                    <DetailRow icon={null} label="Model" value={listing.model} />
                  )}
                  {listing.mileage && (
                    <DetailRow
                      icon={<Gauge className="w-4 h-4" />}
                      label="Mileage"
                      value={`${listing.mileage.toLocaleString()} mi`}
                    />
                  )}
                  {listing.hours && (
                    <DetailRow icon={null} label="Hours" value={listing.hours.toLocaleString()} />
                  )}
                  {listing.vin && (
                    <DetailRow icon={<Shield className="w-4 h-4" />} label="VIN" value={listing.vin} />
                  )}
                  {listing.condition && (
                    <DetailRow icon={null} label="Condition" value={listing.condition} />
                  )}
                  {(listing.city || listing.state) && (
                    <DetailRow
                      icon={<MapPin className="w-4 h-4" />}
                      label="Location"
                      value={[listing.city, listing.state].filter(Boolean).join(', ')}
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Specifications */}
            {listing.specs && Object.keys(listing.specs).length > 0 && (
              <Card>
                <CardHeader className="pb-2 md:pb-4">
                  <CardTitle className="text-base md:text-lg">Specifications</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 md:gap-4">
                    {Object.entries(listing.specs).map(([key, value]) => (
                      <DetailRow
                        key={key}
                        icon={null}
                        label={key.replace(/_/g, ' ')}
                        value={String(value)}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Description */}
            {listing.description && (
              <Card>
                <CardHeader className="pb-2 md:pb-4">
                  <CardTitle className="text-base md:text-lg">Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm md:text-base whitespace-pre-wrap">{listing.description}</p>
                </CardContent>
              </Card>
            )}

            {/* Video Walkaround */}
            {listing.video_url && (
              <VideoPlayer videoUrl={listing.video_url} title={listing.title} />
            )}
          </div>

          {/* Sidebar - Desktop */}
          <div className="hidden lg:block space-y-6">
            {/* Seller Info */}
            <Card>
              <CardHeader>
                <CardTitle>Seller</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    {listing.user?.avatar_url ? (
                      <Image
                        src={listing.user.avatar_url}
                        alt={listing.user.company_name || 'Seller'}
                        width={48}
                        height={48}
                        className="rounded-full"
                      />
                    ) : (
                      <Building2 className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">
                      {listing.user?.company_name || 'Private Seller'}
                    </p>
                    {listing.user?.is_dealer && (
                      <Badge variant="secondary" className="mt-1">
                        <Shield className="w-3 h-3 mr-1" />
                        Verified Dealer
                      </Badge>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  {listing.user?.phone && (
                    <Button className="w-full" size="lg" asChild>
                      <a href={`tel:${listing.user.phone}`}>
                        <Phone className="w-4 h-4 mr-2" />
                        {listing.user.phone}
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Contact Form */}
            <ContactSeller
              listingId={id}
              sellerId={listing.user?.id || ''}
              listingTitle={listing.title}
            />

            {/* Quick Stats */}
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">{listing.views_count || 0}</p>
                    <p className="text-sm text-muted-foreground">Views</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {Math.floor((Date.now() - new Date(listing.created_at).getTime()) / (1000 * 60 * 60 * 24))}
                    </p>
                    <p className="text-sm text-muted-foreground">Days Listed</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Financing Calculator */}
            {listing.price && listing.price > 0 && (
              <FinancingCalculator listingPrice={listing.price} />
            )}

            {/* Safety Tips */}
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <h3 className="font-semibold flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4" />
                  Safety Tips
                </h3>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>Meet in a public place for test drives</li>
                  <li>Verify VIN and title before purchase</li>
                  <li>Use secure payment methods</li>
                  <li>Get a mechanic inspection</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Similar Listings */}
        {similarListings && similarListings.length > 0 && (
          <div className="mt-8 md:mt-12">
            <h2 className="text-lg md:text-2xl font-bold mb-4 md:mb-6">Similar Listings</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
              {similarListings.map((item) => {
                const itemImage = item.images?.find((img: { is_primary: boolean }) => img.is_primary) || item.images?.[0];
                return (
                  <Link key={item.id} href={`/listing/${item.id}`}>
                    <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full">
                      <div className="relative aspect-[4/3] bg-muted">
                        {itemImage ? (
                          <Image
                            src={itemImage.url}
                            alt={item.title}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                            No Image
                          </div>
                        )}
                      </div>
                      <CardContent className="p-2 md:p-4">
                        <h3 className="font-semibold text-sm md:text-base truncate">{item.title}</h3>
                        <p className="text-base md:text-lg font-bold text-primary mt-0.5 md:mt-1">
                          {item.price ? `$${item.price.toLocaleString()}` : 'Call'}
                        </p>
                        <p className="text-xs md:text-sm text-muted-foreground truncate mt-0.5">
                          {[item.year, item.make, item.model].filter(Boolean).join(' ')}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Recently Viewed */}
        <div className="mt-8 md:mt-12">
          <RecentlyViewed currentListingId={id} maxItems={6} />
        </div>

        {/* Mobile Contact Form & Financing */}
        <div className="lg:hidden mt-8 space-y-6">
          <ContactSeller
            listingId={id}
            sellerId={listing.user?.id || ''}
            listingTitle={listing.title}
          />
          {listing.price && listing.price > 0 && (
            <FinancingCalculator listingPrice={listing.price} />
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-2 md:gap-3">
      {icon && <span className="text-muted-foreground flex-shrink-0">{icon}</span>}
      <div className="min-w-0">
        <p className="text-xs md:text-sm text-muted-foreground capitalize">{label}</p>
        <p className="font-medium text-sm md:text-base truncate">{value}</p>
      </div>
    </div>
  );
}
