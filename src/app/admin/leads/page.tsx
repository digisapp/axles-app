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
  Package,
  Clock,
  PlayCircle,
  MessageSquare,
  TrendingUp,
  DollarSign,
} from 'lucide-react';

export default async function AdminLeadsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/admin/leads');
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

  // Get all leads with listing info
  const { data: leads, count: totalLeads } = await supabase
    .from('leads')
    .select(`
      *,
      listings(id, title, price)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(100);

  // Get stats
  const { count: newLeads } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'new');

  const { count: phoneLeads } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'phone_call');

  const { count: todayLeads } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', new Date().toISOString().split('T')[0]);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-700';
      case 'contacted': return 'bg-yellow-100 text-yellow-700';
      case 'qualified': return 'bg-green-100 text-green-700';
      case 'won': return 'bg-emerald-100 text-emerald-700';
      case 'lost': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getIntentColor = (intent: string | null) => {
    switch (intent) {
      case 'buy': return 'bg-green-100 text-green-700';
      case 'lease': return 'bg-blue-100 text-blue-700';
      case 'rent': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Phone className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Leads</h1>
              <p className="text-sm text-muted-foreground">
                Phone calls and inquiries from potential buyers
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
                <TrendingUp className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-3xl font-bold">{totalLeads || 0}</p>
              <p className="text-sm text-muted-foreground">Total Leads</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <MessageSquare className="w-5 h-5 text-green-500" />
                {(newLeads || 0) > 0 && (
                  <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                    Action needed
                  </Badge>
                )}
              </div>
              <p className="text-3xl font-bold">{newLeads || 0}</p>
              <p className="text-sm text-muted-foreground">New Leads</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Phone className="w-5 h-5 text-purple-500" />
              </div>
              <p className="text-3xl font-bold">{phoneLeads || 0}</p>
              <p className="text-sm text-muted-foreground">Phone Calls</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Clock className="w-5 h-5 text-orange-500" />
              </div>
              <p className="text-3xl font-bold">{todayLeads || 0}</p>
              <p className="text-sm text-muted-foreground">Today</p>
            </CardContent>
          </Card>
        </div>

        {/* Leads List */}
        <Card>
          <CardHeader>
            <CardTitle>All Leads</CardTitle>
            <CardDescription>
              Showing {leads?.length || 0} of {totalLeads || 0} leads
            </CardDescription>
          </CardHeader>
          <CardContent>
            {leads && leads.length > 0 ? (
              <div className="space-y-4">
                {leads.map((lead) => (
                  <div
                    key={lead.id}
                    className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Lead Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">
                            {lead.buyer_name || lead.name || 'Unknown'}
                          </span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(lead.status)}`}>
                            {lead.status}
                          </span>
                          {lead.intent && (
                            <span className={`px-2 py-0.5 text-xs rounded-full ${getIntentColor(lead.intent)}`}>
                              {lead.intent}
                            </span>
                          )}
                          {lead.source === 'phone_call' && (
                            <Badge variant="secondary" className="text-xs">
                              <Phone className="w-3 h-3 mr-1" />
                              Phone
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          {(lead.buyer_phone || lead.phone) && (
                            <a
                              href={`tel:${lead.buyer_phone || lead.phone}`}
                              className="flex items-center gap-1 hover:text-foreground"
                            >
                              <Phone className="w-3 h-3" />
                              {lead.buyer_phone || lead.phone}
                            </a>
                          )}
                          {(lead.buyer_email || lead.email) && (
                            <a
                              href={`mailto:${lead.buyer_email || lead.email}`}
                              className="flex items-center gap-1 hover:text-foreground"
                            >
                              <Mail className="w-3 h-3" />
                              {lead.buyer_email || lead.email}
                            </a>
                          )}
                          {lead.equipment_type && (
                            <span className="flex items-center gap-1">
                              <Package className="w-3 h-3" />
                              {lead.equipment_type}
                            </span>
                          )}
                        </div>

                        {lead.message && (
                          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                            {lead.message}
                          </p>
                        )}

                        {/* Call Recording */}
                        {lead.call_recording_url && (
                          <div className="mt-2 flex items-center gap-2">
                            <a
                              href={lead.call_recording_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-sm text-primary hover:underline"
                            >
                              <PlayCircle className="w-4 h-4" />
                              Play Recording
                            </a>
                            {lead.call_duration_seconds && (
                              <span className="text-xs text-muted-foreground">
                                ({formatDuration(lead.call_duration_seconds)})
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Listing & Time */}
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(lead.created_at).toLocaleDateString()}{' '}
                          {new Date(lead.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {lead.listings && (
                          <Link
                            href={`/listing/${lead.listings.id}`}
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                          >
                            <Package className="w-3 h-3" />
                            {lead.listings.title?.slice(0, 30)}...
                            {lead.listings.price && (
                              <span className="text-muted-foreground">
                                ${lead.listings.price.toLocaleString()}
                              </span>
                            )}
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Phone className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No leads yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Leads from phone calls and inquiries will appear here
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
