import React, { useState } from 'react';
import { Share2, Heart, Info, Play } from 'lucide-react';
import { YouTubeVideo } from '../types';
import { cn } from '../lib/utils';

interface YouTubePlayerProps {
  video: YouTubeVideo;
  isActive: boolean;
}

export default function YouTubePlayer({ video, isActive }: YouTubePlayerProps) {
  const [isFavorited, setIsFavorited] = useState(false);
  const [isStarted, setIsStarted] = useState(false);

  const getYouTubeId = (url: string) => {
    if (!url) return '';
    try {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = url.match(regExp);
      return (match && match[2].length === 11) ? match[2] : url.split('/').pop() || '';
    } catch {
      return '';
    }
  };

  const videoId = getYouTubeId(video.youtube_url);

  // Management of autoplay and looping via URL params
  const videoSrc = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&controls=1&modestbranding=1&rel=0&iv_load_policy=3&enablejsapi=1&loop=1&playlist=${videoId}`;

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: video.title,
        text: video.description,
        url: video.youtube_url,
      }).catch(() => {});
    }
  };

  return (
    <div className="relative w-full h-full bg-[#111] flex flex-col overflow-hidden">
      {/* Video Container */}
      <div className="w-full h-full relative bg-black flex items-center justify-center overflow-hidden">
        {isActive && videoId ? (
          <iframe
            key={video.id}
            src={videoSrc}
            className="w-full h-full border-none"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            title={video.title}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900 group">
             {video.thumbnail_url ? (
               <img src={video.thumbnail_url} className="absolute inset-0 w-full h-full object-cover opacity-60" alt="" />
             ) : (
               <div className="absolute inset-0 bg-neutral-900" />
             )}
             {(!isActive || !videoId) && <Play size={48} className="text-white/50 relative z-10" />}
          </div>
        )}
      </div>
    </div>
  );
}
