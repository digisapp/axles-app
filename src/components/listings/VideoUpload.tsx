'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Video,
  Upload,
  X,
  Link as LinkIcon,
  Loader2,
  Play,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoUploadProps {
  value?: string;
  onChange: (url: string) => void;
  listingId?: string;
}

const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];

export function VideoUpload({ value, onChange, listingId }: VideoUploadProps) {
  const [mode, setMode] = useState<'url' | 'upload'>('url');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(value || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const handleUrlChange = (url: string) => {
    onChange(url);
    setPreviewUrl(url);
    setError(null);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Please upload a valid video file (MP4, WebM, MOV, or AVI)');
      return;
    }

    // Validate file size
    if (file.size > MAX_VIDEO_SIZE) {
      setError('Video must be less than 100MB');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Generate unique filename
      const ext = file.name.split('.').pop();
      const fileName = `${listingId || 'temp'}-${Date.now()}.${ext}`;
      const filePath = `videos/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError, data } = await supabase.storage
        .from('listings')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('listings')
        .getPublicUrl(filePath);

      const videoUrl = urlData.publicUrl;
      onChange(videoUrl);
      setPreviewUrl(videoUrl);
      setUploadProgress(100);
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload video. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    // If it's an uploaded video, try to delete it
    if (previewUrl && previewUrl.includes('supabase')) {
      try {
        const path = previewUrl.split('/listings/')[1];
        if (path) {
          await supabase.storage.from('listings').remove([path]);
        }
      } catch (err) {
        console.error('Delete error:', err);
      }
    }

    onChange('');
    setPreviewUrl(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Check if URL is YouTube/Vimeo
  const isEmbeddable = (url: string) => {
    return url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com');
  };

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === 'url' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('url')}
          className="flex-1"
        >
          <LinkIcon className="w-4 h-4 mr-2" />
          YouTube/Vimeo URL
        </Button>
        <Button
          type="button"
          variant={mode === 'upload' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('upload')}
          className="flex-1"
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload Video
        </Button>
      </div>

      {/* URL Input Mode */}
      {mode === 'url' && (
        <div>
          <Label htmlFor="video_url">Video URL</Label>
          <Input
            id="video_url"
            placeholder="https://www.youtube.com/watch?v=... or https://vimeo.com/..."
            value={value || ''}
            onChange={(e) => handleUrlChange(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Paste a YouTube or Vimeo video link
          </p>
        </div>
      )}

      {/* Upload Mode */}
      {mode === 'upload' && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
            onChange={handleFileSelect}
            className="hidden"
          />

          {!previewUrl && !isUploading && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed rounded-xl p-8 text-center hover:border-primary/50 hover:bg-muted/50 transition-colors"
            >
              <Video className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium">Click to upload video</p>
              <p className="text-sm text-muted-foreground mt-1">
                MP4, WebM, MOV, or AVI (max 100MB)
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Recommended: 30-60 second walk-around
              </p>
            </button>
          )}

          {isUploading && (
            <div className="border-2 border-dashed rounded-xl p-8 text-center">
              <Loader2 className="w-10 h-10 mx-auto mb-3 text-primary animate-spin" />
              <p className="font-medium">Uploading video...</p>
              <Progress value={uploadProgress} className="mt-4 max-w-xs mx-auto" />
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Preview */}
      {previewUrl && !isUploading && (
        <div className="relative">
          <div className="aspect-video bg-muted rounded-lg overflow-hidden">
            {isEmbeddable(previewUrl) ? (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                <div className="text-center">
                  <Play className="w-12 h-12 mx-auto mb-2 text-primary" />
                  <p className="text-sm text-muted-foreground">
                    {previewUrl.includes('youtube') ? 'YouTube' : 'Vimeo'} video linked
                  </p>
                </div>
              </div>
            ) : (
              <video
                src={previewUrl}
                controls
                className="w-full h-full object-contain"
                preload="metadata"
              />
            )}
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 p-1.5 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tips */}
      {!previewUrl && (
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-sm font-medium mb-2">Video Tips</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>Keep it short (30-60 seconds)</li>
            <li>Show exterior walk-around, interior, and engine</li>
            <li>Good lighting makes a big difference</li>
            <li>Landscape orientation works best</li>
          </ul>
        </div>
      )}
    </div>
  );
}
