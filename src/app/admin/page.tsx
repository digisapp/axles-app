import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  Package,
  Eye,
  MessageSquare,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  Shield,
} from 'lucide-react';

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/admin');
  }

  // Check if user is admin (you would typically check a role field)
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_dealer')
    .eq('id', user.id)
    .single();

  // For now, allow any authenticated user - in production, check admin role
  // if (!profile?.is_admin) redirect('/dashboard');

  // Get stats
  const { count: totalUsers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  const { count: totalListings } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true });

  const { count: activeListings } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  const { count: totalMessages } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true });

  // Get recent users
  const { data: recentUsers } = await supabase
    .from('profiles')
    .select('id, email, company_name, is_dealer, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  // Get recent listings
  const { data: recentListings } = await supabase
    .from('listings')
    .select('id, title, status, created_at, user_id')
    .order('created_at', { ascending: false })
    .limit(5);

  // Get profiles for listings
  const listingUserIds = [...new Set(recentListings?.map((l) => l.user_id) || [])];
  const { data: listingProfiles } = await supabase
    .from('profiles')
    .select('id, company_name, email')
    .in('id', listingUserIds);

  const listingProfileMap = (listingProfiles || []).reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {} as Record<string, { id: string; company_name: string; email: string }>);

  // Get total views
  const { data: viewsData } = await supabase
    .from('listings')
    .select('views_count');

  const totalViews = viewsData?.reduce((sum, l) => sum + (l.views_count || 0), 0) || 0;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Manage users, listings, and platform settings
              </p>
            </div>
          </div>
          <Button variant="outline" asChild>
            <Link href="/dashboard">
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-5 h-5 text-muted-foreground" />
                <ArrowUpRight className="w-4 h-4 text-green-500" />
              </div>
              <p className="text-3xl font-bold">{totalUsers || 0}</p>
              <p className="text-sm text-muted-foreground">Total Users</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Package className="w-5 h-5 text-muted-foreground" />
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  {activeListings} active
                </span>
              </div>
              <p className="text-3xl font-bold">{totalListings || 0}</p>
              <p className="text-sm text-muted-foreground">Total Listings</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Eye className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-3xl font-bold">{totalViews.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Views</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <MessageSquare className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-3xl font-bold">{totalMessages || 0}</p>
              <p className="text-sm text-muted-foreground">Messages Sent</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Recent Users */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Users</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/users">View All</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recentUsers && recentUsers.length > 0 ? (
                <div className="space-y-4">
                  {recentUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">
                          {user.company_name || user.email}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {user.is_dealer && (
                          <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">
                            Dealer
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(user.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No users yet
                </p>
              )}
            </CardContent>
          </Card>

          {/* Recent Listings */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Listings</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/listings">View All</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recentListings && recentListings.length > 0 ? (
                <div className="space-y-4">
                  {recentListings.map((listing) => (
                    <div
                      key={listing.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium truncate max-w-[200px]">
                          {listing.title}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          by {listingProfileMap[listing.user_id]?.company_name || listingProfileMap[listing.user_id]?.email || 'Unknown'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            listing.status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : listing.status === 'draft'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {listing.status}
                        </span>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/listing/${listing.id}`}>View</Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No listings yet
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/admin/users">
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Manage Users</p>
                    <p className="text-sm text-muted-foreground">View and edit users</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/listings">
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Package className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Manage Listings</p>
                    <p className="text-sm text-muted-foreground">Moderate content</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/analytics">
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Analytics</p>
                    <p className="text-sm text-muted-foreground">View reports</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/settings">
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <DollarSign className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Billing</p>
                    <p className="text-sm text-muted-foreground">Payments & plans</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
