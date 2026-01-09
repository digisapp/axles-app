import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Warehouse,
  Package,
  DollarSign,
  Clock,
  AlertTriangle,
  Plus,
  Filter,
  Download,
  ArrowUpRight,
} from 'lucide-react';
import Link from 'next/link';
import { InventoryTable } from '@/components/dashboard/InventoryTable';

export default async function InventoryPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/dashboard/inventory');
  }

  // Check if user is a dealer
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_dealer')
    .eq('id', user.id)
    .single();

  if (!profile?.is_dealer) {
    redirect('/become-a-dealer');
  }

  // Get all listings with inventory data
  const { data: listings } = await supabase
    .from('listings')
    .select(`
      id,
      title,
      price,
      status,
      stock_number,
      quantity,
      lot_location,
      acquired_date,
      acquisition_cost,
      views_count,
      created_at,
      category:categories(name)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // Calculate inventory stats
  const stats = {
    totalUnits: listings?.reduce((sum, l) => sum + (l.quantity || 1), 0) || 0,
    activeListings: listings?.filter(l => l.status === 'active').length || 0,
    soldListings: listings?.filter(l => l.status === 'sold').length || 0,
    draftListings: listings?.filter(l => l.status === 'draft').length || 0,
    totalValue: listings?.reduce((sum, l) => {
      if (l.status === 'active' && l.price) {
        return sum + (l.price * (l.quantity || 1));
      }
      return sum;
    }, 0) || 0,
    totalCost: listings?.reduce((sum, l) => {
      if (l.acquisition_cost) {
        return sum + (l.acquisition_cost * (l.quantity || 1));
      }
      return sum;
    }, 0) || 0,
  };

  // Calculate potential profit
  const potentialProfit = stats.totalValue - stats.totalCost;

  // Find listings with long days on lot (over 90 days)
  const longDaysOnLot = listings?.filter(l => {
    if (l.status !== 'active') return false;
    const days = Math.floor(
      (Date.now() - new Date(l.acquired_date || l.created_at).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    return days > 90;
  }).length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground mt-1">
            Track stock levels, costs, and profitability
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button size="sm" asChild>
            <Link href="/dashboard/listings/new">
              <Plus className="w-4 h-4 mr-2" />
              Add Inventory
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Units"
          value={stats.totalUnits}
          icon={<Package className="w-5 h-5" />}
          description={`${stats.activeListings} active listings`}
        />
        <StatCard
          title="Inventory Value"
          value={`$${stats.totalValue.toLocaleString()}`}
          icon={<DollarSign className="w-5 h-5" />}
          description="Active listings"
        />
        <StatCard
          title="Potential Profit"
          value={`$${potentialProfit.toLocaleString()}`}
          icon={<Warehouse className="w-5 h-5" />}
          description="Value minus cost"
          highlight={potentialProfit > 0}
        />
        <StatCard
          title="Aging Inventory"
          value={longDaysOnLot}
          icon={<AlertTriangle className="w-5 h-5" />}
          description="Over 90 days"
          warning={longDaysOnLot > 0}
        />
      </div>

      {/* Status Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatusCard label="Active" count={stats.activeListings} color="green" />
        <StatusCard label="Draft" count={stats.draftListings} color="yellow" />
        <StatusCard label="Sold" count={stats.soldListings} color="blue" />
        <StatusCard
          label="Total"
          count={listings?.length || 0}
          color="gray"
        />
      </div>

      {/* Inventory Table */}
      {listings && listings.length > 0 ? (
        <InventoryTable listings={listings} />
      ) : (
        <Card>
          <CardContent className="py-16">
            <div className="text-center">
              <Warehouse className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No inventory yet</h3>
              <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                Add your first listing to start tracking your inventory.
              </p>
              <Button asChild>
                <Link href="/dashboard/listings/new">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Listing
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  description,
  highlight = false,
  warning = false,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description: string;
  highlight?: boolean;
  warning?: boolean;
}) {
  return (
    <Card
      className={
        warning
          ? 'border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-900/10'
          : highlight
          ? 'border-green-500/50 bg-green-50/50 dark:bg-green-900/10'
          : ''
      }
    >
      <CardContent className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-3">
          <span
            className={
              warning
                ? 'text-yellow-600'
                : highlight
                ? 'text-green-600'
                : 'text-muted-foreground'
            }
          >
            {icon}
          </span>
        </div>
        <p className="text-2xl md:text-3xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

function StatusCard({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: 'green' | 'yellow' | 'blue' | 'gray';
}) {
  const colors = {
    green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    gray: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  };

  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <Badge variant="secondary" className={colors[color]}>
          {label}
        </Badge>
        <span className="text-2xl font-bold">{count}</span>
      </CardContent>
    </Card>
  );
}
