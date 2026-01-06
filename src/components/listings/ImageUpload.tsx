'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  X,
  Star,
  Loader2,
  ImageIcon,
  GripVertical,
  Sparkles,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';

interface AIAnalysis {
  detected_type?: string;
  detected_make?: string;
  detected_model?: string;
  damage_detected: boolean;
  damage_areas?: string[];
  quality_score: number;
  suggested_tags: string[];
  is_valid_equipment_photo: boolean;
}

interface UploadedImage {
  id?: string;
  url: string;
  thumbnail_url?: string;
  is_primary: boolean;
  sort_order: number;
  file?: File;
  uploading?: boolean;
  ai_analysis?: AIAnalysis;
  analyzing?: boolean;
}

interface ImageUploadProps {
  listingId?: string;
  images: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  onAIDetection?: (data: { make?: string; model?: string; type?: string; tags?: string[] }) => void;
  maxImages?: number;
}

export function ImageUpload({
  listingId,
  images,
  onChange,
  onAIDetection,
  maxImages = 20,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const supabase = createClient();

  // Analyze image with AI
  const analyzeImageWithAI = async (imageUrl: string, imageIndex: number) => {
    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      });

      if (response.ok) {
        const { data } = await response.json();

        // Update image with analysis
        onChange(images.map((img, idx) =>
          idx === imageIndex
            ? { ...img, ai_analysis: data, analyzing: false }
            : img
        ));

        // If this is the first image and we have detections, notify parent
        if (imageIndex === 0 && onAIDetection) {
          onAIDetection({
            make: data.detected_make,
            model: data.detected_model,
            type: data.detected_type,
            tags: data.suggested_tags,
          });
        }
      }
    } catch (error) {
      console.error('AI analysis failed:', error);
      onChange(images.map((img, idx) =>
        idx === imageIndex ? { ...img, analyzing: false } : img
      ));
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error } = await supabase.storage
      .from('listing-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('listing-images')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const remainingSlots = maxImages - images.length;
    const filesToUpload = fileArray.slice(0, remainingSlots);

    if (filesToUpload.length === 0) return;

    // Add temporary preview images
    const newImages: UploadedImage[] = filesToUpload.map((file, index) => ({
      url: URL.createObjectURL(file),
      is_primary: images.length === 0 && index === 0,
      sort_order: images.length + index,
      file,
      uploading: true,
    }));

    onChange([...images, ...newImages]);
    setUploadingCount(filesToUpload.length);

    // Upload each file sequentially and update state
    let currentImages = [...images, ...newImages];

    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      const url = await uploadImage(file);

      if (url) {
        const targetIndex = images.length + i;
        if (currentImages[targetIndex]) {
          URL.revokeObjectURL(currentImages[targetIndex].url);
          currentImages = currentImages.map((img, idx) =>
            idx === targetIndex
              ? { ...img, url, uploading: false, file: undefined, analyzing: true }
              : img
          );
          onChange(currentImages);

          // Trigger AI analysis for the uploaded image (only first 3 images to save API calls)
          if (targetIndex < 3) {
            analyzeImageWithAI(url, targetIndex);
          }
        }
      }

      setUploadingCount((prev) => prev - 1);
    }
  }, [images, maxImages, onChange, supabase, analyzeImageWithAI]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  const removeImage = useCallback((index: number) => {
    let updated = images.filter((_, i) => i !== index);
    // If we removed the primary image, make the first one primary
    if (images[index]?.is_primary && updated.length > 0) {
      updated = updated.map((img, i) => ({ ...img, is_primary: i === 0 }));
    }
    // Update sort orders
    onChange(updated.map((img, i) => ({ ...img, sort_order: i })));
  }, [images, onChange]);

  const setPrimary = useCallback((index: number) => {
    onChange(images.map((img, i) => ({ ...img, is_primary: i === index })));
  }, [images, onChange]);

  const moveImage = useCallback((fromIndex: number, toIndex: number) => {
    const updated = [...images];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    onChange(updated.map((img, i) => ({ ...img, sort_order: i })));
  }, [images, onChange]);

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center transition-colors
          ${isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50'
          }
          ${images.length >= maxImages ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={handleFileInput}
          className="hidden"
          id="image-upload"
          disabled={images.length >= maxImages}
        />
        <label
          htmlFor="image-upload"
          className="cursor-pointer flex flex-col items-center gap-3"
        >
          <div className="p-4 bg-muted rounded-full">
            <Upload className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">
              {isDragging ? 'Drop images here' : 'Drag and drop images'}
            </p>
            <p className="text-sm text-muted-foreground">
              or click to browse ({images.length}/{maxImages} images)
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            JPEG, PNG, WebP or GIF up to 10MB each
          </p>
        </label>
      </div>

      {/* Image Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {images.map((image, index) => (
            <div
              key={image.url}
              className={`
                relative aspect-[4/3] rounded-lg overflow-hidden bg-muted group
                ${image.is_primary ? 'ring-2 ring-primary' : ''}
              `}
            >
              {image.uploading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : image.analyzing ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted">
                  <Image
                    src={image.url}
                    alt={`Image ${index + 1}`}
                    fill
                    className="object-cover opacity-50"
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
                    <Sparkles className="w-6 h-6 text-primary animate-pulse" />
                    <span className="text-xs text-white mt-1">AI Analyzing...</span>
                  </div>
                </div>
              ) : (
                <Image
                  src={image.url}
                  alt={`Image ${index + 1}`}
                  fill
                  className="object-cover"
                />
              )}

              {/* AI Analysis Badges */}
              {image.ai_analysis && !image.uploading && !image.analyzing && (
                <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1">
                  {image.ai_analysis.damage_detected && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                      <AlertTriangle className="w-3 h-3 mr-0.5" />
                      Damage
                    </Badge>
                  )}
                  {image.ai_analysis.quality_score >= 0.8 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700">
                      <CheckCircle className="w-3 h-3 mr-0.5" />
                      HQ
                    </Badge>
                  )}
                  {image.ai_analysis.detected_make && index === 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700">
                      <Sparkles className="w-3 h-3 mr-0.5" />
                      {image.ai_analysis.detected_make}
                    </Badge>
                  )}
                </div>
              )}

              {/* Overlay Controls */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8"
                  onClick={() => setPrimary(index)}
                  title="Set as primary"
                >
                  <Star className={`w-4 h-4 ${image.is_primary ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="h-8 w-8"
                  onClick={() => removeImage(index)}
                  title="Remove"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Primary Badge */}
              {image.is_primary && (
                <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full font-medium">
                  Primary
                </div>
              )}

              {/* Sort Handle */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="p-1 bg-white/80 rounded cursor-grab">
                  <GripVertical className="w-4 h-4 text-gray-600" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {images.length === 0 && (
        <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
          <ImageIcon className="w-5 h-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No images uploaded yet. Add photos to make your listing stand out!
          </p>
        </div>
      )}
    </div>
  );
}
