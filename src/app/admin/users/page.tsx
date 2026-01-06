import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Users,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Shield,
} from 'lucide-react';

export default async function AdminUsersPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/admin/users');
  }

  // Get all users
  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  // Get listing counts per user
  const { data: listingCounts } = await supabase
    .from('listings')
    .select('user_id');

  const userListingCounts = (listingCounts || []).reduce((acc, l) => {
    acc[l.user_id] = (acc[l.user_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

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
              <h1 className="text-xl font-bold">User Management</h1>
              <p className="text-sm text-muted-foreground">
                {users?.length || 0} total users
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-4 font-medium">User</th>
                    <th className="text-left p-4 font-medium">Contact</th>
                    <th className="text-left p-4 font-medium">Type</th>
                    <th className="text-left p-4 font-medium">Listings</th>
                    <th className="text-left p-4 font-medium">Joined</th>
                    <th className="text-right p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users?.map((u) => (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-4">
                        <div>
                          <p className="font-medium">
                            {u.company_name || 'No Name'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {u.email}
                          </p>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="space-y-1">
                          {u.phone && (
                            <p className="text-sm flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {u.phone}
                            </p>
                          )}
                          {u.location && (
                            <p className="text-sm flex items-center gap-1 text-muted-foreground">
                              <MapPin className="w-3 h-3" />
                              {u.location}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        {u.is_dealer ? (
                          <Badge variant="default">
                            <Shield className="w-3 h-3 mr-1" />
                            Dealer
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Individual</Badge>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="font-medium">
                          {userListingCounts[u.id] || 0}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-right">
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
