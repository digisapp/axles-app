import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  Phone,
  Mail,
  User,
  Truck,
  Clock,
  Calendar,
  RefreshCw,
  CheckCircle,
  XCircle,
  MessageSquare,
  DollarSign,
  ArrowRight,
} from 'lucide-react';
import { TradeInActions } from './TradeInActions';

export default async function AdminTradeInsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/admin/trade-ins');
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

  // Get all trade-in requests
  const { data: tradeIns, count: totalTradeIns } = await supabase
    .from('trade_in_requests')
    .select(`
      *,
      interested_listing:listings(id, title, price),
      interested_category:categories(id, name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(100);

  // Get stats
  const { count: pendingCount } = await supabase
    .from('trade_in_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  const { count: contactedCount } = await supabase
    .from('trade_in_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'contacted');

  const { count: todayCount } = await supabase
    .from('trade_in_requests')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', new Date().toISOString().split('T')[0]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'contacted': return 'bg-blue-100 text-blue-700';
      case 'offered': return 'bg-purple-100 text-purple-700';
      case 'accepted': return 'bg-green-100 text-green-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      case 'completed': return 'bg-emerald-100 text-emerald-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getConditionColor = (condition: string | null) => {
    switch (condition) {
      case 'excellent': return 'bg-green-100 text-green-700';
      case 'good': return 'bg-blue-100 text-blue-700';
      case 'fair': return 'bg-yellow-100 text-yellow-700';
      case 'poor': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Trade-In Requests</h1>
              <p className="text-sm text-muted-foreground">
                Manage trade-in submissions and send valuations
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
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <RefreshCw className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-3xl font-bold">{totalTradeIns || 0}</p>
              <p className="text-sm text-muted-foreground">Total Requests</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Clock className="w-5 h-5 text-yellow-500" />
                {(pendingCount || 0) > 0 && (
                  <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-300">
                    Action needed
                  </Badge>
                )}
              </div>
              <p className="text-3xl font-bold">{pendingCount || 0}</p>
              <p className="text-sm text-muted-foreground">Pending Review</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <MessageSquare className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-3xl font-bold">{contactedCount || 0}</p>
              <p className="text-sm text-muted-foreground">Contacted</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Calendar className="w-5 h-5 text-orange-500" />
              </div>
              <p className="text-3xl font-bold">{todayCount || 0}</p>
              <p className="text-sm text-muted-foreground">Today</p>
            </CardContent>
          </Card>
        </div>

        {/* Trade-In List */}
        <Card>
          <CardHeader>
            <CardTitle>All Trade-In Requests</CardTitle>
            <CardDescription>
              Showing {tradeIns?.length || 0} of {totalTradeIns || 0} requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tradeIns && tradeIns.length > 0 ? (
              <div className="space-y-4">
                {tradeIns.map((tradeIn) => (
                  <div
                    key={tradeIn.id}
                    className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      {/* Trade-In Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Truck className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">
                            {[tradeIn.equipment_year, tradeIn.equipment_make, tradeIn.equipment_model]
                              .filter(Boolean)
                              .join(' ') || 'Unknown Equipment'}
                          </span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(tradeIn.status)}`}>
                            {tradeIn.status}
                          </span>
                          {tradeIn.equipment_condition && (
                            <span className={`px-2 py-0.5 text-xs rounded-full capitalize ${getConditionColor(tradeIn.equipment_condition)}`}>
                              {tradeIn.equipment_condition}
                            </span>
                          )}
                        </div>

                        {/* Contact Info */}
                        <div className="flex items-center gap-2 mb-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{tradeIn.contact_name}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          {tradeIn.contact_phone && (
                            <a
                              href={`tel:${tradeIn.contact_phone}`}
                              className="flex items-center gap-1 hover:text-foreground"
                            >
                              <Phone className="w-3 h-3" />
                              {tradeIn.contact_phone}
                            </a>
                          )}
                          {tradeIn.contact_email && (
                            <a
                              href={`mailto:${tradeIn.contact_email}`}
                              className="flex items-center gap-1 hover:text-foreground"
                            >
                              <Mail className="w-3 h-3" />
                              {tradeIn.contact_email}
                            </a>
                          )}
                          {tradeIn.equipment_mileage && (
                            <span className="flex items-center gap-1">
                              {tradeIn.equipment_mileage.toLocaleString()} miles
                            </span>
                          )}
                          {tradeIn.equipment_hours && (
                            <span className="flex items-center gap-1">
                              {tradeIn.equipment_hours.toLocaleString()} hours
                            </span>
                          )}
                        </div>

                        {tradeIn.equipment_description && (
                          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                            {tradeIn.equipment_description}
                          </p>
                        )}

                        {/* Interest Info */}
                        {(tradeIn.interested_listing || tradeIn.interested_category || tradeIn.purchase_timeline) && (
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                            {tradeIn.interested_listing && (
                              <Link
                                href={`/listing/${tradeIn.interested_listing.id}`}
                                className="text-primary hover:underline flex items-center gap-1"
                              >
                                <ArrowRight className="w-3 h-3" />
                                Interested in: {tradeIn.interested_listing.title?.slice(0, 30)}...
                              </Link>
                            )}
                            {tradeIn.interested_category && (
                              <Badge variant="secondary" className="text-xs">
                                Looking for: {tradeIn.interested_category.name}
                              </Badge>
                            )}
                            {tradeIn.purchase_timeline && (
                              <Badge variant="outline" className="text-xs">
                                Timeline: {tradeIn.purchase_timeline.replace('_', ' ')}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Actions & Time */}
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(tradeIn.created_at).toLocaleDateString()}{' '}
                          {new Date(tradeIn.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>

                        <TradeInActions
                          tradeInId={tradeIn.id}
                          currentStatus={tradeIn.status}
                          contactEmail={tradeIn.contact_email}
                          contactName={tradeIn.contact_name}
                          equipmentInfo={`${tradeIn.equipment_year || ''} ${tradeIn.equipment_make || ''} ${tradeIn.equipment_model || ''}`.trim()}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <RefreshCw className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No trade-in requests yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Trade-in submissions will appear here
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
