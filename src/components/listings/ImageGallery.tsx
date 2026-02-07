'use client';

import { useState, useCallback, useEffect, useRef, memo } from 'react';
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
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

// Pan position type
interface PanPosition {
  x: number;
  y: number;
}

// Touch swipe hook
function useSwipe(onSwipeLeft: () => void, onSwipeRight: () => void) {
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const minSwipeDistance = 50;

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchEndX.current = null;
    touchStartX.current = e.targetTouches[0].clientX;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!touchStartX.current || !touchEndX.current) return;

    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      onSwipeLeft();
    } else if (isRightSwipe) {
      onSwipeRight();
    }
  }, [onSwipeLeft, onSwipeRight]);

  return { onTouchStart, onTouchMove, onTouchEnd };
}

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

export const ImageGallery = memo(function ImageGallery({ images, title, className }: ImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<PanPosition>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<PanPosition>({ x: 0, y: 0 });
  const lastTapRef = useRef<number>(0);

  const selectedImage = images[selectedIndex];

  // Reset pan when zoom changes to 1 or image changes
  useEffect(() => {
    if (zoom === 1) {
      setPan({ x: 0, y: 0 });
    }
  }, [zoom, selectedIndex]);

  const handlePrevious = useCallback(() => {
    setSelectedIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    setZoom(1);
  }, [images.length]);

  const handleNext = useCallback(() => {
    setSelectedIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    setZoom(1);
  }, [images.length]);

  // Swipe handlers for mobile (must be after handleNext/handlePrevious)
  const swipeHandlers = useSwipe(handleNext, handlePrevious);

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
        case '0':
          setZoom(1);
          setPan({ x: 0, y: 0 });
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
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Double-click/tap to zoom
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (zoom > 1) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    } else {
      setZoom(2);
    }
  }, [zoom]);

  // Handle double tap on touch devices
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap detected
      e.preventDefault();
      if (zoom > 1) {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      } else {
        setZoom(2);
      }
    }
    lastTapRef.current = now;
  }, [zoom]);

  // Pan handlers for dragging zoomed image
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [zoom, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || zoom <= 1) return;
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    // Limit pan to reasonable bounds
    const maxPan = 200 * (zoom - 1);
    setPan({
      x: Math.max(-maxPan, Math.min(maxPan, newX)),
      y: Math.max(-maxPan, Math.min(maxPan, newY)),
    });
  }, [isDragging, dragStart, zoom]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch pan handlers
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (zoom <= 1 || e.touches.length !== 1) return;
    const touch = e.touches[0];
    if (!isDragging) {
      setIsDragging(true);
      setDragStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y });
      return;
    }
    const newX = touch.clientX - dragStart.x;
    const newY = touch.clientY - dragStart.y;
    const maxPan = 200 * (zoom - 1);
    setPan({
      x: Math.max(-maxPan, Math.min(maxPan, newX)),
      y: Math.max(-maxPan, Math.min(maxPan, newY)),
    });
  }, [zoom, isDragging, dragStart, pan]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (zoom > 1 && e.touches.length === 1) {
      const touch = e.touches[0];
      setDragStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y });
    }
  }, [zoom, pan]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title || 'Check out this listing',
          url: window.location.href,
        });
      } catch (err) {
        logger.error('Share failed', { error: err });
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
        <div
          className="relative aspect-[4/3] md:aspect-[16/9] rounded-xl overflow-hidden bg-muted group"
          onTouchStart={swipeHandlers.onTouchStart}
          onTouchMove={swipeHandlers.onTouchMove}
          onTouchEnd={swipeHandlers.onTouchEnd}
        >
          <Image
            src={selectedImage.url}
            alt={title || `Image ${selectedIndex + 1}`}
            fill
            className="object-cover cursor-pointer transition-transform"
            onClick={() => setIsLightboxOpen(true)}
            priority={selectedIndex === 0}
            unoptimized
            draggable={false}
          />

          {/* Navigation arrows */}
          {images.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity h-12 w-12 md:h-10 md:w-10 touch-manipulation"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevious();
                }}
                aria-label="Previous image"
              >
                <ChevronLeft className="w-6 h-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity h-12 w-12 md:h-10 md:w-10 touch-manipulation"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
                aria-label="Next image"
              >
                <ChevronRight className="w-6 h-6" />
              </Button>
            </>
          )}

          {/* Expand button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute bottom-2 right-2 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity h-11 w-11 md:h-9 md:w-9 touch-manipulation"
            onClick={() => setIsLightboxOpen(true)}
            aria-label="Open fullscreen view"
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
                  unoptimized
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

            <div className="flex items-center gap-1 md:gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 h-11 w-11 md:h-10 md:w-10 touch-manipulation"
                onClick={(e) => {
                  e.stopPropagation();
                  handleZoomOut();
                }}
                disabled={zoom <= 0.5}
                aria-label="Zoom out"
              >
                <ZoomOut className="w-5 h-5" />
              </Button>
              <span className="text-white text-sm w-14 md:w-16 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 h-11 w-11 md:h-10 md:w-10 touch-manipulation"
                onClick={(e) => {
                  e.stopPropagation();
                  handleZoomIn();
                }}
                disabled={zoom >= 3}
                aria-label="Zoom in"
              >
                <ZoomIn className="w-5 h-5" />
              </Button>
              {zoom > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/10 h-11 w-11 md:h-10 md:w-10 touch-manipulation"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResetZoom();
                  }}
                  aria-label="Reset zoom"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              )}

              <div className="w-px h-6 bg-white/20 mx-1 md:mx-2 hidden md:block" />

              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 h-11 w-11 md:h-10 md:w-10 touch-manipulation hidden md:flex"
                onClick={(e) => {
                  e.stopPropagation();
                  handleShare();
                }}
                aria-label="Share"
              >
                <Share2 className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 h-11 w-11 md:h-10 md:w-10 touch-manipulation hidden md:flex"
                asChild
                onClick={(e) => e.stopPropagation()}
              >
                <a href={selectedImage.url} download target="_blank" rel="noopener noreferrer" aria-label="Download">
                  <Download className="w-5 h-5" />
                </a>
              </Button>

              <div className="w-px h-6 bg-white/20 mx-1 md:mx-2" />

              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 h-11 w-11 md:h-10 md:w-10 touch-manipulation"
                onClick={() => {
                  setIsLightboxOpen(false);
                  setZoom(1);
                }}
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Main image container */}
          <div
            className={cn(
              "flex-1 flex items-center justify-center overflow-hidden relative",
              zoom > 1 ? "cursor-grab" : "cursor-zoom-in",
              isDragging && "cursor-grabbing"
            )}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={handleDoubleClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={(e) => {
              handleTouchStart(e);
              if (zoom <= 1) swipeHandlers.onTouchStart(e);
            }}
            onTouchMove={(e) => {
              if (zoom > 1) handleTouchMove(e);
              else swipeHandlers.onTouchMove(e);
            }}
            onTouchEnd={(e) => {
              handleTouchEnd(e);
              setIsDragging(false);
              if (zoom <= 1) swipeHandlers.onTouchEnd();
            }}
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
              className={cn(
                "relative max-w-full max-h-full select-none",
                !isDragging && "transition-transform duration-200"
              )}
              style={{
                transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              }}
            >
              <Image
                src={selectedImage.url}
                alt={title || `Image ${selectedIndex + 1}`}
                width={1200}
                height={800}
                className="max-h-[calc(100vh-160px)] w-auto object-contain pointer-events-none"
                draggable={false}
                unoptimized
              />
            </div>

            {/* Keyboard hints */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 text-white/50 text-xs">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[10px]">←→</kbd> navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[10px]">+/-</kbd> zoom
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[10px]">dbl-click</kbd> zoom
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[10px]">esc</kbd> close
              </span>
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
                    unoptimized
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
});
