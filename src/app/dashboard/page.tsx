import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Package,
  Eye,
  MessageSquare,
  TrendingUp,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Warehouse,
  Upload,
} from 'lucide-react';

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // All dashboard users should be dealers
  if (!profile?.is_dealer) {
    redirect('/become-a-dealer');
  }

  // Get unread messages count
  const { count: unreadMessages } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', user.id)
    .eq('is_read', false);

  // Dealer data
  const { count: total } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);
  const totalListings = total || 0;

  const { count: active } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'active');
  const activeListings = active || 0;

  const { data: viewsData } = await supabase
    .from('listings')
    .select('views_count')
    .eq('user_id', user.id);
  const totalViews = viewsData?.reduce((sum, l) => sum + (l.views_count || 0), 0) || 0;

  const { count: leads } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'new');
  const newLeads = leads || 0;

  // Calculate trends (last 7 days vs previous 7 days)
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

  // Leads in last 7 days
  const { count: leadsLast7 } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', sevenDaysAgo);

  // Leads in previous 7 days (7-14 days ago)
  const { count: leadsPrev7 } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', fourteenDaysAgo)
    .lt('created_at', sevenDaysAgo);

  // Calculate lead trend percentage
  const leadsTrend = leadsPrev7 && leadsPrev7 > 0
    ? Math.round(((leadsLast7 || 0) - leadsPrev7) / leadsPrev7 * 100)
    : leadsLast7 && leadsLast7 > 0 ? 100 : 0;

  // Views trend - check listing_views if available
  const { count: viewsLast7 } = await supabase
    .from('listing_views')
    .select('*', { count: 'exact', head: true })
    .in('listing_id', (await supabase.from('listings').select('id').eq('user_id', user.id)).data?.map(l => l.id) || [])
    .gte('created_at', sevenDaysAgo);

  const { count: viewsPrev7 } = await supabase
    .from('listing_views')
    .select('*', { count: 'exact', head: true })
    .in('listing_id', (await supabase.from('listings').select('id').eq('user_id', user.id)).data?.map(l => l.id) || [])
    .gte('created_at', fourteenDaysAgo)
    .lt('created_at', sevenDaysAgo);

  const viewsTrend = viewsPrev7 && viewsPrev7 > 0
    ? Math.round(((viewsLast7 || 0) - viewsPrev7) / viewsPrev7 * 100)
    : viewsLast7 && viewsLast7 > 0 ? 100 : 0;

  const { data: listings } = await supabase
    .from('listings')
    .select('id, title, price, status, views_count, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5);
  const recentListings = listings || [];

  // Dealer dashboard
  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">
            Welcome back, {profile?.company_name || user.email?.split('@')[0]}
          </h1>
          <p className="text-muted-foreground mt-1">
            Here&apos;s what&apos;s happening with your listings today.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/listings/new">
            <Plus className="w-4 h-4 mr-2" />
            New Listing
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Listings"
          value={activeListings || 0}
          icon={<Package className="w-5 h-5" />}
          description={`${totalListings || 0} total`}
        />
        <StatCard
          title="Total Views"
          value={totalViews}
          icon={<Eye className="w-5 h-5" />}
          description="Last 7 days"
          trend={viewsTrend || undefined}
        />
        <StatCard
          title="New Leads"
          value={newLeads || 0}
          icon={<Users className="w-5 h-5" />}
          description="Awaiting response"
          highlight={!!newLeads}
          trend={leadsTrend || undefined}
        />
        <StatCard
          title="Messages"
          value={unreadMessages || 0}
          icon={<MessageSquare className="w-5 h-5" />}
          description="Unread"
          highlight={!!unreadMessages}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Listings */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg">Recent Listings</CardTitle>
                <CardDescription>Your latest equipment listings</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/listings">
                  View All
                  <ArrowUpRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recentListings && recentListings.length > 0 ? (
                <div className="space-y-3">
                  {recentListings.map((listing) => (
                    <div
                      key={listing.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{listing.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {listing.price
                            ? `$${listing.price.toLocaleString()}`
                            : 'No price set'}
                          {' · '}
                          {listing.views_count || 0} views
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <StatusBadge status={listing.status} />
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
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <QuickActionButton
                href="/dashboard/listings/new"
                icon={<Plus className="w-4 h-4" />}
                label="Create New Listing"
              />
              <QuickActionButton
                href="/dashboard/leads"
                icon={<Users className="w-4 h-4" />}
                label="View Leads"
                badge={newLeads || undefined}
              />
              <QuickActionButton
                href="/dashboard/messages"
                icon={<MessageSquare className="w-4 h-4" />}
                label="View Messages"
                badge={unreadMessages || undefined}
              />
              <QuickActionButton
                href="/dashboard/analytics"
                icon={<BarChart3 className="w-4 h-4" />}
                label="View Analytics"
              />
              <QuickActionButton
                href="/dashboard/inventory"
                icon={<Warehouse className="w-4 h-4" />}
                label="Manage Inventory"
              />
              <QuickActionButton
                href="/dashboard/bulk"
                icon={<Upload className="w-4 h-4" />}
                label="Bulk Import"
              />
            </CardContent>
          </Card>

          {/* Upgrade Card */}
          <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Upgrade to Pro</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Get featured listings, priority support, and advanced analytics.
                  </p>
                  <Button size="sm" asChild>
                    <Link href="/dashboard/billing">
                      Upgrade Now
                      <ArrowUpRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  description,
  trend,
  highlight = false,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description: string;
  trend?: number;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? 'border-primary/50 bg-primary/5' : ''}>
      <CardContent className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-muted-foreground">{icon}</span>
          {trend !== undefined && (
            <span
              className={`flex items-center text-xs font-medium ${
                trend >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {trend >= 0 ? (
                <ArrowUpRight className="w-3 h-3 mr-0.5" />
              ) : (
                <ArrowDownRight className="w-3 h-3 mr-0.5" />
              )}
              {Math.abs(trend)}%
            </span>
          )}
          {highlight && (
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          )}
        </div>
        <p className="text-2xl md:text-3xl font-bold">{value.toLocaleString()}</p>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    draft: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    sold: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    expired: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  };

  return (
    <span
      className={`px-2 py-1 text-xs font-medium rounded-full ${
        styles[status as keyof typeof styles] || styles.draft
      }`}
    >
      {status}
    </span>
  );
}

function QuickActionButton({
  href,
  icon,
  label,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <Button className="w-full justify-start" variant="outline" asChild>
      <Link href={href}>
        {icon}
        <span className="ml-2">{label}</span>
        {badge !== undefined && badge > 0 && (
          <span className="ml-auto bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </Link>
    </Button>
  );
}

