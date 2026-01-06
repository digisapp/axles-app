'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Bell,
  BellOff,
  Loader2,
  Search,
  Trash2,
  ExternalLink,
  Clock,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface SavedSearch {
  id: string;
  name: string;
  query: string | null;
  filters: Record<string, unknown>;
  notify_email: boolean;
  notify_frequency: string;
  new_matches_count: number;
  created_at: string;
  last_notified_at: string | null;
}

export default function AlertsPage() {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSearches = async () => {
    setIsLoading(true);
    const response = await fetch('/api/saved-searches');
    if (response.ok) {
      const data = await response.json();
      setSearches(data.searches || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchSearches();
  }, []);

  const toggleNotify = async (id: string, notify_email: boolean) => {
    const response = await fetch(`/api/saved-searches/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notify_email }),
    });

    if (response.ok) {
      setSearches((prev) =>
        prev.map((s) => (s.id === id ? { ...s, notify_email } : s))
      );
    }
  };

  const deleteSearch = async (id: string) => {
    const response = await fetch(`/api/saved-searches/${id}`, {
      method: 'DELETE',
    });

    if (response.ok) {
      setSearches((prev) => prev.filter((s) => s.id !== id));
    }
  };

  const buildSearchUrl = (search: SavedSearch) => {
    const params = new URLSearchParams();
    if (search.query) params.set('q', search.query);
    const filters = search.filters || {};
    if (filters.category) params.set('category', String(filters.category));
    if (filters.minPrice) params.set('minPrice', String(filters.minPrice));
    if (filters.maxPrice) params.set('maxPrice', String(filters.maxPrice));
    if (filters.make) params.set('make', String(filters.make));
    if (filters.state) params.set('state', String(filters.state));
    return `/search?${params.toString()}`;
  };

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case 'instant': return 'Instant';
      case 'daily': return 'Daily';
      case 'weekly': return 'Weekly';
      default: return freq;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Saved Searches</h1>
        <p className="text-muted-foreground">
          Get notified when new listings match your criteria
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : searches.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No saved searches yet</h3>
            <p className="text-muted-foreground mb-4">
              Save a search to get notified when new listings match your criteria
            </p>
            <Link href="/search">
              <Button>
                <Search className="w-4 h-4 mr-2" />
                Start Searching
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {searches.map((search) => (
            <Card key={search.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold">{search.name}</h3>
                      {search.new_matches_count > 0 && (
                        <Badge className="bg-green-500">
                          {search.new_matches_count} new
                        </Badge>
                      )}
                      <Badge variant="outline">
                        {getFrequencyLabel(search.notify_frequency)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Created {formatDistanceToNow(new Date(search.created_at), { addSuffix: true })}
                      </span>
                      {search.last_notified_at && (
                        <span>
                          Last notified {formatDistanceToNow(new Date(search.last_notified_at), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {search.notify_email ? (
                        <Bell className="w-4 h-4 text-primary" />
                      ) : (
                        <BellOff className="w-4 h-4 text-muted-foreground" />
                      )}
                      <Switch
                        checked={search.notify_email}
                        onCheckedChange={(checked) => toggleNotify(search.id, checked)}
                      />
                    </div>

                    <Link href={buildSearchUrl(search)} target="_blank">
                      <Button variant="outline" size="sm">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        View
                      </Button>
                    </Link>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteSearch(search.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
