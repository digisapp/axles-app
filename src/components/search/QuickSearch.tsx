'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Search,
  Truck,
  Container,
  Tractor,
  LayoutDashboard,
  Package,
  Users,
  Heart,
  TrendingUp,
  Settings,
  Plus,
  History,
  Sparkles,
} from 'lucide-react';

interface QuickSearchProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const CATEGORIES = [
  { name: 'Trucks', slug: 'trucks', icon: Truck },
  { name: 'Trailers', slug: 'trailers', icon: Container },
  { name: 'Heavy Equipment', slug: 'heavy-equipment', icon: Tractor },
];

const QUICK_LINKS = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'My Listings', href: '/dashboard/listings', icon: Package },
  { name: 'Leads', href: '/dashboard/leads', icon: Users },
  { name: 'Favorites', href: '/dashboard/favorites', icon: Heart },
  { name: 'Analytics', href: '/dashboard/analytics', icon: TrendingUp },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

const RECENT_SEARCHES_KEY = 'axles_recent_searches';
const MAX_RECENT_SEARCHES = 5;

export function QuickSearch({ open, onOpenChange }: QuickSearchProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Sync with controlled state
  const dialogOpen = open !== undefined ? open : isOpen;
  const setDialogOpen = onOpenChange || setIsOpen;

  // Load recent searches from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (stored) {
      try {
        setRecentSearches(JSON.parse(stored));
      } catch {
        // Invalid JSON, ignore
      }
    }
  }, []);

  // Save search to recent
  const saveRecentSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setRecentSearches((prev) => {
      const filtered = prev.filter((s) => s.toLowerCase() !== searchQuery.toLowerCase());
      const updated = [searchQuery, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Handle keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setDialogOpen(!dialogOpen);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [dialogOpen, setDialogOpen]);

  // Perform search
  const handleSearch = (searchQuery: string = query) => {
    if (!searchQuery.trim()) return;

    saveRecentSearch(searchQuery);
    setDialogOpen(false);
    setQuery('');
    router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
  };

  // Navigate to page
  const handleNavigate = (href: string) => {
    setDialogOpen(false);
    setQuery('');
    router.push(href);
  };

  // Search by category
  const handleCategorySearch = (slug: string) => {
    setDialogOpen(false);
    setQuery('');
    router.push(`/search?category=${slug}`);
  };

  return (
    <CommandDialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <CommandInput
        placeholder="Search trucks, trailers, or type a command..."
        value={query}
        onValueChange={setQuery}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && query.trim()) {
            handleSearch();
          }
        }}
      />
      <CommandList>
        <CommandEmpty>
          {query ? (
            <div className="py-4">
              <p className="text-muted-foreground mb-2">No results found</p>
              <button
                onClick={() => handleSearch()}
                className="inline-flex items-center gap-2 text-primary hover:underline"
              >
                <Sparkles className="w-4 h-4" />
                Search for &quot;{query}&quot; with AI
              </button>
            </div>
          ) : (
            <p>Start typing to search...</p>
          )}
        </CommandEmpty>

        {/* Recent Searches */}
        {recentSearches.length > 0 && !query && (
          <CommandGroup heading="Recent Searches">
            {recentSearches.map((search) => (
              <CommandItem
                key={search}
                value={search}
                onSelect={() => handleSearch(search)}
              >
                <History className="mr-2 h-4 w-4 text-muted-foreground" />
                {search}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Categories */}
        <CommandGroup heading="Categories">
          {CATEGORIES.map((category) => (
            <CommandItem
              key={category.slug}
              value={`category ${category.name}`}
              onSelect={() => handleCategorySearch(category.slug)}
            >
              <category.icon className="mr-2 h-4 w-4" />
              {category.name}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Quick Links */}
        <CommandGroup heading="Quick Links">
          <CommandItem value="new listing" onSelect={() => handleNavigate('/dashboard/listings/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Listing
          </CommandItem>
          {QUICK_LINKS.map((link) => (
            <CommandItem
              key={link.href}
              value={link.name.toLowerCase()}
              onSelect={() => handleNavigate(link.href)}
            >
              <link.icon className="mr-2 h-4 w-4" />
              {link.name}
            </CommandItem>
          ))}
        </CommandGroup>

        {/* Search Suggestions when typing */}
        {query && (
          <CommandGroup heading="Search">
            <CommandItem value={`search ${query}`} onSelect={() => handleSearch()}>
              <Search className="mr-2 h-4 w-4" />
              Search for &quot;{query}&quot;
            </CommandItem>
            <CommandItem value={`ai ${query}`} onSelect={() => handleSearch()}>
              <Sparkles className="mr-2 h-4 w-4" />
              AI Search: &quot;{query}&quot;
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

// Trigger button for the search
export function QuickSearchTrigger() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-muted/50 hover:bg-muted rounded-md border transition-colors"
      >
        <Search className="w-4 h-4" />
        <span className="hidden sm:inline">Quick search...</span>
        <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-background border rounded">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
      <QuickSearch open={open} onOpenChange={setOpen} />
    </>
  );
}
