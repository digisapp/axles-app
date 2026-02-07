import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
} from 'lucide-react';
import { AdminListingCard } from '@/components/admin/AdminListingCard';

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
              <AdminListingCard
                key={listing.id}
                listing={listing}
                imageUrl={imageUrl}
                sellerName={profileMap[listing.user_id]?.company_name || profileMap[listing.user_id]?.email || 'Unknown'}
                statusBadge={getStatusBadge(listing.status)}
              />
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
