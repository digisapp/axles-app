import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Plus,
  ArrowLeft,
  Edit,
  Eye,
  MoreVertical,
  ImageIcon,
} from 'lucide-react';

export default async function ListingsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/dashboard/listings');
  }

  // Check if user is a dealer
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_dealer')
    .eq('id', user.id)
    .single();

  if (!profile?.is_dealer) {
    redirect('/become-a-dealer');
  }

  const { data: listings } = await supabase
    .from('listings')
    .select(`
      id, title, price, status, views_count, created_at, updated_at,
      images:listing_images(id, url, is_primary)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700';
      case 'draft':
        return 'bg-yellow-100 text-yellow-700';
      case 'sold':
        return 'bg-blue-100 text-blue-700';
      case 'expired':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getPrimaryImage = (images: Array<{ id: string; url: string; is_primary: boolean }>) => {
    const primary = images?.find((img) => img.is_primary);
    return primary?.url || images?.[0]?.url || null;
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-xl font-bold">My Listings</h1>
              <p className="text-sm text-muted-foreground">
                {listings?.length || 0} total listings
              </p>
            </div>
          </div>

          <Button asChild>
            <Link href="/dashboard/listings/new">
              <Plus className="w-4 h-4 mr-2" />
              New Listing
            </Link>
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {listings && listings.length > 0 ? (
          <div className="grid gap-4">
            {listings.map((listing) => {
              const imageUrl = getPrimaryImage(listing.images || []);
              return (
                <Card key={listing.id} className="overflow-hidden">
                  <div className="flex flex-col md:flex-row">
                    {/* Image */}
                    <div className="relative w-full md:w-48 h-48 md:h-32 bg-muted flex-shrink-0">
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={listing.title}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{listing.title}</h3>
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full ${getStatusBadge(listing.status)}`}
                          >
                            {listing.status}
                          </span>
                        </div>
                        <p className="text-lg font-bold text-primary">
                          {listing.price
                            ? `$${listing.price.toLocaleString()}`
                            : 'No price set'}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Eye className="w-4 h-4" />
                            {listing.views_count || 0} views
                          </span>
                          <span>
                            Created {new Date(listing.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/listing/${listing.id}`} target="_blank">
                            <Eye className="w-4 h-4 mr-2" />
                            View
                          </Link>
                        </Button>
                        <Button size="sm" asChild>
                          <Link href={`/dashboard/listings/${listing.id}/edit`}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <ImageIcon className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No listings yet</h3>
              <p className="text-muted-foreground mb-6">
                Create your first listing to start selling equipment
              </p>
              <Button asChild>
                <Link href="/dashboard/listings/new">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Listing
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
