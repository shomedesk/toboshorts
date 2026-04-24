/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import Header from './components/Header';
import VideoFeed from './components/VideoFeed';
import { Category } from './types';
import { getDeviceId } from './lib/device';

export default function App() {
  const [mode, setMode] = useState<'short' | 'youtube'>('short');
  const [category, setCategory] = useState<Category | 'All' | 'Saved'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [deviceId, setDeviceId] = useState<string>('');

  useEffect(() => {
    // Unique device detection for behavior monitoring as requested
    // Wrapped in a safe async block
    const initDevice = async () => {
      try {
        const id = await getDeviceId();
        setDeviceId(id);
      } catch (err) {
        console.error('Failed to init device ID:', err);
      }
    };
    initDevice();
  }, []);

  return (
    <div className="fixed inset-0 h-[100dvh] w-full bg-black overflow-hidden">
      <VideoFeed 
        mode={mode} 
        category={category} 
        searchQuery={searchQuery}
      />

      <Header 
        mode={mode} 
        setMode={setMode} 
        category={category} 
        setCategory={setCategory}
        onSearch={setSearchQuery}
      />
      
      {/* Hidden analytics info */}
      <div className="hidden" aria-hidden="true"></div>
    </div>
  );
}
