import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  Phone,
  User,
  Clock,
  PlayCircle,
  PhoneIncoming,
  PhoneOff,
  CheckCircle,
} from 'lucide-react';

export default async function AdminCallLogsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/admin/calls');
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

  // Get all call logs
  const { data: callLogs, count: totalCalls } = await supabase
    .from('call_logs')
    .select('*', { count: 'exact' })
    .order('started_at', { ascending: false })
    .limit(100);

  // Get stats
  const { count: todayCalls } = await supabase
    .from('call_logs')
    .select('*', { count: 'exact', head: true })
    .gte('started_at', new Date().toISOString().split('T')[0]);

  const { count: callsWithLeads } = await supabase
    .from('call_logs')
    .select('*', { count: 'exact', head: true })
    .not('lead_id', 'is', null);

  // Calculate total call time
  const totalMinutes = callLogs?.reduce((sum, call) => sum + (call.duration_seconds || 0), 0) || 0;

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPhone = (phone: string) => {
    // Format as (XXX) XXX-XXXX if 10+ digits
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 10) {
      const last10 = digits.slice(-10);
      return `(${last10.slice(0, 3)}) ${last10.slice(3, 6)}-${last10.slice(6)}`;
    }
    return phone;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'in_progress':
        return <PhoneIncoming className="w-4 h-4 text-blue-500 animate-pulse" />;
      case 'missed':
        return <PhoneOff className="w-4 h-4 text-red-500" />;
      default:
        return <Phone className="w-4 h-4 text-gray-500" />;
    }
  };

  const getIntentBadge = (intent: string | null) => {
    if (!intent) return null;
    const colors: Record<string, string> = {
      buy: 'bg-green-100 text-green-700',
      lease: 'bg-blue-100 text-blue-700',
      rent: 'bg-purple-100 text-purple-700',
      browsing: 'bg-gray-100 text-gray-600',
    };
    return (
      <span className={`px-2 py-0.5 text-xs rounded-full ${colors[intent] || colors.browsing}`}>
        {intent}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Phone className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Call Logs</h1>
              <p className="text-sm text-muted-foreground">
                All incoming phone calls
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/admin/leads">
                View Leads
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin">
                <Shield className="w-4 h-4 mr-2" />
                Back to Admin
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Phone className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-3xl font-bold">{totalCalls || 0}</p>
              <p className="text-sm text-muted-foreground">Total Calls</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <PhoneIncoming className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-3xl font-bold">{todayCalls || 0}</p>
              <p className="text-sm text-muted-foreground">Today</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle className="w-5 h-5 text-purple-500" />
              </div>
              <p className="text-3xl font-bold">{callsWithLeads || 0}</p>
              <p className="text-sm text-muted-foreground">Converted to Lead</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Clock className="w-5 h-5 text-orange-500" />
              </div>
              <p className="text-3xl font-bold">{Math.round(totalMinutes / 60)}</p>
              <p className="text-sm text-muted-foreground">Total Minutes</p>
            </CardContent>
          </Card>
        </div>

        {/* Call Logs List */}
        <Card>
          <CardHeader>
            <CardTitle>All Calls</CardTitle>
            <CardDescription>
              Showing {callLogs?.length || 0} of {totalCalls || 0} calls
            </CardDescription>
          </CardHeader>
          <CardContent>
            {callLogs && callLogs.length > 0 ? (
              <div className="space-y-3">
                {callLogs.map((call) => (
                  <div
                    key={call.id}
                    className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Call Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {getStatusIcon(call.status)}
                          <a
                            href={`tel:${call.caller_phone}`}
                            className="font-medium hover:text-primary"
                          >
                            {formatPhone(call.caller_phone)}
                          </a>
                          {call.caller_name && (
                            <span className="text-muted-foreground flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {call.caller_name}
                            </span>
                          )}
                          {getIntentBadge(call.intent)}
                          {call.lead_id && (
                            <Badge variant="secondary" className="text-xs">
                              Lead Created
                            </Badge>
                          )}
                        </div>

                        {call.interest && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {call.interest}
                          </p>
                        )}

                        {/* Recording */}
                        {call.recording_url && (
                          <div className="mt-2">
                            <a
                              href={call.recording_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-sm text-primary hover:underline"
                            >
                              <PlayCircle className="w-4 h-4" />
                              Play Recording
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Time & Duration */}
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs text-muted-foreground">
                          {new Date(call.started_at).toLocaleDateString()}{' '}
                          {new Date(call.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="flex items-center gap-1 text-sm">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          {formatDuration(call.duration_seconds)}
                        </span>
                        {call.lead_id && (
                          <Link
                            href={`/admin/leads`}
                            className="text-xs text-primary hover:underline"
                          >
                            View Lead
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
                <p className="text-muted-foreground">No calls yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Incoming calls will appear here
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
