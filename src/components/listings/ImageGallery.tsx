'use client';

import { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft,
  ChevronRight,
  X,
  ZoomIn,
  ZoomOut,
  Download,
  Share2,
  Expand,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageItem {
  id: string;
  url: string;
  thumbnail_url?: string;
  is_primary?: boolean;
}

interface ImageGalleryProps {
  images: ImageItem[];
  title?: string;
  className?: string;
}

export function ImageGallery({ images, title, className }: ImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  const selectedImage = images[selectedIndex];

  const handlePrevious = useCallback(() => {
    setSelectedIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    setZoom(1);
  }, [images.length]);

  const handleNext = useCallback(() => {
    setSelectedIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    setZoom(1);
  }, [images.length]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isLightboxOpen) return;

      switch (e.key) {
        case 'ArrowLeft':
          handlePrevious();
          break;
        case 'ArrowRight':
          handleNext();
          break;
        case 'Escape':
          setIsLightboxOpen(false);
          setZoom(1);
          break;
        case '+':
        case '=':
          setZoom((prev) => Math.min(prev + 0.5, 3));
          break;
        case '-':
          setZoom((prev) => Math.max(prev - 0.5, 0.5));
          break;
      }
    },
    [isLightboxOpen, handlePrevious, handleNext]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    if (isLightboxOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isLightboxOpen]);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.5, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.5, 0.5));

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title || 'Check out this listing',
          url: window.location.href,
        });
      } catch (err) {
        console.error('Share failed:', err);
      }
    }
  };

  if (!images || images.length === 0) {
    return (
      <div className={cn('aspect-[4/3] bg-muted rounded-xl flex items-center justify-center', className)}>
        <span className="text-muted-foreground">No images available</span>
      </div>
    );
  }

  return (
    <>
      <div className={cn('space-y-3', className)}>
        {/* Main Image */}
        <div className="relative aspect-[4/3] md:aspect-[16/9] rounded-xl overflow-hidden bg-muted group">
          <Image
            src={selectedImage.url}
            alt={title || `Image ${selectedIndex + 1}`}
            fill
            className="object-cover cursor-pointer transition-transform"
            onClick={() => setIsLightboxOpen(true)}
            priority={selectedIndex === 0}
          />

          {/* Navigation arrows */}
          {images.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevious();
                }}
              >
                <ChevronLeft className="w-6 h-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
              >
                <ChevronRight className="w-6 h-6" />
              </Button>
            </>
          )}

          {/* Expand button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute bottom-2 right-2 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => setIsLightboxOpen(true)}
          >
            <Expand className="w-5 h-5" />
          </Button>

          {/* Image counter */}
          {images.length > 1 && (
            <Badge className="absolute bottom-2 left-2 bg-black/50 text-white">
              {selectedIndex + 1} / {images.length}
            </Badge>
          )}
        </div>

        {/* Thumbnail strip */}
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {images.map((image, index) => (
              <button
                key={image.id}
                onClick={() => setSelectedIndex(index)}
                className={cn(
                  'relative flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden border-2 transition-all',
                  selectedIndex === index
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-transparent hover:border-muted-foreground/30'
                )}
              >
                <Image
                  src={image.thumbnail_url || image.url}
                  alt={`Thumbnail ${index + 1}`}
                  fill
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col"
          onClick={() => {
            setIsLightboxOpen(false);
            setZoom(1);
          }}
        >
          {/* Lightbox header */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {selectedIndex + 1} / {images.length}
              </Badge>
              {title && (
                <span className="text-white text-sm hidden md:block truncate max-w-md">
                  {title}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10"
                onClick={(e) => {
                  e.stopPropagation();
                  handleZoomOut();
                }}
                disabled={zoom <= 0.5}
              >
                <ZoomOut className="w-5 h-5" />
              </Button>
              <span className="text-white text-sm w-16 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10"
                onClick={(e) => {
                  e.stopPropagation();
                  handleZoomIn();
                }}
                disabled={zoom >= 3}
              >
                <ZoomIn className="w-5 h-5" />
              </Button>

              <div className="w-px h-6 bg-white/20 mx-2" />

              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10"
                onClick={(e) => {
                  e.stopPropagation();
                  handleShare();
                }}
              >
                <Share2 className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10"
                asChild
                onClick={(e) => e.stopPropagation()}
              >
                <a href={selectedImage.url} download target="_blank" rel="noopener noreferrer">
                  <Download className="w-5 h-5" />
                </a>
              </Button>

              <div className="w-px h-6 bg-white/20 mx-2" />

              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10"
                onClick={() => {
                  setIsLightboxOpen(false);
                  setZoom(1);
                }}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Main image container */}
          <div
            className="flex-1 flex items-center justify-center overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Navigation arrows */}
            {images.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white w-12 h-12"
                  onClick={handlePrevious}
                >
                  <ChevronLeft className="w-8 h-8" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white w-12 h-12"
                  onClick={handleNext}
                >
                  <ChevronRight className="w-8 h-8" />
                </Button>
              </>
            )}

            {/* Image */}
            <div
              className="relative max-w-full max-h-full transition-transform duration-200"
              style={{
                transform: `scale(${zoom})`,
              }}
            >
              <Image
                src={selectedImage.url}
                alt={title || `Image ${selectedIndex + 1}`}
                width={1200}
                height={800}
                className="max-h-[calc(100vh-160px)] w-auto object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div
              className="p-4 flex justify-center gap-2 overflow-x-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {images.map((image, index) => (
                <button
                  key={image.id}
                  onClick={() => {
                    setSelectedIndex(index);
                    setZoom(1);
                  }}
                  className={cn(
                    'relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all',
                    selectedIndex === index
                      ? 'border-white ring-2 ring-white/30'
                      : 'border-transparent opacity-50 hover:opacity-100'
                  )}
                >
                  <Image
                    src={image.thumbnail_url || image.url}
                    alt={`Thumbnail ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
