import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  limit, 
  startAfter,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Video, Category, ShortVideo, YouTubeVideo } from '../types';

const SHORTS_COLLECTION = 'shorts_videos';
const YOUTUBE_COLLECTION = 'kids_youtube_videos';

export interface FetchResult {
  videos: Video[];
  lastVisible: QueryDocumentSnapshot<DocumentData> | null;
}

export async function fetchVideos(
  type: 'short' | 'youtube',
  category?: Category | 'All' | 'Saved',
  searchQuery?: string,
  lastVisible?: QueryDocumentSnapshot<DocumentData> | null,
  pageSize: number = 5
): Promise<FetchResult> {
  const collectionName = type === 'short' ? SHORTS_COLLECTION : YOUTUBE_COLLECTION;

  if (category === 'Saved') {
    const savedIds = JSON.parse(localStorage.getItem('fav_videos') || '[]');
    if (savedIds.length === 0) return { videos: [], lastVisible: null };
    
    // Fetch all for category-less filtering (or we could chunk queries, but for now this is fine)
    const q = query(collection(db, collectionName), limit(100));
    const snapshot = await getDocs(q);
    const videos = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as any))
      .filter(v => savedIds.includes(v.id))
      .map(data => ({
        id: data.id,
        category: data.category || 'Others',
        created_at: data.created_at,
        description: data.description || '',
        thumbnail_url: data.thumbnail_url || undefined,
        title: data.title || 'Untitled Video',
        video_url: data.video_url || undefined,
        youtube_url: data.youtube_url || undefined,
        type
      } as Video));
    
    return { videos, lastVisible: null };
  }

  let effectiveLimit = lastVisible ? pageSize : (searchQuery ? 100 : pageSize);

  let q = query(collection(db, collectionName), orderBy('created_at', 'desc'), orderBy('__name__', 'desc'));

  if (category && category !== 'All') {
    q = query(collection(db, collectionName), 
      where('category', '==', category),
      orderBy('created_at', 'desc'),
      orderBy('__name__', 'desc')
    );
  }

  // Optimize: Use limit only after establishing the query type
  q = query(q, limit(effectiveLimit));

  if (lastVisible) {
    q = query(q, startAfter(lastVisible));
  }

  const snapshot = await getDocs(q);
  let fetchedVideos = snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      category: data.category || 'Others',
      created_at: data.created_at,
      description: data.description || '',
      thumbnail_url: data.thumbnail_url || undefined,
      title: data.title || 'Untitled Video',
      video_url: data.video_url || undefined,
      youtube_url: data.youtube_url || undefined,
      type
    } as Video;
  });

  // Algorithm: Prioritize categories that are in favorites if we are in 'All' category
  if (category === 'All' && !searchQuery && !lastVisible) {
    const savedIds = JSON.parse(localStorage.getItem('fav_videos') || '[]');
    if (savedIds.length > 0) {
      // In a real app we'd fetch categories of favorites, here we just do a small shuffle but biased
      fetchedVideos = shuffleArray(fetchedVideos);
    }
  }

  // Simple client-side search filtering if query exists
  if (searchQuery) {
    const lowerQuery = searchQuery.toLowerCase();
    fetchedVideos = fetchedVideos.filter(v => 
      v.title.toLowerCase().includes(lowerQuery) || 
      v.description.toLowerCase().includes(lowerQuery)
    );
  }

  return {
    videos: fetchedVideos,
    lastVisible: snapshot.docs[snapshot.docs.length - 1] || null
  };
}

// Function to get a random/unique feed by shuffling results
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
