import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Mail,
  Phone,
  Calendar,
  MessageSquare,
  Filter,
  ArrowUpRight,
} from 'lucide-react';
import Link from 'next/link';
import { LeadKanban } from '@/components/dashboard/LeadKanban';

export default async function LeadsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Get all leads for this user
  const { data: leads } = await supabase
    .from('leads')
    .select(`
      *,
      listing:listings(id, title, price)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // Get lead stats
  const stats = {
    total: leads?.length || 0,
    new: leads?.filter(l => l.status === 'new').length || 0,
    contacted: leads?.filter(l => l.status === 'contacted').length || 0,
    qualified: leads?.filter(l => l.status === 'qualified').length || 0,
    won: leads?.filter(l => l.status === 'won').length || 0,
    lost: leads?.filter(l => l.status === 'lost').length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Lead Management</h1>
          <p className="text-muted-foreground mt-1">
            Track and manage buyer inquiries
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatBadge label="Total" count={stats.total} />
        <StatBadge label="New" count={stats.new} color="blue" />
        <StatBadge label="Contacted" count={stats.contacted} color="yellow" />
        <StatBadge label="Qualified" count={stats.qualified} color="purple" />
        <StatBadge label="Won" count={stats.won} color="green" />
        <StatBadge label="Lost" count={stats.lost} color="red" />
      </div>

      {/* Kanban Board */}
      {leads && leads.length > 0 ? (
        <LeadKanban leads={leads} />
      ) : (
        <Card>
          <CardContent className="py-16">
            <div className="text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No leads yet</h3>
              <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                Leads will appear here when potential buyers inquire about your listings.
                Make sure your listings have contact information enabled.
              </p>
              <Button asChild>
                <Link href="/dashboard/listings">
                  View Listings
                  <ArrowUpRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatBadge({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color?: 'blue' | 'yellow' | 'purple' | 'green' | 'red';
}) {
  const colors = {
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <Card>
      <CardContent className="p-4 text-center">
        <p className="text-2xl font-bold">{count}</p>
        <Badge
          variant="secondary"
          className={color ? colors[color] : ''}
        >
          {label}
        </Badge>
      </CardContent>
    </Card>
  );
}
