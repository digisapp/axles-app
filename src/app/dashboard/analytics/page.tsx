import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Eye,
  Users,
  TrendingUp,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  MousePointerClick,
} from 'lucide-react';
import { AnalyticsCharts } from '@/components/dashboard/AnalyticsCharts';

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Get listings with view counts
  const { data: listings } = await supabase
    .from('listings')
    .select('id, title, views_count, status, created_at, price')
    .eq('user_id', user.id)
    .order('views_count', { ascending: false });

  // Get total stats
  const totalViews = listings?.reduce((sum, l) => sum + (l.views_count || 0), 0) || 0;
  const activeListings = listings?.filter(l => l.status === 'active').length || 0;
  const totalListings = listings?.length || 0;

  // Get leads stats
  const { count: totalLeads } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const { count: convertedLeads } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'won');

  // Calculate conversion rate
  const conversionRate = totalLeads && totalLeads > 0
    ? ((convertedLeads || 0) / totalLeads * 100).toFixed(1)
    : '0';

  // Get real analytics data
  const { viewsData, leadsData, viewsTrend, leadsTrend } = await getAnalyticsData(supabase, user.id);

  // Top performing listings
  const topListings = listings?.slice(0, 5) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Track your listings performance and lead conversion
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Views"
          value={totalViews.toLocaleString()}
          icon={<Eye className="w-5 h-5" />}
          description="All time"
          trend={viewsTrend}
        />
        <StatCard
          title="Active Listings"
          value={activeListings}
          icon={<Package className="w-5 h-5" />}
          description={`${totalListings} total`}
        />
        <StatCard
          title="Total Leads"
          value={totalLeads || 0}
          icon={<Users className="w-5 h-5" />}
          description="From inquiries"
          trend={leadsTrend}
        />
        <StatCard
          title="Conversion Rate"
          value={`${conversionRate}%`}
          icon={<MousePointerClick className="w-5 h-5" />}
          description="Leads to sales"
        />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Views Over Time</CardTitle>
            <CardDescription>Daily views for the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <AnalyticsCharts data={viewsData} type="views" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Leads Over Time</CardTitle>
            <CardDescription>Daily leads for the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <AnalyticsCharts data={leadsData} type="leads" />
          </CardContent>
        </Card>
      </div>

      {/* Top Performing Listings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top Performing Listings</CardTitle>
          <CardDescription>Listings with the most views</CardDescription>
        </CardHeader>
        <CardContent>
          {topListings.length > 0 ? (
            <div className="space-y-4">
              {topListings.map((listing, index) => (
                <div
                  key={listing.id}
                  className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{listing.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {listing.price ? `$${listing.price.toLocaleString()}` : 'No price'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{listing.views_count || 0}</p>
                    <p className="text-xs text-muted-foreground">views</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No listings yet. Create your first listing to start tracking performance.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lead Funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lead Conversion Funnel</CardTitle>
          <CardDescription>Track leads through your sales pipeline</CardDescription>
        </CardHeader>
        <CardContent>
          <LeadFunnel userId={user.id} />
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  description,
  trend,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description: string;
  trend?: number;
}) {
  return (
    <Card>
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
        </div>
        <p className="text-2xl md:text-3xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

async function LeadFunnel({ userId }: { userId: string }) {
  const supabase = await createClient();

  // Get lead counts by status
  const { data: leadStats } = await supabase
    .from('leads')
    .select('status')
    .eq('user_id', userId);

  const statusCounts = {
    new: 0,
    contacted: 0,
    qualified: 0,
    won: 0,
    lost: 0,
  };

  leadStats?.forEach((lead) => {
    if (lead.status in statusCounts) {
      statusCounts[lead.status as keyof typeof statusCounts]++;
    }
  });

  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  const funnelSteps = [
    { label: 'New Leads', count: statusCounts.new, color: 'bg-blue-500' },
    { label: 'Contacted', count: statusCounts.contacted, color: 'bg-yellow-500' },
    { label: 'Qualified', count: statusCounts.qualified, color: 'bg-purple-500' },
    { label: 'Won', count: statusCounts.won, color: 'bg-green-500' },
  ];

  if (total === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No leads yet. Leads will appear here as buyers inquire about your listings.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {funnelSteps.map((step, index) => {
        const percentage = total > 0 ? (step.count / total) * 100 : 0;
        const width = Math.max(percentage, 10); // Minimum 10% width for visibility

        return (
          <div key={step.label} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{step.label}</span>
              <span className="text-muted-foreground">
                {step.count} ({percentage.toFixed(0)}%)
              </span>
            </div>
            <div className="h-8 bg-muted rounded-lg overflow-hidden">
              <div
                className={`h-full ${step.color} transition-all duration-500 rounded-lg flex items-center justify-center`}
                style={{ width: `${width}%` }}
              >
                {step.count > 0 && (
                  <span className="text-white text-xs font-medium">{step.count}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Lost leads indicator */}
      {statusCounts.lost > 0 && (
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Lost Leads</span>
            <span className="text-red-600 font-medium">{statusCounts.lost}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Fetch real analytics data
async function getAnalyticsData(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const days = 30;

  // Try to get data from RPC functions, fall back to direct queries
  let viewsData: { date: string; views: number }[] = [];
  let leadsData: { date: string; leads: number }[] = [];
  let viewsTrend = 0;
  let leadsTrend = 0;

  try {
    // Get daily views
    const { data: dailyViews } = await supabase.rpc('get_user_daily_views', {
      p_user_id: userId,
      p_days: days,
    });

    if (dailyViews) {
      viewsData = fillMissingDates(dailyViews, days, 'view_date', 'view_count', 'views') as { date: string; views: number }[];
    }

    // Get view trend
    const { data: viewStats } = await supabase.rpc('get_user_view_stats', {
      p_user_id: userId,
      p_period_days: 7,
    });

    if (viewStats?.[0]) {
      viewsTrend = viewStats[0].trend_percentage || 0;
    }
  } catch (e) {
    // RPC not available yet - use empty data
    viewsData = generateEmptyDates(days, 'views') as unknown as { date: string; views: number }[];
  }

  try {
    // Get daily leads (leads table already exists with created_at)
    const { data: leads } = await supabase
      .from('leads')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

    if (leads) {
      const leadsByDate = new Map<string, number>();
      leads.forEach((lead) => {
        const date = new Date(lead.created_at).toISOString().split('T')[0];
        leadsByDate.set(date, (leadsByDate.get(date) || 0) + 1);
      });
      leadsData = generateEmptyDates(days, 'leads').map((d) => ({
        date: d.date as string,
        leads: leadsByDate.get(d.date as string) || 0,
      }));
    }

    // Calculate lead trend manually
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;

    const { count: currentWeekLeads } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', new Date(weekAgo).toISOString());

    const { count: previousWeekLeads } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', new Date(twoWeeksAgo).toISOString())
      .lt('created_at', new Date(weekAgo).toISOString());

    if (previousWeekLeads && previousWeekLeads > 0) {
      leadsTrend = Math.round(((currentWeekLeads || 0) - previousWeekLeads) / previousWeekLeads * 100);
    }
  } catch (e) {
    leadsData = generateEmptyDates(days, 'leads') as unknown as { date: string; leads: number }[];
  }

  return { viewsData, leadsData, viewsTrend, leadsTrend };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fillMissingDates(
  data: Array<Record<string, any>>,
  days: number,
  dateField: string,
  countField: string,
  outputField: string
): Array<Record<string, any>> {
  const result: Array<Record<string, any>> = [];
  const dataMap = new Map<string, number>();

  data.forEach((item) => {
    const date = String(item[dateField]);
    dataMap.set(date, Number(item[countField]) || 0);
  });

  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    result.push({
      date: dateStr,
      [outputField]: dataMap.get(dateStr) || 0,
    });
  }

  return result;
}

function generateEmptyDates(days: number, field: string): Array<Record<string, any>> {
  const result: Array<Record<string, any>> = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    result.push({
      date: date.toISOString().split('T')[0],
      [field]: 0,
    });
  }

  return result;
}
