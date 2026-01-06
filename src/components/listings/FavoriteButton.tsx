'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Heart, Loader2 } from 'lucide-react';

interface FavoriteButtonProps {
  listingId: string;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showText?: boolean;
}

export function FavoriteButton({
  listingId,
  variant = 'ghost',
  size = 'sm',
  showText = true,
}: FavoriteButtonProps) {
  const router = useRouter();
  const [isFavorited, setIsFavorited] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const checkFavorite = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data } = await supabase
        .from('favorites')
        .select('listing_id')
        .eq('user_id', user.id)
        .eq('listing_id', listingId)
        .single();

      setIsFavorited(!!data);
      setIsLoading(false);
    };

    checkFavorite();
  }, [listingId, supabase]);

  const handleToggle = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push(`/login?redirect=/listing/${listingId}`);
      return;
    }

    setIsToggling(true);

    try {
      if (isFavorited) {
        // Remove favorite
        const response = await fetch(`/api/favorites?listing_id=${listingId}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          setIsFavorited(false);
        }
      } else {
        // Add favorite
        const response = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listing_id: listingId }),
        });

        if (response.ok) {
          setIsFavorited(true);
        }
      }
    } catch (error) {
      console.error('Favorite toggle error:', error);
    } finally {
      setIsToggling(false);
    }
  };

  if (isLoading) {
    return (
      <Button variant={variant} size={size} disabled>
        <Loader2 className="w-4 h-4 animate-spin" />
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleToggle}
      disabled={isToggling}
      className={isFavorited ? 'text-red-500 hover:text-red-600' : ''}
    >
      {isToggling ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Heart
          className={`w-4 h-4 ${showText ? 'mr-2' : ''} ${isFavorited ? 'fill-current' : ''}`}
        />
      )}
      {showText && (isFavorited ? 'Saved' : 'Save')}
    </Button>
  );
}
