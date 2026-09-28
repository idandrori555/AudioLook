export interface Chapter {
  id: string;
  number: number;
  title: string;
  duration: number; // in seconds
  durationFormatted: string;
  youtubeId?: string;
}

export interface Book {
  id: string;
  youtubeId?: string;
  youtubePlaylistId?: string;
  isPlaylist?: boolean;
  title: string;
  author: string;
  coverUrl: string;
  source: string; // e.g. 'הפקת תסכית יוטיוב', 'פלייליסט יוטיוב', 'תרגום מופת', 'ספר קולי רשמי'
  category: 'listening' | 'completed' | 'queued';
  totalChapters: number;
  currentChapterIndex: number;
  totalDurationSeconds: number;
  currentTimeSeconds: number;
  chapters: Chapter[];
  isOfflineAvailable?: boolean;
  sizeOffline?: string;
  dateAdded?: string;
  chapterProgress?: Record<number, number>; // maps chapter index -> seconds
  lastListenedAt?: string;
}

export interface Bookmark {
  id: string;
  bookId: string;
  bookTitle: string;
  bookCover: string;
  chapterNumber: number;
  chapterTitle: string;
  timestampSeconds: number;
  timestampFormatted: string;
  note?: string;
  createdAt: string;
}

export type TabType = 'library' | 'player' | 'bookmarks' | 'settings';
export type FilterType = 'all' | 'listening' | 'completed' | 'queued';
