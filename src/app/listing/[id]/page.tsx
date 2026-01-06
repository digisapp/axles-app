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
  ArrowLeft,
  MapPin,
  Calendar,
  Gauge,
  Phone,
  Mail,
  Heart,
  Share2,
  Shield,
  TrendingUp,
  Check,
  AlertCircle,
  Building2,
} from 'lucide-react';

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
      category:categories(id, name, slug),
      images:listing_images(id, url, thumbnail_url, is_primary, sort_order, ai_analysis),
      user:profiles(id, company_name, phone, email, avatar_url, is_dealer, created_at)
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

  const primaryImage = listing.images?.find((img: { is_primary: boolean }) => img.is_primary) || listing.images?.[0];
  const otherImages = listing.images?.filter((img: { id: string }) => img.id !== primaryImage?.id) || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/search"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Search
          </Link>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              <Heart className="w-4 h-4 mr-2" />
              Save
            </Button>
            <Button variant="ghost" size="sm">
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Gallery */}
            <div className="space-y-4">
              <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-muted">
                {primaryImage ? (
                  <Image
                    src={primaryImage.url}
                    alt={listing.title}
                    fill
                    className="object-cover"
                    priority
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-muted-foreground">No Image Available</span>
                  </div>
                )}
                {listing.is_featured && (
                  <Badge className="absolute top-4 left-4 bg-secondary text-secondary-foreground">
                    Featured
                  </Badge>
                )}
              </div>

              {otherImages.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {otherImages.slice(0, 4).map((img: { id: string; url: string; thumbnail_url?: string }, index: number) => (
                    <div
                      key={img.id}
                      className="relative aspect-[4/3] rounded-lg overflow-hidden bg-muted cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      <Image
                        src={img.thumbnail_url || img.url}
                        alt={`${listing.title} - Image ${index + 2}`}
                        fill
                        className="object-cover"
                      />
                      {index === 3 && otherImages.length > 4 && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <span className="text-white font-semibold">
                            +{otherImages.length - 4} more
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Title & Price */}
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold">{listing.title}</h1>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-muted-foreground">
                    {listing.year && <span>{listing.year}</span>}
                    {listing.make && <span>{listing.make}</span>}
                    {listing.model && <span>{listing.model}</span>}
                    {listing.condition && (
                      <Badge variant="outline" className="capitalize">
                        {listing.condition}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-primary">
                    {listing.price ? `$${listing.price.toLocaleString()}` : 'Call for Price'}
                  </p>
                  {listing.price_type === 'negotiable' && (
                    <p className="text-sm text-muted-foreground">Negotiable</p>
                  )}
                </div>
              </div>
            </div>

            {/* AI Price Analysis */}
            {listing.ai_price_estimate && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">AI Price Analysis</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Estimated market value:{' '}
                        <strong>${listing.ai_price_estimate.toLocaleString()}</strong>
                        {listing.ai_price_confidence && (
                          <span className="ml-2">
                            ({Math.round(listing.ai_price_confidence * 100)}% confidence)
                          </span>
                        )}
                      </p>
                      {listing.price && listing.ai_price_estimate && (
                        <p className="text-sm mt-1">
                          {listing.price < listing.ai_price_estimate * 0.95 ? (
                            <span className="text-green-600 flex items-center gap-1">
                              <Check className="w-4 h-4" />
                              Good deal - below market value
                            </span>
                          ) : listing.price > listing.ai_price_estimate * 1.05 ? (
                            <span className="text-amber-600 flex items-center gap-1">
                              <AlertCircle className="w-4 h-4" />
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
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-4">
                  {listing.year && (
                    <DetailRow icon={<Calendar />} label="Year" value={listing.year} />
                  )}
                  {listing.make && (
                    <DetailRow icon={null} label="Make" value={listing.make} />
                  )}
                  {listing.model && (
                    <DetailRow icon={null} label="Model" value={listing.model} />
                  )}
                  {listing.mileage && (
                    <DetailRow
                      icon={<Gauge />}
                      label="Mileage"
                      value={`${listing.mileage.toLocaleString()} miles`}
                    />
                  )}
                  {listing.hours && (
                    <DetailRow icon={null} label="Hours" value={listing.hours.toLocaleString()} />
                  )}
                  {listing.vin && (
                    <DetailRow icon={<Shield />} label="VIN" value={listing.vin} />
                  )}
                  {listing.condition && (
                    <DetailRow icon={null} label="Condition" value={listing.condition} />
                  )}
                  {(listing.city || listing.state) && (
                    <DetailRow
                      icon={<MapPin />}
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
                <CardHeader>
                  <CardTitle>Specifications</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 gap-4">
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
                <CardHeader>
                  <CardTitle>Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap">{listing.description}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
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
                    <Button className="w-full" size="lg">
                      <Phone className="w-4 h-4 mr-2" />
                      {listing.user.phone}
                    </Button>
                  )}
                  <Button variant="outline" className="w-full" size="lg">
                    <Mail className="w-4 h-4 mr-2" />
                    Contact Seller
                  </Button>
                </div>
              </CardContent>
            </Card>

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
      </main>
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
    <div className="flex items-center gap-3">
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <div>
        <p className="text-sm text-muted-foreground capitalize">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}
