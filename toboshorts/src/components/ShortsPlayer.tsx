import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Share2, Heart, Volume2, VolumeX, Play, Pause, Bookmark } from 'lucide-react';
import { ShortVideo } from '../types';
import { cn } from '../lib/utils';

interface ShortsPlayerProps {
  video: ShortVideo;
  isActive: boolean;
  onEnded?: () => void;
}

export default function ShortsPlayer({ video, isActive, onEnded }: ShortsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);

  useEffect(() => {
    const updateFav = () => {
      const saved = JSON.parse(localStorage.getItem('fav_videos') || '[]');
      setIsFavorited(saved.includes(video.id));
    };
    updateFav();
    window.addEventListener('storage', updateFav);
    return () => window.removeEventListener('storage', updateFav);
  }, [video.id]);

  const toggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    const saved = JSON.parse(localStorage.getItem('fav_videos') || '[]');
    let newSaved;
    if (isFavorited) {
      newSaved = saved.filter((id: string) => id !== video.id);
    } else {
      newSaved = [...saved, video.id];
    }
    localStorage.setItem('fav_videos', JSON.stringify(newSaved));
    setIsFavorited(!isFavorited);
  };
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
    if (isActive) {
      const playPromise = videoRef.current?.play();
      if (playPromise !== undefined) {
        playPromise.then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      }
    } else {
      videoRef.current?.pause();
      setIsPlaying(false);
      if (videoRef.current) videoRef.current.currentTime = 0;
    }
  }, [isActive]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
      setShowPlayIcon(true);
      setTimeout(() => setShowPlayIcon(false), 500);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration);
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      navigator.share({
        title: video.title,
        text: video.description,
        url: window.location.href,
      }).catch(() => {});
    }
  };

  return (
    <div 
      className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden select-none"
      onClick={togglePlay}
    >
      {video.video_url ? (
        <video
          ref={videoRef}
          src={video.video_url}
          className={cn("h-full w-full object-cover", hasError && "opacity-0")}
          loop
          muted={isMuted}
          autoPlay
          playsInline
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => {
            if (videoRef.current) {
              videoRef.current.currentTime = 0;
              videoRef.current.play();
            }
          }}
          onError={() => {
            console.error("Video load error for:", video.video_url);
            setHasError(true);
          }}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900">
           <VolumeX size={32} className="text-white/20 mb-2" />
           <p className="text-white/40 text-xs">No video URL provided</p>
        </div>
      )}

      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900 px-8 text-center">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
             <VolumeX size={32} className="text-white/20" />
          </div>
          <h3 className="text-white font-bold mb-1">Video Unavailable</h3>
          <p className="text-white/40 text-xs">This video link might be broken or unsupported in your region.</p>
        </div>
      )}

      {/* Tap Feedback Icon */}
      <AnimatePresence>
        {showPlayIcon && (
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1.5, opacity: 1 }}
            exit={{ scale: 2, opacity: 0 }}
            className="absolute z-20 pointer-events-none"
          >
            {isPlaying ? (
              <div className="bg-black/20 p-4 rounded-full"><Play size={48} className="text-white fill-white" /></div>
            ) : (
              <div className="bg-black/20 p-4 rounded-full"><Pause size={48} className="text-white fill-white" /></div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* TikTok Style Overlay - Right Side Actions */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-6 z-10">
        <button 
          onClick={toggleFavorite}
          className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
        >
          <div className={cn(
            "p-2.5 rounded-full transition-colors drop-shadow-lg",
            isFavorited ? "text-brand" : "text-white"
          )}>
            <Heart size={36} fill={isFavorited ? "currentColor" : "none"} strokeWidth={2.5} />
          </div>
          <span className="text-[11px] font-bold text-white drop-shadow-md">Favorite</span>
        </button>

        <button 
          onClick={handleShare}
          className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
        >
          <div className="p-2.5 text-white drop-shadow-lg">
            <Share2 size={36} strokeWidth={2.5} />
          </div>
          <span className="text-[11px] font-bold text-white drop-shadow-md">Share</span>
        </button>

        <button 
          onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
          className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
        >
          <div className="p-2.5 text-white drop-shadow-lg">
            {isMuted ? <VolumeX size={36} strokeWidth={2.5} /> : <Volume2 size={36} strokeWidth={2.5} />}
          </div>
          <span className="text-[11px] font-bold text-white drop-shadow-md">{isMuted ? 'Muted' : 'Sound'}</span>
        </button>
      </div>

      {/* Video Content - Bottom Left Corner (TikTok Style) */}
      <div className="absolute bottom-10 left-4 right-20 z-10 pointer-events-none">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-black font-black text-xs shadow-lg">
            {video.category.charAt(0)}
          </div>
          <h3 className="text-white font-bold text-base drop-shadow-sm flex items-center gap-2">
            Kids Central
            <span className="text-[10px] bg-brand text-black font-black px-1.5 py-0.5 rounded shadow-sm">
              {video.category}
            </span>
          </h3>
        </div>
        <h2 className="text-white font-medium text-sm line-clamp-2 mb-2 drop-shadow-sm w-full">
          {video.title}
        </h2>
        {video.description && (
          <div className="flex items-center gap-2 text-white/70 text-[11px]">
            <Bookmark size={12} className="opacity-50" />
            <span className="truncate opacity-80">{video.description.substring(0, 50)}...</span>
          </div>
        )}
      </div>

      {/* Thin Bottom Progress Bar (TikTok Style) */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/20">
        <motion.div 
          className="h-full bg-white"
          initial={{ width: 0 }}
          animate={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : 0 }}
          transition={{ type: 'tween', ease: 'linear', duration: 0.1 }}
        />
      </div>
    </div>
  );
}
