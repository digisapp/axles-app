import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Package,
  Eye,
  DollarSign,
  MessageSquare,
  TrendingUp,
  Settings,
  LogOut,
} from 'lucide-react';

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/dashboard');
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // Get user's listings stats
  const { count: totalListings } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const { count: activeListings } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'active');

  // Get total views
  const { data: viewsData } = await supabase
    .from('listings')
    .select('views_count')
    .eq('user_id', user.id);

  const totalViews = viewsData?.reduce((sum, l) => sum + (l.views_count || 0), 0) || 0;

  // Get unread messages count
  const { count: unreadMessages } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', user.id)
    .eq('is_read', false);

  // Get recent listings
  const { data: recentListings } = await supabase
    .from('listings')
    .select('id, title, price, status, views_count, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5);

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Seller Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back, {profile?.company_name || user.email}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button asChild>
              <Link href="/dashboard/listings/new">
                <Plus className="w-4 h-4 mr-2" />
                New Listing
              </Link>
            </Button>
            <Button variant="outline" size="icon" asChild>
              <Link href="/dashboard/settings">
                <Settings className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Total Listings"
            value={totalListings || 0}
            icon={<Package className="w-5 h-5" />}
            description={`${activeListings || 0} active`}
          />
          <StatCard
            title="Total Views"
            value={totalViews}
            icon={<Eye className="w-5 h-5" />}
            description="Across all listings"
          />
          <StatCard
            title="Messages"
            value={unreadMessages || 0}
            icon={<MessageSquare className="w-5 h-5" />}
            description="Unread inquiries"
            highlight={!!unreadMessages}
          />
          <StatCard
            title="Performance"
            value="+12%"
            icon={<TrendingUp className="w-5 h-5" />}
            description="vs last month"
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Recent Listings */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Recent Listings</CardTitle>
                  <CardDescription>Your latest equipment listings</CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/listings">View All</Link>
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
                          <p className="font-medium">{listing.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {listing.price
                              ? `$${listing.price.toLocaleString()}`
                              : 'No price set'}
                            {' • '}
                            {listing.views_count || 0} views
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
                            <Link href={`/dashboard/listings/${listing.id}/edit`}>
                              Edit
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">
                      No listings yet. Create your first listing!
                    </p>
                    <Button asChild>
                      <Link href="/dashboard/listings/new">
                        <Plus className="w-4 h-4 mr-2" />
                        Create Listing
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button className="w-full justify-start" variant="outline" asChild>
                  <Link href="/dashboard/listings/new">
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Listing
                  </Link>
                </Button>
                <Button className="w-full justify-start" variant="outline" asChild>
                  <Link href="/dashboard/messages">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    View Messages
                    {!!unreadMessages && (
                      <span className="ml-auto bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                        {unreadMessages}
                      </span>
                    )}
                  </Link>
                </Button>
                <Button className="w-full justify-start" variant="outline" asChild>
                  <Link href="/dashboard/analytics">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    View Analytics
                  </Link>
                </Button>
                <Button className="w-full justify-start" variant="outline" asChild>
                  <Link href="/dashboard/billing">
                    <DollarSign className="w-4 h-4 mr-2" />
                    Billing & Upgrades
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Upgrade Card */}
            <Card className="bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/20">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Upgrade to Pro</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Get featured listings, priority support, and advanced analytics.
                </p>
                <Button className="w-full" asChild>
                  <Link href="/dashboard/billing">
                    Upgrade Now
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  description,
  highlight = false,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? 'border-primary' : ''}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-muted-foreground">{icon}</span>
          {highlight && (
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          )}
        </div>
        <p className="text-3xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}
