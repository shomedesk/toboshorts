import React, { useEffect, useRef, useState, useCallback } from 'react';
import { fetchVideos, FetchResult, shuffleArray } from '../services/videoService';
import { Video, Category } from '../types';
import ShortsPlayer from './ShortsPlayer';
import YouTubePlayer from './YouTubePlayer';
import { Loader2, Play, Heart, Share2, Info } from 'lucide-react';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface VideoFeedProps {
  mode: 'short' | 'youtube';
  category: Category | 'All' | 'Saved';
  searchQuery: string;
}

// Cache to store videos per mode/category to avoid unnecessary fetches within a session
const sessionCache = new Map<string, { videos: Video[], lastDoc: any, hasMore: boolean }>();

export default function VideoFeed({ mode, category, searchQuery }: VideoFeedProps) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);

  // Algorithm: Category weight based on favorites
  const getWeightedVideos = (vids: Video[]) => {
    if (category !== 'All' || favorites.length === 0 || searchQuery) return vids;
    
    // Advanced: prioritize by category matching favorites
    // We'll use a simple approach: if user has many 'Cartoon' favs, move 'Cartoon' to top
    // Note: To get categories of favorites we'd need to have them loaded. 
    // We can use the current batch to estimate preferences.
    const favSet = new Set(favorites);
    const favInBatch = vids.filter(v => favSet.has(v.id));
    const preferredCategories = new Set(favInBatch.map(v => v.category));
    
    const prioritized = vids.filter(v => preferredCategories.has(v.category) || favSet.has(v.id));
    const others = vids.filter(v => !preferredCategories.has(v.category) && !favSet.has(v.id));
    
    return [...prioritized, ...shuffleArray(others)];
  };

  // Helper to clean unwanted strings from data dynamically (Advanced filter)
  const cleanVideoData = (vid: Video): Video => {
    // List of strings to completely remove from display
    const unwanted = [
      "content creation : all website", 
      "content creation: all website",
      "content creation:all website"
    ];
    
    let cleanDesc = vid.description || '';
    let cleanTitle = vid.title || '';
    
    unwanted.forEach(str => {
      // Case insensitive global replacement
      const regex = new RegExp(str, 'gi');
      cleanDesc = cleanDesc.replace(regex, '');
      cleanTitle = cleanTitle.replace(regex, '');
    });
    
    return { 
      ...vid, 
      description: cleanDesc.trim(), 
      title: cleanTitle.trim() 
    };
  };
  
  useEffect(() => {
    const updateFavs = () => {
      const saved = JSON.parse(localStorage.getItem('fav_videos') || '[]');
      setFavorites(saved);
    };
    updateFavs();
    window.addEventListener('storage', updateFavs);
    return () => window.removeEventListener('storage', updateFavs);
  }, []);
  
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [isComplianceExpanded, setIsComplianceExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const observer = useRef<IntersectionObserver | null>(null);

  const loadInitialVideos = useCallback(async () => {
    const cacheKey = `${mode}-${category}-${searchQuery}`;
    
    // SMART SOLUTION: Use session cache to avoid fetching if we already have it
    if (sessionCache.has(cacheKey) && !searchQuery) {
      const cached = sessionCache.get(cacheKey)!;
      setVideos(cached.videos);
      setLastDoc(cached.lastDoc);
      setHasMore(cached.hasMore);
      if (cached.videos.length > 0) setActiveId(cached.videos[0].id);
      return;
    }

    setLoading(true);
    setVideos([]);
    setLastDoc(null);
    try {
      const effectiveCategory = category === 'Saved' ? 'All' : (category as any);
      // FETCH OPTIMIZATION: Small batch size
      const result = await fetchVideos(mode, effectiveCategory, searchQuery, null, 12);
      let vids = result.videos.map(cleanVideoData);
      
      // Check if we actually have more videos based on if we filled the requested batch size
      const hasMoreVids = result.videos.length === 12;
      
      // Algorithm: Apply weighting
      const weighted = getWeightedVideos(vids);
      
      setVideos(weighted);
      setLastDoc(result.lastVisible);
      // For shorts, we always want to attempt loading more to trigger the loop if we reach the end
      setHasMore(mode === 'short' ? true : hasMoreVids);
      
      // Cache the result
      if (!searchQuery) {
        sessionCache.set(cacheKey, { videos: weighted, lastDoc: result.lastVisible, hasMore: mode === 'short' ? true : hasMoreVids });
      }

      if (weighted.length > 0) {
        setActiveId(weighted[0].id);
      }
    } catch (error) {
      console.error("Error loading videos:", error);
    } finally {
      setLoading(false);
    }
  }, [mode, category, searchQuery, favorites]);

  // Handle case where category is 'Saved' - we might need to refresh if favorites change
  useEffect(() => {
    if (category === 'Saved') {
      loadInitialVideos();
    }
  }, [favorites, category, loadInitialVideos]);

  const loadMoreVideos = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const result = await fetchVideos(mode, category, searchQuery, lastDoc, 10);
      const cleaned = result.videos.map(cleanVideoData);
      
      // For YouTube mode, we filter out duplicates to avoid repeats in the list
      // For Shorts mode, we allow looping back to the start if we reach the end
      if (mode === 'youtube') {
        const newVideos = cleaned.filter(newVid => !videos.some(existingVid => existingVid.id === newVid.id));
        
        if (newVideos.length === 0 && cleaned.length > 0) {
          // If we only got duplicates, fetch next block immediately to move past them
          setLastDoc(result.lastVisible);
          setLoading(false); // temporary release to allow next trigger
          return;
        }

        if (cleaned.length === 0) {
          setHasMore(false);
        } else {
          setVideos(prev => [...prev, ...newVideos]);
          setLastDoc(result.lastVisible);
          setHasMore(cleaned.length === 10);
        }
        } else {
          // Shorts mode: allow continuous looping
          if (cleaned.length === 0) {
            // DATABASE TRULY EXHAUSTED: Fetch from the beginning to loop
            const freshResult = await fetchVideos(mode, category, searchQuery, null, 10);
            const freshCleaned = freshResult.videos.map(cleanVideoData);
            
            if (freshCleaned.length > 0) {
              const loopTimestamp = Date.now();
              const recycledVids = freshCleaned.map(v => ({
                ...v, 
                id: `${v.id}-loop-${loopTimestamp}` 
              }));
              
              setVideos(prev => [...prev, ...recycledVids]);
              setLastDoc(freshResult.lastVisible);
              setHasMore(true);
            } else {
              setHasMore(false);
            }
          } else {
            // Robust duplicate filtering: check against all original IDs in current state
            // to ensure we don't repeat until the loop happens.
            const seenOriginalIds = new Set(videos.map(v => v.id.split('-loop-')[0]));
            const filteredNew = cleaned.filter(newVid => !seenOriginalIds.has(newVid.id));
            
            if (filteredNew.length > 0) {
              setVideos(prev => [...prev, ...filteredNew]);
              setLastDoc(result.lastVisible);
              setHasMore(true);
            } else {
              // If all were duplicates in this batch, it means we might be circling back 
              // or the DB query returned seen data. Keep moving forward in DB page.
              setLastDoc(result.lastVisible);
              // Trigger another load if needed by tricking 'hasMore' 
              // but actually we'll wait for the user to hit the trigger again
              setHasMore(true);
            }
          }
        }
    } catch (error) {
      console.error("Error loading more videos:", error);
    } finally {
      setLoading(false);
    }
  }, [mode, category, searchQuery, lastDoc, loading, hasMore, videos]);

  useEffect(() => {
    loadInitialVideos();
  }, [loadInitialVideos]);

  useEffect(() => {
    const options = {
      root: containerRef.current,
      threshold: [0, 0.25, 0.5, 0.75, 1.0], // More granular threshold for better detection
    };

    observer.current = new IntersectionObserver((entries) => {
      // Find the entry with the highest intersection ratio
      const mostVisible = entries.reduce((prev, curr) => {
        return (curr.intersectionRatio > prev.intersectionRatio) ? curr : prev;
      });

      if (mostVisible && mostVisible.intersectionRatio > 0.5) {
        const id = mostVisible.target.getAttribute('data-id');
        setActiveId(id);
      }
    }, options);

    return () => observer.current?.disconnect();
  }, [videos]);

  const videoRef = useCallback((node: HTMLDivElement | null) => {
    if (node) observer.current?.observe(node);
  }, []);

  // Handle intersection for the load more trigger
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const trigger = loadMoreTriggerRef.current;
    if (!trigger) return;

    const loadMoreObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        loadMoreVideos();
      }
    }, { threshold: 0.1 });

    loadMoreObserver.observe(trigger);
    return () => loadMoreObserver.disconnect();
  }, [loadMoreVideos, hasMore, loading]);

  if (loading && videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black">
        <Loader2 className="w-10 h-10 text-brand animate-spin mb-4" />
        <p className="text-white/50 text-sm font-medium tracking-widest uppercase">Loading Magic...</p>
      </div>
    );
  }

  if (!loading && videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black px-8 text-center ring-1 ring-white/5 inset-0 fixed">
        <div className="w-20 h-20 bg-brand/10 rounded-full flex items-center justify-center mb-6 border border-brand/20">
          <Play size={32} className="text-brand opacity-40 ml-1" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">
          {category === 'Saved' ? 'No Saved Videos' : 'No Videos Found'}
        </h3>
        <p className="text-white/50 text-sm max-w-[240px]">
          {category === 'Saved' 
            ? "Videos you favorite will appear here so you can find them later easily!" 
            : "Try exploring a different category or change your search."}
        </p>
        {category === 'Saved' && (
          <button 
            onClick={() => window.location.reload()} 
            className="mt-6 px-6 py-2 bg-white text-black rounded-full font-bold text-sm transform active:scale-95 transition-transform"
          >
            Explore Videos
          </button>
        )}
      </div>
    );
  }

  if (mode === 'youtube') {
    const activeVideo = videos.find(v => v.id === activeId) || videos[0];
    const displayedVideos = category === 'Saved' 
      ? videos.filter(v => favorites.includes(v.id)) 
      : videos;
    
    return (
      <div 
        ref={containerRef}
        className="fixed inset-0 bg-[#050505] overflow-y-auto pt-[56px] lg:pt-[64px] selection:bg-brand/30 no-scrollbar overflow-x-hidden"
      >
        <div className="max-w-[1500px] mx-auto w-full lg:px-8 relative px-0">
          <div className="flex flex-col lg:flex-row lg:items-start lg:gap-10 min-h-[calc(100vh-64px)] pb-12">
            
            {/* Main Content Column (Player + Info + List on Mobile) */}
            <div className="w-full lg:w-[68%] flex-shrink-0">
              {/* Sticky Player Container */}
              <div className="sticky top-[56px] lg:top-[0px] lg:static z-40 bg-black lg:bg-transparent">
                <div className="w-full aspect-video bg-black shadow-2xl lg:rounded-[2rem] lg:overflow-hidden group lg:border lg:border-white/10 lg:ring-1 lg:ring-white/5 lg:mt-6">
                  {activeVideo && (
                    <YouTubePlayer 
                      video={activeVideo as any} 
                      isActive={true} 
                    />
                  )}
                </div>
              </div>

              {/* Info Area below player */}
              <div className="px-4 mt-6 lg:mt-8 lg:px-4">
                <div className="flex flex-col gap-4 lg:gap-6 lg:bg-white/[0.02] lg:border lg:border-white/5 lg:rounded-[1.5rem] lg:p-7 lg:backdrop-blur-sm lg:shadow-xl">
                  <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-1 rounded-full bg-brand/10 text-brand text-[8px] lg:text-[10px] font-black uppercase tracking-[0.1em] border border-brand/20">
                          {activeVideo?.category}
                        </span>
                        <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 text-white/40 text-[7px] lg:text-[8px] font-bold uppercase tracking-wider border border-white/5">
                            Standard Protocol
                          </span>
                      </div>
                      <h1 className="text-xl lg:text-3xl lg:font-black text-white leading-[1.2] lg:leading-[1.1] tracking-tight line-clamp-2 md:line-clamp-none">
                        {activeVideo?.title}
                      </h1>
                    </div>
                      
                      <button
                        onClick={() => {
                          if (!activeVideo) return;
                          const isFav = favorites.includes(activeVideo.id);
                          let newFavs;
                          if (isFav) {
                            newFavs = favorites.filter(id => id !== activeVideo.id);
                          } else {
                            newFavs = [...favorites, activeVideo.id];
                          }
                          localStorage.setItem('fav_videos', JSON.stringify(newFavs));
                          setFavorites(newFavs);
                          window.dispatchEvent(new Event('storage'));
                        }}
                        className={cn(
                          "flex items-center justify-center gap-2 px-3 py-2.5 lg:px-6 lg:py-3 rounded-xl lg:rounded-2xl transition-all border shrink-0 w-full lg:w-auto",
                          activeVideo && favorites.includes(activeVideo.id)
                            ? "bg-brand text-white border-brand shadow-lg shadow-brand/40"
                            : "bg-white/5 text-white/80 border-white/10 hover:bg-white/20 hover:border-white/20"
                        )}
                      >
                        <Heart size={16} className="lg:w-[20px] lg:h-[20px]" fill={activeVideo && favorites.includes(activeVideo.id) ? "currentColor" : "none"} />
                      <span className="text-[10px] lg:text-xs font-bold uppercase tracking-wide">
                        {activeVideo && favorites.includes(activeVideo.id) ? "Saved" : "Save to Favorites"}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Mobile "Up Next" Header */}
              <div className="px-4 pt-6 pb-2 lg:hidden">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <h3 className="text-white font-black text-sm italic uppercase tracking-tighter">Up Next</h3>
                  <span className="text-white/20 text-[9px] font-bold uppercase tracking-[0.2em]">{displayedVideos.length} items</span>
                </div>
              </div>

              {/* Mobile List Part (Inside the same div for stickiness) */}
              <div className="lg:hidden mt-2 space-y-3 px-4">
                {displayedVideos.map((video) => (
                  <motion.div
                    key={video.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setActiveId(video.id);
                      containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={cn(
                      "flex gap-4 p-2 rounded-xl transition-all cursor-pointer border",
                      activeId === video.id 
                        ? "bg-brand/10 border-brand/30" 
                        : "bg-white/[0.02] border-white/5"
                    )}
                  >
                    <div className="relative w-28 aspect-video flex-shrink-0">
                      {video.thumbnail_url && (
                        <img src={video.thumbnail_url} className="w-full h-full object-cover rounded-lg" alt="" referrerPolicy="no-referrer" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className={cn(
                          "text-xs font-bold line-clamp-2 flex-1 leading-snug",
                          activeId === video.id ? "text-brand" : "text-white/80"
                        )}>
                          {video.title}
                        </h4>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const isFav = favorites.includes(video.id);
                            let newFavs;
                            if (isFav) {
                              newFavs = favorites.filter(id => id !== video.id);
                            } else {
                              newFavs = [...favorites, video.id];
                            }
                            localStorage.setItem('fav_videos', JSON.stringify(newFavs));
                            setFavorites(newFavs);
                            window.dispatchEvent(new Event('storage'));
                          }}
                          className={cn(
                            "p-2 rounded-full transition-all shrink-0 bg-white/5",
                            favorites.includes(video.id) ? "text-brand" : "text-white/40 hover:text-white/70"
                          )}
                        >
                          <Heart size={16} fill={favorites.includes(video.id) ? "currentColor" : "none"} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[7px] px-1 py-0.5 rounded bg-white/5 text-white/30 uppercase font-black">
                          {video.category}
                        </span>
                        <span className="text-[7px] text-brand/80 font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-brand/5 border border-brand/10">
                          Source: YouTube
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Desktop About Section */}
              <div className="hidden lg:block lg:mt-6 lg:px-2 pb-24">
                <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur-sm">
                  <h3 className="text-xs font-black text-white/30 uppercase tracking-[0.2em] mb-3">About this video</h3>
                  <p className="text-base text-white/50 leading-relaxed font-medium">
                    {activeVideo?.description}
                  </p>
                  <div className="flex items-center gap-6 mt-6 pt-6 border-t border-white/5">
                    <div className="text-center">
                      <p className="text-[10px] text-white/20 uppercase font-bold tracking-widest mb-1">Provider</p>
                      <p className="text-xs text-white/60 font-bold uppercase tracking-tight">Stream Access Protocol</p>
                    </div>
                    <div className="h-8 w-px bg-white/10"></div>
                    <div className="text-center">
                      <p className="text-[10px] text-white/20 uppercase font-bold tracking-widest mb-1">Interface</p>
                      <p className="text-xs text-brand font-bold uppercase">Dynamic</p>
                    </div>
                  </div>
                </div>

                {/* Copyright Disclaimer */}
                <div className="px-1 py-6 border-t border-white/5 mt-4 opacity-30 hover:opacity-100 transition-opacity duration-500">
                  <div className="flex gap-3 items-start">
                    <div className="mt-1 w-1 h-1 rounded-full bg-brand flex-shrink-0"></div>
                    <p className="text-[10px] text-white leading-relaxed font-medium">
                      <span className="font-black uppercase tracking-wider block mb-1">Compliance Policy & Credits:</span>
                      All visual content remains the exclusive intellectual property of the original creators. This portal adheres to YouTube API & Embedding Guidelines. Videos are accessed directly from source servers.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar Column (Next Videos - Desktop Only) */}
            <div className="hidden lg:block flex-1 lg:pt-4 pb-32 lg:max-h-[calc(100vh-80px)] lg:sticky lg:top-[64px] lg:overflow-y-auto no-scrollbar lg:pr-2">
              <div className="hidden lg:flex items-center justify-between mb-4 sticky top-0 bg-[#050505]/95 backdrop-blur-xl py-4 z-10 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-6 bg-brand rounded-full shadow-[0_0_20px_rgba(46,204,113,0.6)]"></div>
                  <h3 className="text-white font-black text-xl italic uppercase tracking-tighter">On Deck</h3>
                </div>
                <span className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em] bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5">{displayedVideos.length} STREAM UNITS</span>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                {displayedVideos.map((video) => (
                  <motion.div
                    key={video.id}
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setActiveId(video.id);
                      // On mobile, scroll to top of the SCROLLABLE container so the sticky player shows the new video
                      containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={cn(
                      "flex gap-4 p-3 rounded-2xl transition-all cursor-pointer border group relative overflow-hidden",
                      activeId === video.id 
                        ? "bg-gradient-to-br from-brand/20 to-brand/5 border-brand/40 shadow-[0_10px_30px_rgba(46,204,113,0.1)] scale-[1.02]" 
                        : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10"
                    )}
                  >
                  {/* Selection indicator glass effect */}
                  {activeId === video.id && (
                    <div className="absolute inset-0 bg-brand/5 backdrop-blur-sm -z-10"></div>
                  )}

                    <div className="relative w-24 lg:w-32 aspect-video flex-shrink-0 group/thumb">
                      {video.thumbnail_url && (
                        <img 
                          src={video.thumbnail_url} 
                          className={cn(
                            "w-full h-full object-cover rounded-lg border border-white/10 transition-all duration-500",
                            activeId === video.id ? "scale-105 border-brand/50" : "group-hover:scale-105 group-hover:border-white/20"
                          )} 
                          alt=""
                          referrerPolicy="no-referrer"
                        />
                      )}
                      
                      {/* Play overlay on hover or active */}
                      <div className={cn(
                        "absolute inset-0 flex items-center justify-center rounded-lg transition-all duration-300",
                        activeId === video.id 
                          ? "bg-black/40 backdrop-blur-[1px]" 
                          : "bg-black/0 group-hover/thumb:bg-black/40 opacity-0 group-hover/thumb:opacity-100"
                      )}>
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center transition-transform duration-300",
                          activeId === video.id 
                            ? "bg-brand scale-110 shadow-lg shadow-brand/40" 
                            : "bg-white/20 scale-90 group-hover/thumb:scale-100 backdrop-blur-md"
                        )}>
                          <Play size={activeId === video.id ? 14 : 12} className={cn(
                            "ml-0.5",
                            activeId === video.id ? "text-black fill-black" : "text-white fill-white"
                          )} />
                        </div>
                      </div>

                      {activeId === video.id && (
                        <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-brand text-[7px] font-black uppercase text-black italic animate-pulse">
                          Playing
                        </div>
                      )}
                    </div>

                  <div className="flex-1 flex flex-col justify-center min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className={cn(
                        "text-[11px] lg:text-sm font-bold leading-tight line-clamp-2 transition-colors flex-1",
                        activeId === video.id ? "text-brand" : "text-white/80 group-hover:text-white"
                      )}>
                        {video.title}
                      </h4>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const isFav = favorites.includes(video.id);
                          let newFavs;
                          if (isFav) {
                            newFavs = favorites.filter(id => id !== video.id);
                          } else {
                            newFavs = [...favorites, video.id];
                          }
                          localStorage.setItem('fav_videos', JSON.stringify(newFavs));
                          setFavorites(newFavs);
                          window.dispatchEvent(new Event('storage'));
                        }}
                        className={cn(
                          "p-2 rounded-full transition-all shrink-0 bg-white/5 hover:bg-white/10 group/fav",
                          favorites.includes(video.id)
                            ? "text-brand scale-110"
                            : "text-white/40 hover:text-white/80"
                        )}
                      >
                        <Heart size={14} fill={favorites.includes(video.id) ? "currentColor" : "none"} className="group-hover/fav:drop-shadow-[0_0_8px_rgba(46,204,113,0.4)]" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/10 text-white/40 uppercase font-black tracking-widest border border-white/5">
                        {video.category}
                      </span>
                      <span className="text-[7px] px-1.5 py-0.5 rounded bg-brand/10 text-brand/80 uppercase font-bold tracking-wider border border-brand/20">
                        Source: YouTube
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
              
            {/* Load More Trigger */}
            <div ref={loadMoreTriggerRef} className="py-4 lg:py-16 flex justify-center">
              {hasMore && <Loader2 className="w-8 h-8 text-brand animate-spin opacity-40" />}
            </div>

              <div className="lg:hidden mt-6 space-y-4 pb-12">
                <div 
                  onClick={() => setIsDescExpanded(!isDescExpanded)}
                  className="p-4 rounded-xl bg-white/[0.03] border border-white/5 backdrop-blur-sm"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">About this content</h3>
                    <span className="text-[9px] text-brand font-bold">
                      {isDescExpanded ? "Hide" : "Show"}
                    </span>
                  </div>
                  {isDescExpanded && (
                    <div className="mt-3 animate-in fade-in slide-in-from-top-1 duration-300">
                      <p className="text-xs text-white/50 leading-relaxed font-medium">
                        {activeVideo?.description}
                      </p>
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                  <button 
                    onClick={() => setIsComplianceExpanded(!isComplianceExpanded)}
                    className="flex w-full items-center justify-between"
                  >
                    <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.15em]">Legal & Compliance</span>
                    <span className="text-[9px] text-brand font-bold">{isComplianceExpanded ? "Hide" : "Show"}</span>
                  </button>
                  {isComplianceExpanded && (
                    <div className="mt-3 text-[9px] text-white/40 leading-relaxed animate-in fade-in duration-300">
                      All visual content remains the exclusive intellectual property of the original creators. This portal adheres to YouTube API & Embedding Guidelines. 
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar Footer Disclaimer - Only for YouTube mode as requested */}
              {mode === 'youtube' && (
                <div className="pt-8 pb-12 px-4 border-t border-white/5 opacity-10">
                  <p className="text-[8px] uppercase tracking-[0.15em] text-white font-bold leading-relaxed">
                    T-Portal Engine V2.4 © All Rights Reserved. 
                    Content curated via YouTube Embed Service. 
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'short') {
    const displayedVideos = category === 'Saved' 
      ? videos.filter(v => favorites.includes(v.id)) 
      : videos;

    return (
      <div className="fixed inset-0 bg-black flex justify-center">
        <div 
          ref={containerRef}
          className="relative w-full max-w-[450px] h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar bg-black overscroll-contain touch-pan-y"
        >
          {displayedVideos.map((video, index) => (
            <div 
              key={`${video.id}-${index}`}
              data-id={video.id}
              ref={videoRef}
              className="w-full h-full snap-start snap-always [scroll-snap-stop:always] relative overflow-hidden transform-gpu will-change-transform"
            >
              <ShortsPlayer 
                video={video as any} 
                isActive={activeId === video.id} 
              />
            </div>
          ))}

          {/* Load More Trigger */}
          <div ref={loadMoreTriggerRef} className="h-[20vh] flex items-center justify-center bg-black snap-start">
            {hasMore && (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-brand animate-spin" />
                <span className="text-[10px] uppercase tracking-tighter text-white/30">Loading more shorts</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar bg-black overscroll-contain touch-pan-y"
    >
      {videos.map((video, index) => (
        <div 
          key={`${video.id}-${index}`}
          data-id={video.id}
          ref={videoRef}
          className="w-full h-full snap-start snap-always [scroll-snap-stop:always] relative overflow-hidden transform-gpu will-change-transform"
        >
          {/* Smart Switch: If short mode but only youtube url available, or vice versa */}
          {(mode === 'short' && video.video_url) ? (
            <ShortsPlayer 
              video={video as any} 
              isActive={activeId === video.id} 
            />
          ) : (
            <YouTubePlayer 
              video={video as any} 
              isActive={activeId === video.id} 
            />
          )}
        </div>
      ))}

      {/* Load More Trigger */}
      <div ref={loadMoreTriggerRef} className="h-[20vh] flex items-center justify-center bg-black snap-start">
        {hasMore && (
           <div className="flex flex-col items-center gap-2">
             <Loader2 className="w-8 h-8 text-brand animate-spin" />
             <span className="text-[10px] uppercase tracking-tighter text-white/30">Loading next batch</span>
           </div>
        )}
      </div>
    </div>
  );
}
