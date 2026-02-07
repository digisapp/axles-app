'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bell, BellRing, Loader2, Check } from 'lucide-react';
import { logger } from '@/lib/logger';

interface SaveSearchButtonProps {
  query?: string;
  filters?: Record<string, unknown>;
  disabled?: boolean;
}

export function SaveSearchButton({ query, filters, disabled }: SaveSearchButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [name, setName] = useState('');
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [frequency, setFrequency] = useState('daily');

  const handleSave = async () => {
    if (!name.trim()) return;

    setIsSaving(true);

    try {
      const response = await fetch('/api/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          query,
          filters,
          notify_email: notifyEmail,
          notify_frequency: frequency,
        }),
      });

      if (response.ok) {
        setIsSaved(true);
        setTimeout(() => {
          setIsOpen(false);
          setIsSaved(false);
          setName('');
        }, 1500);
      }
    } catch (error) {
      logger.error('Save search error', { error });
    } finally {
      setIsSaving(false);
    }
  };

  // Generate default name from query/filters
  const getDefaultName = () => {
    if (query) return query;
    const parts: string[] = [];
    if (filters?.make) parts.push(String(filters.make));
    if (filters?.model) parts.push(String(filters.model));
    if (filters?.category) parts.push(String(filters.category));
    return parts.join(' ') || 'My Search';
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => setName(getDefaultName())}
        >
          <Bell className="w-4 h-4 mr-2" />
          Save Search
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="w-5 h-5" />
            Save This Search
          </DialogTitle>
          <DialogDescription>
            Get notified when new listings match your search criteria.
          </DialogDescription>
        </DialogHeader>

        {isSaved ? (
          <div className="py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <p className="font-medium">Search Saved!</p>
            <p className="text-sm text-muted-foreground mt-1">
              We&apos;ll notify you when new matches appear.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="name">Search Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Peterbilt trucks in Texas"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive alerts for new matches
                  </p>
                </div>
                <Switch
                  checked={notifyEmail}
                  onCheckedChange={setNotifyEmail}
                />
              </div>

              {notifyEmail && (
                <div>
                  <Label>Notification Frequency</Label>
                  <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instant">Instant (per listing)</SelectItem>
                      <SelectItem value="daily">Daily digest</SelectItem>
                      <SelectItem value="weekly">Weekly digest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!name.trim() || isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Search
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
