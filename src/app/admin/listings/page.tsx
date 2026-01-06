import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Eye,
  ImageIcon,
  ExternalLink,
} from 'lucide-react';

export default async function AdminListingsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/admin/listings');
  }

  // Get all listings
  const { data: listings } = await supabase
    .from('listings')
    .select(`
      id, title, price, status, views_count, created_at, user_id,
      images:listing_images(url, is_primary)
    `)
    .order('created_at', { ascending: false });

  // Get user profiles
  const userIds = [...new Set(listings?.map((l) => l.user_id) || [])];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, company_name, email')
    .in('id', userIds);

  const profileMap = (profiles || []).reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {} as Record<string, { id: string; company_name: string; email: string }>);

  const getPrimaryImage = (images: Array<{ url: string; is_primary: boolean }>) => {
    const primary = images?.find((img) => img.is_primary);
    return primary?.url || images?.[0]?.url || null;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>;
      case 'draft':
        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Draft</Badge>;
      case 'sold':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Sold</Badge>;
      case 'expired':
        return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">Expired</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-xl font-bold">Listing Management</h1>
              <p className="text-sm text-muted-foreground">
                {listings?.length || 0} total listings
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="space-y-4">
          {listings?.map((listing) => {
            const imageUrl = getPrimaryImage(listing.images || []);

            return (
              <Card key={listing.id}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Image */}
                    <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={listing.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold">{listing.title}</h3>
                          <p className="text-lg font-bold text-primary">
                            {listing.price
                              ? `$${listing.price.toLocaleString()}`
                              : 'No price'}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            by {profileMap[listing.user_id]?.company_name || profileMap[listing.user_id]?.email || 'Unknown'}
                          </p>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          {getStatusBadge(listing.status)}
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Eye className="w-4 h-4" />
                            {listing.views_count || 0}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mt-4">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/listing/${listing.id}`} target="_blank">
                            <ExternalLink className="w-4 h-4 mr-1" />
                            View
                          </Link>
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          Created {new Date(listing.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {(!listings || listings.length === 0) && (
            <Card>
              <CardContent className="py-16 text-center">
                <p className="text-muted-foreground">No listings found</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
