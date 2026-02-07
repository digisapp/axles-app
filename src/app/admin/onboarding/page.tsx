import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  Users,
  Building2,
  Mail,
  Package,
  ArrowUpRight,
  Search,
} from 'lucide-react';

export default async function OnboardingPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/admin/onboarding');
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    redirect('/dashboard');
  }

  // Get placeholder profiles (scraped dealers needing onboarding)
  const { data: placeholderProfiles, count: totalPlaceholders } = await supabase
    .from('profiles')
    .select(`
      id,
      email,
      company_name,
      is_dealer,
      created_at,
      city,
      state,
      phone
    `, { count: 'exact' })
    .like('email', '%@dealers.axlon.ai')
    .eq('is_dealer', false)
    .order('created_at', { ascending: false })
    .limit(100);

  // Get listing counts for each profile
  const profileIds = placeholderProfiles?.map(p => p.id) || [];

  const { data: listingCounts } = await supabase
    .from('listings')
    .select('user_id')
    .in('user_id', profileIds);

  // Count listings per profile
  const listingCountMap: Record<string, number> = {};
  listingCounts?.forEach(l => {
    listingCountMap[l.user_id] = (listingCountMap[l.user_id] || 0) + 1;
  });

  // Get stats
  const { count: withListings } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .like('email', '%@dealers.axlon.ai')
    .eq('is_dealer', false)
    .in('id',
      (await supabase.from('listings').select('user_id')).data?.map(l => l.user_id) || []
    );

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Dealer Onboarding</h1>
              <p className="text-sm text-muted-foreground">
                Scraped dealers awaiting activation
              </p>
            </div>
          </div>
          <Button variant="outline" asChild>
            <Link href="/admin">
              <Shield className="w-4 h-4 mr-2" />
              Back to Admin
            </Link>
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-5 h-5 text-orange-500" />
              </div>
              <p className="text-3xl font-bold">{totalPlaceholders || 0}</p>
              <p className="text-sm text-muted-foreground">Pending Onboarding</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Package className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-3xl font-bold">{withListings || 0}</p>
              <p className="text-sm text-muted-foreground">With Listings</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Building2 className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-3xl font-bold">17</p>
              <p className="text-sm text-muted-foreground">Active Dealers</p>
            </CardContent>
          </Card>
        </div>

        {/* Info Card */}
        <Card className="mb-6 border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <p className="text-sm text-orange-800">
              <strong>What is this?</strong> These are placeholder profiles created when scraping listings from TruckPaper and other sources.
              Each profile represents a potential dealer that could be converted to an active account.
              They have auto-generated emails like <code className="bg-orange-100 px-1 rounded">dealer@dealers.axlon.ai</code>.
            </p>
          </CardContent>
        </Card>

        {/* Profiles List */}
        <Card>
          <CardHeader>
            <CardTitle>Placeholder Profiles</CardTitle>
            <CardDescription>
              Showing {placeholderProfiles?.length || 0} of {totalPlaceholders || 0} profiles
            </CardDescription>
          </CardHeader>
          <CardContent>
            {placeholderProfiles && placeholderProfiles.length > 0 ? (
              <div className="space-y-3">
                {placeholderProfiles.map((p) => {
                  const listingCount = listingCountMap[p.id] || 0;
                  const emailPrefix = p.email.split('@')[0];

                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {p.company_name || emailPrefix}
                          </p>
                          {listingCount > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {listingCount} listings
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {p.email}
                          </p>
                          {p.city && p.state && (
                            <p className="text-sm text-muted-foreground">
                              {p.city}, {p.state}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString()}
                        </span>
                        {listingCount > 0 && (
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/admin/listings?user=${p.id}`}>
                              View Listings
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No placeholder profiles found
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
