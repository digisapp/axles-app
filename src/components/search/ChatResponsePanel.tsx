'use client';

import { memo } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, X, Calculator, ArrowUpRight, MapPin, Flame, Search } from 'lucide-react';

interface SuggestedListing {
  id: string;
  title: string;
  price: number | null;
  year: number | null;
  make: string | null;
  model: string | null;
  location: string;
  isGoodDeal: boolean;
}

interface ChatResponse {
  response: string;
  suggestedCategory: string | null;
  suggestedTool: {
    name: string;
    url: string;
    description: string;
  } | null;
  suggestedListings: SuggestedListing[] | null;
  inventoryStats: {
    total: number;
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
  } | null;
}

interface ChatResponsePanelProps {
  chatResponse: ChatResponse;
  query: string;
  onClose: () => void;
  getCategoryLabel: (slug: string) => string;
  browseLabel: string;
  searchListingsForLabel: string;
}

export const ChatResponsePanel = memo(function ChatResponsePanel({
  chatResponse,
  query,
  onClose,
  getCategoryLabel,
  browseLabel,
  searchListingsForLabel,
}: ChatResponsePanelProps) {
  const router = useRouter();

  return (
    <div className="absolute top-full left-0 right-0 bg-white dark:bg-zinc-900 border-2 border-t-0 border-primary/50 rounded-b-2xl shadow-lg shadow-primary/10 z-50 overflow-hidden">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">Axlon</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            aria-label="Close AI response"
          >
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        {/* Response */}
        <div className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed">
          {chatResponse.response}
        </div>

        {/* Suggested tool link */}
        {chatResponse.suggestedTool && (
          <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <button
              onClick={() => {
                router.push(chatResponse.suggestedTool!.url);
                onClose();
              }}
              className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
            >
              <Calculator className="w-4 h-4" />
              <span>{chatResponse.suggestedTool.name}</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
            <p className="text-xs text-muted-foreground mt-1 ml-6">
              {chatResponse.suggestedTool.description}
            </p>
          </div>
        )}

        {/* Suggested listings */}
        {chatResponse.suggestedListings && chatResponse.suggestedListings.length > 0 && (
          <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide mb-2">
              Top Matches
            </p>
            <div className="space-y-2" role="list" aria-label="Suggested listings">
              {chatResponse.suggestedListings.map((listing) => (
                <button
                  key={listing.id}
                  onClick={() => {
                    router.push(`/listing/${listing.id}`);
                    onClose();
                  }}
                  className="w-full flex items-start gap-3 p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left"
                  role="listitem"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-sm truncate">{listing.title}</span>
                      {listing.isGoodDeal && (
                        <span className="flex items-center gap-0.5 text-[10px] text-red-500 font-medium">
                          <Flame className="w-3 h-3" />
                          Deal
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span className="font-semibold text-primary">
                        {listing.price ? `$${listing.price.toLocaleString()}` : 'Call'}
                      </span>
                      {listing.location && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="w-3 h-3" />
                          {listing.location}
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-zinc-400 flex-shrink-0 mt-1" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Suggested category link */}
        {chatResponse.suggestedCategory && !chatResponse.suggestedTool && !chatResponse.suggestedListings?.length && (
          <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <button
              onClick={() => {
                router.push(`/search?category=${chatResponse.suggestedCategory}`);
                onClose();
              }}
              className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
            >
              <span>{browseLabel} {getCategoryLabel(chatResponse.suggestedCategory)}</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Search anyway option */}
        <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <button
            onClick={() => {
              router.push(`/search?q=${encodeURIComponent(query)}`);
              onClose();
            }}
            className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span>{searchListingsForLabel} &quot;{query}&quot;</span>
          </button>
        </div>
      </div>
    </div>
  );
});

export type { ChatResponse, SuggestedListing };
