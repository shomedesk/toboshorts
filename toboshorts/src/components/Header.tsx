import React, { useState } from 'react';
import { Search, ChevronRight, ChevronLeft } from 'lucide-react';
import { Category, CATEGORIES } from '../types';
import { cn } from '../lib/utils';

interface HeaderProps {
  mode: 'short' | 'youtube';
  setMode: (mode: 'short' | 'youtube') => void;
  category: Category | 'All' | 'Saved';
  setCategory: (category: Category | 'All' | 'Saved') => void;
  onSearch: (query: string) => void;
}

export default function Header({ mode, setMode, category, setCategory, onSearch }: HeaderProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery);
  };

  return (
    <div className={cn(
      "fixed top-0 left-0 right-0 z-50 flex flex-col pt-safe px-4 pb-2 transition-all duration-300",
      mode === 'short' 
        ? "bg-gradient-to-b from-black/60 to-transparent border-none shadow-none" 
        : "bg-black/90 backdrop-blur-xl border-b border-white/5 shadow-2xl"
    )}>
      <div className="flex items-center justify-between h-12 relative">
        {/* Toggle Mode - Hidden when search is active on small screens to save space */}
        <div className={cn(
          "flex bg-neutral-800/80 rounded-lg p-1 backdrop-blur-md border border-white/10 shadow-inner transition-opacity duration-300",
          isSearchOpen ? "opacity-0 pointer-events-none absolute md:relative md:opacity-100 md:pointer-events-auto" : "opacity-100"
        )}>
          <button 
            onClick={() => setMode('short')}
            className={cn(
              "px-5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-[0.15em] transition-all",
              mode === 'short' ? "bg-white text-black shadow-md scale-[1.02]" : "text-white/40 hover:text-white"
            )}
          >
            T-Shorts
          </button>
          <button 
            onClick={() => setMode('youtube')}
            className={cn(
              "px-5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-[0.15em] transition-all",
              mode === 'youtube' ? "bg-white text-black shadow-md scale-[1.02]" : "text-white/40 hover:text-white"
            )}
          >
            Videos
          </button>
        </div>

        {/* Search Bar / Icon */}
        <div className={cn(
          "flex items-center gap-2 transition-all duration-300",
          isSearchOpen ? "flex-1 justify-end ml-0 md:ml-4" : "ml-auto"
        )}>
          {isSearchOpen ? (
            <div className="flex items-center gap-2 w-full max-w-sm">
              <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center bg-white/10 border border-white/5 rounded-full px-4 h-9 backdrop-blur-sm animate-in fade-in slide-in-from-right-4 duration-300">
                <input
                  autoFocus
                  type="text"
                  placeholder="Search videos..."
                  className="bg-transparent border-none focus:ring-0 text-sm w-full outline-none text-white placeholder:text-white/30"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button type="submit" className="text-white/70 hover:text-white">
                  <Search size={18} />
                </button>
              </form>
              <button 
                onClick={() => { setIsSearchOpen(false); setSearchQuery(''); onSearch(''); }} 
                className="text-xs font-bold uppercase tracking-wider text-white/50 hover:text-white whitespace-nowrap transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsSearchOpen(true)}
              className="p-2.5 bg-white/10 rounded-full text-white/70 hover:text-white backdrop-blur-sm transition-all hover:scale-105 active:scale-95 border border-white/5"
            >
              <Search size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Categories Scrollable Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1.5 -mx-4 px-4 mask-fade-edges min-h-[44px]">
        <button
          onClick={() => setCategory('All')}
          className={cn(
            "flex-shrink-0 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border",
            category === 'All' ? "bg-white text-black border-white shadow-lg" : "bg-white/5 text-white/40 border-white/5 hover:bg-white/10"
          )}
        >
          All
        </button>
        <button
          onClick={() => setCategory('Saved' as any)}
          className={cn(
            "flex-shrink-0 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border",
            (category as string) === 'Saved' ? "bg-brand text-white border-brand shadow-lg" : "bg-brand/5 text-brand border-brand/10 hover:bg-brand/10"
          )}
        >
          Saved
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={cn(
              "flex-shrink-0 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border",
              category === (cat as any) ? "bg-white text-black border-white shadow-lg" : "bg-white/5 text-white/40 border-white/5 hover:bg-white/10"
            )}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
}
