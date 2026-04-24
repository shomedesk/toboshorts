import { Timestamp } from 'firebase/firestore';

export type Category = 
  | 'ABCD'
  | 'Cartoon'
  | 'Moral'
  | 'Learning'
  | 'Nature'
  | 'Rhymes'
  | 'Knowledge'
  | 'History'
  | 'Science'
  | 'Sociology'
  | 'Physics'
  | 'Funny'
  | 'Others';

export const CATEGORIES: Category[] = [
  'ABCD', 'Cartoon', 'Moral', 'Learning', 'Nature', 'Rhymes', 
  'Knowledge', 'History', 'Science', 'Sociology', 'Physics', 'Funny', 'Others'
];

export interface BaseVideo {
  id: string;
  category: Category;
  created_at: Timestamp;
  description: string;
  thumbnail_url: string;
  title: string;
}

export interface ShortVideo extends BaseVideo {
  video_url: string;
  type: 'short';
}

export interface YouTubeVideo extends BaseVideo {
  youtube_url: string;
  type: 'youtube';
}

export type Video = ShortVideo | YouTubeVideo;
