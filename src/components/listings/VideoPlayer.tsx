'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Video, ExternalLink } from 'lucide-react';

interface VideoPlayerProps {
  videoUrl: string;
  title?: string;
  className?: string;
}

function getVideoEmbedUrl(url: string): { embedUrl: string; platform: string } | null {
  // YouTube patterns
  const youtubePatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of youtubePatterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        embedUrl: `https://www.youtube.com/embed/${match[1]}?rel=0&modestbranding=1`,
        platform: 'YouTube',
      };
    }
  }

  // Vimeo patterns
  const vimeoPattern = /(?:vimeo\.com\/)(\d+)/;
  const vimeoMatch = url.match(vimeoPattern);
  if (vimeoMatch) {
    return {
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}?title=0&byline=0&portrait=0`,
      platform: 'Vimeo',
    };
  }

  return null;
}

export function VideoPlayer({ videoUrl, title, className }: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoInfo = getVideoEmbedUrl(videoUrl);

  if (!videoInfo) {
    // If we can't embed, just show a link
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Video className="w-5 h-5 text-primary" />
            Video Walkaround
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full" asChild>
            <a href={videoUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" />
              Watch Video
            </a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Video className="w-5 h-5 text-primary" />
          Video Walkaround
          <span className="text-xs font-normal text-muted-foreground ml-auto">
            {videoInfo.platform}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isPlaying ? (
          <div className="relative w-full aspect-video">
            <iframe
              src={videoInfo.embedUrl}
              title={title || 'Video Walkaround'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full rounded-b-lg"
            />
          </div>
        ) : (
          <button
            onClick={() => setIsPlaying(true)}
            className="relative w-full aspect-video bg-muted rounded-b-lg overflow-hidden group cursor-pointer"
          >
            {/* Thumbnail placeholder */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <div className="p-4 rounded-full bg-primary/90 group-hover:bg-primary group-hover:scale-110 transition-all shadow-lg">
                <Play className="w-8 h-8 text-white ml-1" />
              </div>
            </div>
            <p className="absolute bottom-4 left-4 text-sm font-medium text-foreground/80">
              Click to play video
            </p>
          </button>
        )}
      </CardContent>
    </Card>
  );
}

// Simple inline video indicator for search results
export function VideoIndicator() {
  return (
    <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
      <Video className="w-3 h-3" />
      Video
    </div>
  );
}
