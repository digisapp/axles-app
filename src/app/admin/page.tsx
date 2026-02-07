import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Package,
  Eye,
  MessageSquare,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  Shield,
  Building2,
  Clock,
  Phone,
  UserPlus,
  PhoneCall,
  Mic,
  Key,
} from 'lucide-react';

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/admin');
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  // Restrict to admins only
  if (!profile?.is_admin) {
    redirect('/dashboard');
  }

  // Get stats
  const { count: totalMessages } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true });

  const { count: totalListings } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true });

  const { count: activeListings } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  const { count: totalCalls } = await supabase
    .from('call_logs')
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

  // Get pending dealers count
  const { count: pendingDealers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('dealer_status', 'pending');

  // Get total dealers count
  const { count: totalDealers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('is_dealer', true);

  // Get placeholder profiles count (for onboarding)
  const { count: pendingOnboarding } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .like('email', '%@dealers.axlon.ai')
    .eq('is_dealer', false);

  // Get new leads count
  const { count: newLeads } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'new');

  // Get pending trade-ins count
  const { count: pendingTradeIns } = await supabase
    .from('trade_in_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

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
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <MessageSquare className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-3xl font-bold">{totalMessages || 0}</p>
              <p className="text-sm text-muted-foreground">Messages Sent</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Building2 className="w-5 h-5 text-green-500" />
                {(pendingDealers || 0) > 0 && (
                  <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-300">
                    {pendingDealers} pending
                  </Badge>
                )}
              </div>
              <p className="text-3xl font-bold">{totalDealers || 0}</p>
              <p className="text-sm text-muted-foreground">Dealers</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Package className="w-5 h-5 text-purple-500" />
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
                <Eye className="w-5 h-5 text-orange-500" />
              </div>
              <p className="text-3xl font-bold">{totalViews.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Views</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Phone className="w-5 h-5 text-cyan-500" />
              </div>
              <p className="text-3xl font-bold">{totalCalls || 0}</p>
              <p className="text-sm text-muted-foreground">Total Calls</p>
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
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link href="/admin/dealers">
              <Card className="hover:border-primary transition-colors cursor-pointer relative">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 bg-yellow-100 rounded-lg">
                    <Building2 className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">Dealer Verification</p>
                      {(pendingDealers || 0) > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {pendingDealers} pending
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">Approve dealers</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/users">
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">User Management</p>
                    <p className="text-sm text-muted-foreground">Manage all users</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/listings">
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <Package className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">Manage Listings</p>
                    <p className="text-sm text-muted-foreground">Moderate content</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/leads">
              <Card className="hover:border-primary transition-colors cursor-pointer relative">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <PhoneCall className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">Leads</p>
                      {(newLeads || 0) > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {newLeads} new
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">Phone calls & inquiries</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/trade-ins">
              <Card className="hover:border-primary transition-colors cursor-pointer relative">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 bg-amber-100 rounded-lg">
                    <ArrowUpRight className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">Trade-Ins</p>
                      {(pendingTradeIns || 0) > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {pendingTradeIns} pending
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">Trade-in requests</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/calls">
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 bg-cyan-100 rounded-lg">
                    <Phone className="w-6 h-6 text-cyan-600" />
                  </div>
                  <div>
                    <p className="font-medium">Call Logs</p>
                    <p className="text-sm text-muted-foreground">All incoming calls</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/analytics">
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium">Analytics</p>
                    <p className="text-sm text-muted-foreground">Charts & reports</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/onboarding">
              <Card className="hover:border-primary transition-colors cursor-pointer relative">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 bg-orange-100 rounded-lg">
                    <UserPlus className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">Dealer Onboarding</p>
                      {(pendingOnboarding || 0) > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {pendingOnboarding}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">Scraped dealers</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/ai-agent">
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 bg-cyan-100 rounded-lg">
                    <Phone className="w-6 h-6 text-cyan-600" />
                  </div>
                  <div>
                    <p className="font-medium">AI Phone Agent</p>
                    <p className="text-sm text-muted-foreground">Voice & settings</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/voice-agents">
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 bg-indigo-100 rounded-lg">
                    <Mic className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-medium">Dealer Voice Agents</p>
                    <p className="text-sm text-muted-foreground">Multi-tenant AI agents</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/staff">
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 bg-pink-100 rounded-lg">
                    <Key className="w-6 h-6 text-pink-600" />
                  </div>
                  <div>
                    <p className="font-medium">Dealer Staff</p>
                    <p className="text-sm text-muted-foreground">Voice PIN management</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/settings">
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 bg-orange-100 rounded-lg">
                    <DollarSign className="w-6 h-6 text-orange-600" />
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
