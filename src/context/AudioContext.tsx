import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Book, Chapter, Bookmark, TabType, FilterType } from '../types';

// Fresh installs start empty; the library is built purely from user imports
// persisted in localStorage.
const INITIAL_BOOKS: Book[] = [];
const INITIAL_BOOKMARKS: Bookmark[] = [];
import {
  extractYouTubeId,
  extractYouTubePlaylistId,
  fetchYouTubeMetadata,
  fetchYouTubePlaylist,
} from '../services/youtube';
import { buildBackup, downloadBackup, mergeBookmarks, mergeBooks } from '../services/backup';
import type { ImportMode, LyraBackup } from '../services/backup';

// Rebrand migration (AudioLook → Lyra): copy legacy `audiolook_*` localStorage
// values to their `lyra_*` equivalents on first run, so existing installs keep
// their library, bookmarks and settings. Afterwards this is a no-op — safe to
// delete once all installs have migrated.
const LEGACY_STORAGE_KEYS: Array<[oldKey: string, newKey: string]> = [
  ['audiolook_user_books_clean', 'lyra_user_books_clean'],
  ['audiolook_last_book_id', 'lyra_last_book_id'],
  ['audiolook_playback_speed', 'lyra_playback_speed'],
  ['audiolook_active_tab', 'lyra_active_tab'],
  ['audiolook_video_mode_v2', 'lyra_video_mode_v2'],
  ['audiolook_user_bookmarks_clean', 'lyra_user_bookmarks_clean'],
  ['audiolook_sound_enabled', 'lyra_sound_enabled'],
];
function migrateLegacyStorageKeys(): void {
  try {
    for (const [oldKey, newKey] of LEGACY_STORAGE_KEYS) {
      if (localStorage.getItem(newKey) === null) {
        const legacy = localStorage.getItem(oldKey);
        if (legacy !== null) localStorage.setItem(newKey, legacy);
      }
    }
  } catch {
    // Storage unavailable (private mode etc.) — app boots with defaults.
  }
}

interface AudioContextType {
  books: Book[];
  currentBook: Book | null;
  currentChapter: Chapter | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackSpeed: number;
  sleepTimerMinutes: number | null;
  sleepTimerSecondsRemaining: number | null;
  activeTab: TabType;
  activeFilter: FilterType;
  bookmarks: Bookmark[];
  isChaptersDrawerOpen: boolean;
  isSleepTimerModalOpen: boolean;
  isSearchModalOpen: boolean;
  isAccountModalOpen: boolean;
  audioSoundEnabled: boolean;
  toastMessage: string | null;
  
  // YouTube specific
  isVideoMode: boolean;
  toggleVideoMode: () => void;
  ytPlayer: any;
  setYtPlayer: (player: any) => void;
  isYtReady: boolean;
  setIsYtReady: (ready: boolean) => void;
  // Failure surfacing: without these, an unplayable video / blocked YT API
  // leaves a dead 00:00 slider with a lying play button and zero feedback.
  ytBlocked: boolean;
  setYtBlocked: (blocked: boolean) => void;
  reportYtApiBlocked: () => void;
  // Bumps every time the user taps "try again" so YouTubeHost re-runs
  // player init (the init effect depends on it).
  ytRetryToken: number;
  retryYt: () => void;
  ytError: { bookId: string | null; code: number; message: string } | null;
  reportYtError: (code: number) => void;
  clearYtError: () => void;
  
  // Handlers
  playPause: () => void;
  seekTo: (timeSeconds: number) => void;
  jumpRelative: (deltaSeconds: number) => void;
  nextChapter: () => void;
  previousChapter: () => void;
  selectChapter: (index: number) => void;
  selectBook: (bookId: string, autoPlay?: boolean, navigateToPlayer?: boolean) => void;
  jumpToBookmark: (bookId: string, timestampSeconds: number, chapterNumber?: number) => void;
  addBook: (book: Book) => void;
  deleteBook: (bookId: string) => void;
  markBookCompleted: (bookId: string) => void;
  setPlaybackSpeed: (speed: number) => void;
  setSleepTimer: (minutes: number | null) => void;
  toggleBookmark: () => void;
  removeBookmark: (id: string) => void;
  importYouTubeAudio: (url: string) => Promise<boolean>;
  exportLibrary: () => void;
  applyBackup: (backup: LyraBackup, mode: ImportMode) => void;
  setActiveTab: (tab: TabType) => void;
  setActiveFilter: (filter: FilterType) => void;
  setIsChaptersDrawerOpen: (open: boolean) => void;
  setIsSleepTimerModalOpen: (open: boolean) => void;
  setIsSearchModalOpen: (open: boolean) => void;
  setIsAccountModalOpen: (open: boolean) => void;
  setAudioSoundEnabled: (enabled: boolean) => void;
  showToast: (message: string) => void;
  formatTime: (totalSeconds: number) => string;
  formatRemainingTime: (currentSeconds: number, totalSeconds: number) => string;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  migrateLegacyStorageKeys();
  const [books, setBooks] = useState<Book[]>(() => {
    try {
      localStorage.removeItem('audiolook_books');
      const saved = localStorage.getItem('lyra_user_books_clean');
      if (!saved) return INITIAL_BOOKS;
      const parsed: Book[] = JSON.parse(saved);
      return parsed.map((b) => {
        if (b.youtubeId && !b.isPlaylist) {
          return {
            ...b,
            totalChapters: 1,
            chapters: [],
          };
        }
        return b;
      });
    } catch {
      return INITIAL_BOOKS;
    }
  });

  const [currentBookId, setCurrentBookId] = useState<string | null>(() => {
    try {
      const savedId = localStorage.getItem('lyra_last_book_id');
      if (savedId && books.some((b) => b.id === savedId)) {
        return savedId;
      }
    } catch {}
    return books.length > 0 ? books[0].id : null;
  });

  const currentBook = books.find((b) => b.id === currentBookId) || (books.length > 0 ? books[0] : null);

  const currentChapter =
    currentBook && (currentBook.isPlaylist || !currentBook.youtubeId) && currentBook.chapters && currentBook.chapters.length > 0
      ? currentBook.chapters[currentBook.currentChapterIndex] || currentBook.chapters[0]
      : null;

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(() => {
    if (!currentBook) return 0;
    const chIdx = currentBook.currentChapterIndex || 0;
    return currentBook.chapterProgress?.[chIdx] ?? currentBook.currentTimeSeconds ?? 0;
  });
  // Live `duration` semantics: for YT playlists the player scrubs/seeks
  // WITHIN the current video, so duration = current chapter length.
  // For everything else (single videos, local books) it = whole-book total.
  const [duration, setDuration] = useState<number>(() => {
    if (!currentBook) return 0;
    if (currentBook.isPlaylist) {
      const idx = currentBook.currentChapterIndex || 0;
      return currentBook.chapters?.[idx]?.duration || 0;
    }
    return currentBook.totalDurationSeconds || 0;
  });

  const [playbackSpeed, setPlaybackSpeedState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('lyra_playback_speed');
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val > 0) return val;
      }
    } catch {}
    return 1.0;
  });

  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [sleepTimerSecondsRemaining, setSleepTimerSecondsRemaining] = useState<number | null>(null);

  const [activeTab, setActiveTabState] = useState<TabType>(() => {
    try {
      const saved = localStorage.getItem('lyra_active_tab') as TabType;
      if (saved && ['library', 'player', 'bookmarks', 'settings'].includes(saved)) {
        return saved;
      }
    } catch {}
    return 'library';
  });

  const setActiveTab = (tab: TabType) => {
    if (tab === activeTab) return;
    setActiveTabState(tab);
    try {
      localStorage.setItem('lyra_active_tab', tab);
    } catch {}
    // Reset viewport scroll so the incoming tab mounts at the top.
    // Without this, window.scrollY carries over between tabs of very
    // different heights (short player <-> tall library): the document
    // briefly collapses during the AnimatePresence exit gap, the browser
    // clamps scrollY, and the fixed dock visibly jumps on re-mount.
    try {
      window.scrollTo(0, 0);
    } catch {}
  };

  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  
  // YouTube player reference & state
  const [ytPlayer, setYtPlayer] = useState<any>(null);
  const [isYtReady, setIsYtReady] = useState(false);
  // True once we give up waiting for the YT IFrame API (ad-blocker/offline).
  // While true, play on YT books must NOT fake a "playing" state.
  const [ytBlocked, setYtBlocked] = useState(false);
  // Init-buster for the YouTubeHost singleton: retryYt() clears the blocked
  // flag and bumps this token so init re-runs (recover without reload).
  const [ytRetryToken, setYtRetryToken] = useState(0);
  // Last player error for the current book (embed-blocked/deleted/...).
  const [ytError, setYtError] = useState<{
    bookId: string | null;
    code: number;
    message: string;
  } | null>(null);
  // Default is cover-audio mode (cleaner player). The _v3 key retires all
  // previous defaults so every install starts cover-first once, then the
  // choice lives in Settings (not in the player UI anymore).
  const VIDEO_MODE_KEY = 'lyra_video_mode_v3';
  const [isVideoMode, setIsVideoModeState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(VIDEO_MODE_KEY);
      if (saved !== null) return saved === 'true';
    } catch {}
    return false;
  });

  const setIsVideoMode = (mode: boolean) => {
    setIsVideoModeState(mode);
    try {
      localStorage.setItem(VIDEO_MODE_KEY, String(mode));
    } catch {}
  };

  const toggleVideoMode = () => {
    setIsVideoModeState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(VIDEO_MODE_KEY, String(next));
      } catch {}
      return next;
    });
  };

  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => {
    try {
      localStorage.removeItem('audiolook_bookmarks');
      const saved = localStorage.getItem('lyra_user_bookmarks_clean');
      return saved ? JSON.parse(saved) : INITIAL_BOOKMARKS;
    } catch {
      return INITIAL_BOOKMARKS;
    }
  });

  const [isChaptersDrawerOpen, setIsChaptersDrawerOpen] = useState(false);
  const [isSleepTimerModalOpen, setIsSleepTimerModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [audioSoundEnabled, setAudioSoundEnabledState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('lyra_sound_enabled');
      if (saved !== null) return saved === 'true';
    } catch {}
    return true;
  });

  const setAudioSoundEnabled = (enabled: boolean) => {
    setAudioSoundEnabledState(enabled);
    try {
      localStorage.setItem('lyra_sound_enabled', String(enabled));
    } catch {}
  };

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Synchronous tracking references for guaranteed persistence
  const currentTimeRef = useRef<number>(currentTime);
  const currentBookIdRef = useRef<string | null>(currentBook?.id || null);
  const currentChapterIndexRef = useRef<number>(currentBook?.currentChapterIndex || 0);
  const lastSaveTimestampRef = useRef<number>(0);

  // Spam-proofing refs (transport controls)
  const seekPendingUntilRef = useRef<number>(0);
  const pendingSeekTargetRef = useRef<number | null>(null);
  const seekDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playToggleLockRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const chapterYtTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingChapterYtRef = useRef<{ youtubeId: string; resumeTime: number } | null>(null);
  // Consecutive "paused" reads from the YT player (debounces transient states
  // during our own play/seek commands so external pauses need 2 ticks to sync).
  const ytPausedStreakRef = useRef<number>(0);
  // Consecutive "cued/unstarted" reads while we intend to play (self-heal below).
  const ytCuedStreakRef = useRef<number>(0);
  // Single-owner book-switch handshake: selectBook() issues the YT command
  // immediately AND records it here so the [currentBook?.id] sync effect
  // doesn't follow up with a conflicting cueVideoById that would cancel
  // the autoplay load (the "stuck at 1st second" bug).
  const lastYtSwitchRef = useRef<{ bookId: string; videoId: string; start: number; at: number } | null>(null);
  // Autoplay intent for the sync effect (covers "YT not ready yet" case:
  // selectBook stores intent, sync effect consumes it once player is ready).
  const pendingAutoPlayRef = useRef<boolean | null>(null);
  const playbackSpeedRef = useRef<number>(1);
  // Player-binding health (dead-getter / frozen-clock detectors, see poller).
  // The iframe can outlive our JS binding (stale object after a re-init, a
  // replaced iframe, a wedged API bridge): audio keeps playing from a ghost
  // while every getter throws or returns stale zeros — frozen 00:00:00 under
  // a lying pause icon, with +10s taps snapping back to 0.
  const ytBadTickRef = useRef<number>(0);
  const ytStuckTickRef = useRef<number>(0);
  const ytLastClockRef = useRef<number>(-1);
  // Consecutive auto-rebuilds without a single healthy tick in between —
  // capped so a fundamentally broken API bridge ends in the blocked banner
  // (with retry) instead of a rebuild toast loop.
  const ytRebuildCountRef = useRef<number>(0);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
  }, [playbackSpeed]);

  // Cleanup pending timers on unmount
  useEffect(() => {
    return () => {
      if (seekDebounceTimerRef.current) clearTimeout(seekDebounceTimerRef.current);
      if (chapterYtTimerRef.current) clearTimeout(chapterYtTimerRef.current);
    };
  }, []);

  useEffect(() => {
    // Don't clobber optimistic seek UI from the poller-driven sync below.
    // currentTimeRef is the source of truth for seeks; only sync when idle.
    if (Date.now() < seekPendingUntilRef.current) return;
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    currentBookIdRef.current = currentBook?.id || null;
    currentChapterIndexRef.current = currentBook?.currentChapterIndex || 0;
  }, [currentBook?.id, currentBook?.currentChapterIndex]);

  // Persist user books on any book array changes
  useEffect(() => {
    localStorage.setItem('lyra_user_books_clean', JSON.stringify(books));
  }, [books]);

  // Persist bookmarks
  useEffect(() => {
    localStorage.setItem('lyra_user_bookmarks_clean', JSON.stringify(bookmarks));
  }, [bookmarks]);

  // Direct progress saving function
  const saveProgressNow = useCallback(
    (explicitSeconds?: number, explicitChapterIndex?: number, explicitBookId?: string) => {
      const bId = explicitBookId || currentBookIdRef.current;
      if (!bId) return;

      const sec = Math.floor(explicitSeconds !== undefined ? explicitSeconds : currentTimeRef.current);
      const chIdx = explicitChapterIndex !== undefined ? explicitChapterIndex : currentChapterIndexRef.current;

      setBooks((prevBooks) => {
        let changed = false;
        const updated = prevBooks.map((b) => {
          if (b.id !== bId) return b;
          const currentProg = b.chapterProgress || {};
          const prevSec = currentProg[chIdx] ?? b.currentTimeSeconds;

          if (prevSec === sec && b.currentChapterIndex === chIdx) {
            return b;
          }

          changed = true;
          return {
            ...b,
            currentChapterIndex: chIdx,
            currentTimeSeconds: sec,
            chapterProgress: {
              ...currentProg,
              [chIdx]: sec,
            },
            lastListenedAt: new Date().toISOString(),
          };
        });

        if (changed) {
          try {
            localStorage.setItem('lyra_user_books_clean', JSON.stringify(updated));
            localStorage.setItem('lyra_last_book_id', bId);
          } catch (e) {
            console.warn('Error saving to localStorage:', e);
          }
          return updated;
        }
        return prevBooks;
      });
    },
    []
  );

  // Emergency synchronous flush for mobile sleep / tab close / refresh
  const emergencyFlushToStorage = useCallback(() => {
    const bId = currentBookIdRef.current;
    if (!bId) return;
    const sec = Math.floor(currentTimeRef.current);
    const chIdx = currentChapterIndexRef.current;

    try {
      const raw = localStorage.getItem('lyra_user_books_clean');
      if (raw) {
        const storedBooks: Book[] = JSON.parse(raw);
        const updated = storedBooks.map((b) => {
          if (b.id !== bId) return b;
          return {
            ...b,
            currentChapterIndex: chIdx,
            currentTimeSeconds: sec,
            chapterProgress: {
              ...(b.chapterProgress || {}),
              [chIdx]: sec,
            },
            lastListenedAt: new Date().toISOString(),
          };
        });
        localStorage.setItem('lyra_user_books_clean', JSON.stringify(updated));
      }
      localStorage.setItem('lyra_last_book_id', bId);
    } catch (e) {
      console.warn('Emergency flush error:', e);
    }
  }, []);

  // Listen to browser & mobile sleep / hide / close events
  useEffect(() => {
    const handleExit = () => emergencyFlushToStorage();
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        emergencyFlushToStorage();
      }
    };

    window.addEventListener('beforeunload', handleExit);
    window.addEventListener('pagehide', handleExit);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('beforeunload', handleExit);
      window.removeEventListener('pagehide', handleExit);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [emergencyFlushToStorage]);

  // Auto-upgrade any playlists that were previously capped at 15 items by the RSS feed limit
  useEffect(() => {
    books.forEach(async (b) => {
      if (b.isPlaylist && b.youtubePlaylistId && b.chapters && b.chapters.length <= 15) {
        try {
          const plData = await fetchYouTubePlaylist(b.youtubePlaylistId);
          if (plData.chapters && plData.chapters.length > b.chapters.length) {
            setBooks((prev) =>
              prev.map((item) =>
                item.id === b.id
                  ? {
                      ...item,
                      totalChapters: plData.chapters.length,
                      chapters: plData.chapters,
                      totalDurationSeconds: plData.chapters.reduce(
                        (sum, c) => sum + (c.duration || 1800),
                        0
                      ),
                    }
                  : item
              )
            );
          }
        } catch (e) {
          console.warn('Failed to auto-expand playlist:', e);
        }
      }
    });
  }, []);

  // Sync current time & duration when switching book.
  // Single-owner rule: selectBook() already issues the YT command for
  // user-initiated switches (see lastYtSwitchRef). This effect must NOT
  // blindly cue afterwards, or the cue cancels the autoplay load and the
  // new book gets stuck at second 0 while isPlaying stays true.
  useEffect(() => {
    if (currentBook) {
      const chIdx = currentBook.currentChapterIndex || 0;
      const resumeTime =
        currentBook.chapterProgress?.[chIdx] ?? currentBook.currentTimeSeconds ?? 0;
      setCurrentTime(resumeTime);
      currentTimeRef.current = resumeTime;
      currentChapterIndexRef.current = chIdx;
      // Chapter-level duration for playlists (per-video scrubber), book total otherwise.
      setDuration(
        currentBook.isPlaylist
          ? currentBook.chapters?.[chIdx]?.duration || 0
          : currentBook.totalDurationSeconds || 0,
      );

      const videoToCue =
        (currentBook.isPlaylist && currentBook.chapters?.[chIdx]?.youtubeId) ||
        currentBook.youtubeId;

      if (videoToCue && ytPlayer && isYtReady) {
        // Skip if selectBook() just handled this exact switch.
        const last = lastYtSwitchRef.current;
        if (
          last &&
          last.bookId === currentBook.id &&
          last.videoId === videoToCue &&
          Math.abs(last.start - resumeTime) < 2 &&
          Date.now() - last.at < 3000
        ) {
          // Still honor a pending play intent (e.g. user pressed play while
          // the player was loading): playVideo() never cancels an in-flight
          // load, it only ensures the cued video actually starts.
          const shouldPlay = pendingAutoPlayRef.current ?? isPlayingRef.current;
          pendingAutoPlayRef.current = null;
          if (shouldPlay && typeof ytPlayer.playVideo === 'function') {
            try {
              ytPlayer.playVideo();
            } catch {}
          }
          return;
        }
        // Otherwise (initial mount, YT just became ready, restore): honor
        // the stored autoplay intent, falling back to current play state.
        const shouldPlay = pendingAutoPlayRef.current ?? isPlayingRef.current;
        pendingAutoPlayRef.current = null;
        try {
          if (shouldPlay) {
            ytPausedStreakRef.current = 0;
            ytCuedStreakRef.current = 0;
            ytPlayer.loadVideoById(videoToCue, resumeTime);
            const rate = playbackSpeedRef.current;
            if (rate && rate !== 1 && typeof ytPlayer.setPlaybackRate === 'function') {
              try {
                ytPlayer.setPlaybackRate(rate);
              } catch {}
            }
          } else {
            ytPlayer.cueVideoById(videoToCue, resumeTime);
          }
          lastYtSwitchRef.current = {
            bookId: currentBook.id,
            videoId: videoToCue,
            start: resumeTime,
            at: Date.now(),
          };
        } catch (e) {
          console.warn('Failed to cue video on YouTube player:', e);
        }
      }
    } else {
      setCurrentTime(0);
      currentTimeRef.current = 0;
      setDuration(0);
      setIsPlaying(false);
    }
  }, [currentBook?.id, ytPlayer, isYtReady]);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    // Clear any pending dismiss so rapid toasts each get a full 2.8s window
    // and an old timer can never clear a newer message early.
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage((cur) => (cur === message ? null : cur));
      toastTimerRef.current = null;
    }, 2800);
  }, []);

  // Cleanup toast dismiss timer on unmount (avoids setState after unmount)
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // YT IFrame API gave up loading (blocked/offline): stop pretending and say so.
  const reportYtApiBlocked = useCallback(() => {
    setYtBlocked(true);
    isPlayingRef.current = false;
    setIsPlaying(false);
    showToast('נגן יוטיוב לא נטען — בדקו חיבור לרשת או חוסם פרסומות');
  }, [showToast]);

  // Clean player rebuild (auto-heal or manual retry): drops the
  // possibly-dead binding, resets ready flags so the UI shows truthful
  // "loading", and forces YouTubeHost to construct on a FRESH iframe div
  // (re-constructing on an occupied div leaves ghost bindings behind:
  // audible audio with dead getters). Play intent is preserved on the auto
  // path so the sync effect resumes at the last known position once ready.
  const rebuildYtPlayer = useCallback((manual: boolean) => {
    ytBadTickRef.current = 0;
    ytStuckTickRef.current = 0;
    ytLastClockRef.current = -1;
    ytPausedStreakRef.current = 0;
    ytCuedStreakRef.current = 0;
    if (manual) {
      ytRebuildCountRef.current = 0;
      setYtPlayer(null);
      setIsYtReady(false);
      setYtBlocked(false);
      setYtError(null);
      pendingAutoPlayRef.current = null;
      showToast('מנסה לטעון את נגן יוטיוב שוב…');
      setYtRetryToken((t) => t + 1);
      return;
    }
    ytRebuildCountRef.current += 1;
    if (ytRebuildCountRef.current > 3) {
      // Fresh players keep coming up dead — stop looping, say so truthfully.
      ytRebuildCountRef.current = 0;
      reportYtApiBlocked();
      return;
    }
    setYtPlayer(null);
    setIsYtReady(false);
    setYtBlocked(false);
    setYtError(null);
    pendingAutoPlayRef.current = true;
    showToast('מזהה תקלה בנגן — מחבר מחדש…');
    setYtRetryToken((t) => t + 1);
  }, [showToast, reportYtApiBlocked]);

  // Manual recovery from the blocked state (banner "try again" button).
  const retryYt = useCallback(() => {
    rebuildYtPlayer(true);
  }, [rebuildYtPlayer]);

  const clearYtError = useCallback(() => {
    setYtError(null);
  }, []);

  // A video failed inside the YT player (embed-blocked/deleted/private/...).
  // Pause truthfully + explain — previously this was a console.warn only,
  // leaving a dead 00:00 slider with a lying play button.
  const reportYtError = useCallback(
    (code: number) => {
      const message =
        code === 100
          ? 'הסרטון לא נמצא או פרטי — ייתכן שנמחק מיוטיוב'
          : code === 101 || code === 150
            ? 'הסרטון חסום להטמעה — נסו לצפות בו ישירות ביוטיוב'
            : code === 5
              ? 'שגיאת נגן יוטיוב — נסו שוב בעוד רגע'
              : code === 2
                ? 'בקשה לא תקינה לנגן — נסו שוב'
                : 'נגן יוטיוב נתקל בשגיאה';
      setYtError({ bookId: currentBookIdRef.current, code, message });
      isPlayingRef.current = false;
      setIsPlaying(false);
      saveProgressNow();
      showToast(message);
    },
    [showToast, saveProgressNow],
  );

  // Latest books snapshot for stable callbacks (avoids recreating
  // markBookCompleted on every progress save, which would restart the
  // YT poller interval every ~1.5s while playing).
  const booksRef = useRef<Book[]>(books);
  useEffect(() => {
    booksRef.current = books;
  }, [books]);

  const markBookCompleted = useCallback((bookId: string) => {
    setBooks((prev) => {
      const target = prev.find((b) => b.id === bookId);
      if (!target || target.category === 'completed') return prev;
      const updated = prev.map((b) =>
        b.id === bookId
          ? { ...b, category: 'completed' as const, lastListenedAt: new Date().toISOString() }
          : b,
      );
      try {
        localStorage.setItem('lyra_user_books_clean', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save completion:', e);
      }
      return updated;
    });
    setIsPlaying(false);
    saveProgressNow();
    if (currentBookIdRef.current === bookId) {
      const doneBook = booksRef.current.find((b) => b.id === bookId);
      showToast(doneBook ? `סיימת את "${doneBook.title}"!` : 'סיימת את הספר!');
    }
  }, [saveProgressNow, showToast]);

  // Push current position to the OS (lock-screen scrubber, earphones, car BT).
  // Browsers throw on invalid values (no metadata yet, duration 0) — safe to ignore.
  const syncMediaPositionState = useCallback(() => {
    try {
      const ms = navigator.mediaSession;
      if (!ms?.setPositionState) return;
      const dur = Math.floor(duration);
      const pos = Math.floor(currentTimeRef.current);
      if (dur > 0 && pos >= 0 && pos <= dur) {
        ms.setPositionState({ duration: dur, playbackRate: playbackSpeed, position: pos });
      }
    } catch {
      // Invalid state — the next tick will retry once values settle
    }
  }, [duration, playbackSpeed]);

  // YouTube polling interval to keep time & duration accurate and save progress
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (currentBook?.youtubeId && ytPlayer && isYtReady) {
      interval = setInterval(() => {
        // Per-tick binding health snapshot (evaluated after the try/catch).
        let tickState: number | null = null;
        let tickClock: number | null = null;
        let tickOk = false;
        try {
          // Two-way state sync: the player can pause/stop outside our UI
          // (earphone tap routed to the iframe, YT native controls, phone call).
          // Mirror definitive states into the app so icons/lock-screen stay true.
          // YT states: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued.
          if (typeof ytPlayer.getPlayerState === 'function') {
            const st = ytPlayer.getPlayerState();
            if (typeof st === 'number') tickState = st;
            if (st === 1) {
              ytPausedStreakRef.current = 0;
              ytCuedStreakRef.current = 0;
              if (!isPlayingRef.current) setIsPlaying(true);
            } else if (st === 2) {
              ytPausedStreakRef.current += 1;
              ytCuedStreakRef.current = 0;
              if (ytPausedStreakRef.current >= 2 && isPlayingRef.current) {
                setIsPlaying(false);
                saveProgressNow();
              }
            } else if ((st === 5 || st === -1) && isPlayingRef.current) {
              // Self-heal: we intend to play but the player is sitting cued/
              // unstarted (e.g. a cue won a race against a load). Nudge it.
              ytPausedStreakRef.current = 0;
              ytCuedStreakRef.current += 1;
              if (ytCuedStreakRef.current >= 2) {
                try {
                  if (typeof ytPlayer.playVideo === 'function') ytPlayer.playVideo();
                } catch {}
                ytCuedStreakRef.current = 0;
              }
            } else {
              ytPausedStreakRef.current = 0;
              if (st === 3) ytCuedStreakRef.current = 0;
              // NOTE: ENDED(0) is owned by YouTubeHost.onStateChange (fires once
              // per finish and advances or completes) — the poller stays out so
              // completion toasts can't repeat while state 0 persists.
            }
          }
          if (typeof ytPlayer.getCurrentTime === 'function') {
            const ytTime = ytPlayer.getCurrentTime();
            if (typeof ytTime === 'number' && !isNaN(ytTime) && ytTime >= 0) {
              tickClock = ytTime;
              // Skip poller writes while an optimistic seek is in flight
              // so rapid ±10s taps don't flicker back to the old position.
              if (Date.now() >= seekPendingUntilRef.current) {
                const sec = Math.floor(ytTime);
                // Only push if drifted (>=1s) to avoid re-render churn
                if (Math.abs(sec - currentTimeRef.current) >= 1) {
                  setCurrentTime(sec);
                  currentTimeRef.current = sec;
                }

                const now = Date.now();
                if (now - lastSaveTimestampRef.current >= 1500) {
                  lastSaveTimestampRef.current = now;
                  saveProgressNow(sec);
                }
              }
            }
          }
          if (typeof ytPlayer.getDuration === 'function') {
            const ytDur = ytPlayer.getDuration();
            if (typeof ytDur === 'number' && ytDur > 0 && ytDur !== duration) {
              const learned = Math.floor(ytDur);
              setDuration(learned);
              // Persist the ground-truth video length back into the book so
              // import-time guesses (1800s fallbacks, 3600s single placeholder,
              // 0s XML unknowns) self-heal instead of living forever.
              const liveBookId = currentBookIdRef.current;
              const liveIdx = currentChapterIndexRef.current ?? 0;
              const stored = booksRef.current.find((b) => b.id === liveBookId);
              if (stored) {
                const isPlChapter =
                  stored.isPlaylist && stored.chapters?.[liveIdx] !== undefined;
                const storedDur = isPlChapter
                  ? stored.chapters[liveIdx].duration || 0
                  : stored.totalDurationSeconds || 0;
                if (Math.abs(storedDur - learned) >= 2) {
                  setBooks((prev) =>
                    prev.map((b) => {
                      if (b.id !== liveBookId) return b;
                      if (b.isPlaylist && b.chapters?.[liveIdx]) {
                        const chapters = b.chapters.map((c, i) =>
                          i === liveIdx ? { ...c, duration: learned } : c,
                        );
                        return {
                          ...b,
                          chapters,
                          totalChapters: chapters.length,
                          totalDurationSeconds: chapters.reduce(
                            (s, c) => s + (c.duration || 0),
                            0,
                          ),
                        };
                      }
                      return { ...b, totalDurationSeconds: learned };
                    }),
                  );
                }
              }
            }
          }
          syncMediaPositionState();
          tickOk = true;
        } catch {
          // ignore
        }

        // Player-binding health: while we intend to play, the getters must
        // work AND the clock must advance. A dead binding (getters throw) or
        // ghost playback (state PLAYING, clock frozen ~4s) means the iframe
        // outlived our API handle — rebuild instead of lying. The sync
        // effect resumes at the last known position once the fresh player
        // is ready.
        if (isPlayingRef.current) {
          if (!tickOk) {
            ytBadTickRef.current += 1;
            ytStuckTickRef.current = 0;
          } else {
            ytBadTickRef.current = 0;
            // Responsive getters = live binding — reset the rebuild cap.
            if (tickState !== null) ytRebuildCountRef.current = 0;
            if (tickState === 1 && tickClock !== null) {
              if (
                ytLastClockRef.current >= 0 &&
                Math.abs(tickClock - ytLastClockRef.current) < 0.5
              ) {
                ytStuckTickRef.current += 1;
              } else {
                ytStuckTickRef.current = 0;
              }
              ytLastClockRef.current = tickClock;
            } else {
              ytStuckTickRef.current = 0;
              if (tickClock !== null) ytLastClockRef.current = tickClock;
            }
          }
          if (ytBadTickRef.current >= 6 || ytStuckTickRef.current >= 8) {
            rebuildYtPlayer(false);
            return;
          }
        } else {
          ytBadTickRef.current = 0;
          ytStuckTickRef.current = 0;
        }

        // Sleep timer countdown
        if (isPlaying) {
          setSleepTimerSecondsRemaining((prev) => {
            if (prev === null) return null;
            if (prev <= 1) {
              if (ytPlayer && typeof ytPlayer.pauseVideo === 'function') {
                ytPlayer.pauseVideo();
              }
              setIsPlaying(false);
              saveProgressNow();
              showToast('טיימר שינה כיבה את ההאזנה');
              return null;
            }
            return prev - 1;
          });
        }
      }, 500);
    } else if (isPlaying && currentBook && !currentBook.youtubeId) {
      // Synthetic timer for standard non-YouTube audio tracks
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + 1 * playbackSpeed;
          currentTimeRef.current = Math.floor(next);

          const now = Date.now();
          if (now - lastSaveTimestampRef.current >= 1500) {
            lastSaveTimestampRef.current = now;
            saveProgressNow(Math.floor(next));
          }

          if (next >= duration) {
            const finishedId = currentBookIdRef.current;
            setIsPlaying(false);
            saveProgressNow(duration);
            if (finishedId) markBookCompleted(finishedId);
            return duration;
          }
          return next;
        });

        syncMediaPositionState();

        setSleepTimerSecondsRemaining((prev) => {
          if (prev === null) return null;
          if (prev <= 1) {
            setIsPlaying(false);
            saveProgressNow();
            showToast('טיימר שינה כיבה את ההאזנה');
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, currentBook?.youtubeId, ytPlayer, isYtReady, duration, playbackSpeed, saveProgressNow, syncMediaPositionState, markBookCompleted, rebuildYtPlayer]);

  const flushPendingSeek = useCallback(() => {
    const target = pendingSeekTargetRef.current;
    pendingSeekTargetRef.current = null;
    seekDebounceTimerRef.current = null;
    if (target === null || target === undefined) return;
    // Keep poller from overwriting until YT catches up
    seekPendingUntilRef.current = Date.now() + 600;
    try {
      if (ytPlayer && isYtReady && typeof ytPlayer.seekTo === 'function') {
        ytPlayer.seekTo(target, true);
      }
    } catch (e) {
      console.warn('YT seek error:', e);
    }
    saveProgressNow(Math.floor(target));
  }, [ytPlayer, isYtReady, saveProgressNow]);



  const playPause = useCallback(() => {
    if (!currentBook) {
      showToast('אנא הוסף או בחר ספר שמע מהספרייה');
      return;
    }

    // Ignore rapid toggles while YT state is settling (~400ms lock)
    const now = Date.now();
    if (now - playToggleLockRef.current < 400) return;
    playToggleLockRef.current = now;

    // Dead zone: YT book but no usable player because the API is blocked.
    // The old fallback flipped a local "playing" flag with no sound and no
    // advancing clock — a frozen 00:00 that looks exactly like this bug.
    if (currentBook.youtubeId && (!ytPlayer || !isYtReady)) {
      if (ytBlocked) {
        reportYtApiBlocked();
        return;
      }
      // Player still loading (API script in flight, onReady pending): stay
      // truthfully paused and remember the intent — the [currentBook?.id]
      // sync effect autoplays once the player is ready, and the poller then
      // flips the icon. Never fake "playing" with no time source, or the
      // bar + 00:00:00 sit frozen under a lying pause icon.
      pendingAutoPlayRef.current = true;
      showToast('נגן יוטיוב עדיין נטען — ההשמעה תתחיל אוטומטית');
      return;
    }

    if (currentBook.youtubeId && ytPlayer && isYtReady) {
      try {
        // Prefer local intent over getPlayerState (which lags during buffering)
        if (isPlayingRef.current) {
          ytPlayer.pauseVideo();
          setIsPlaying(false);
          saveProgressNow();
        } else {
          ytPlayer.playVideo();
          setIsPlaying(true);
        }
        return;
      } catch (e) {
        console.warn('YT player playPause error:', e);
      }
    }

    setIsPlaying((prev) => {
      const next = !prev;
      if (!next) {
        saveProgressNow();
      }
      return next;
    });
  }, [currentBook, ytPlayer, isYtReady, saveProgressNow, ytBlocked, reportYtApiBlocked]);

  const seekTo = useCallback((seconds: number) => {
    if (!currentBook) return;
    // duration may be stale (0 before YT reports); fall back to large upper bound
    const upper = duration > 0 ? duration : 99 * 3600;
    const clamped = Math.max(0, Math.min(seconds, upper));
    const floored = Math.floor(clamped);
    // Optimistic UI — always accumulate from the ref, never stale state
    setCurrentTime(floored);
    currentTimeRef.current = floored;
    pendingSeekTargetRef.current = floored;
    seekPendingUntilRef.current = Date.now() + 600;

    // Debounce the expensive YT seek + storage write (trailing edge 120ms)
    if (seekDebounceTimerRef.current) clearTimeout(seekDebounceTimerRef.current);
    seekDebounceTimerRef.current = setTimeout(() => {
      flushPendingSeek();
    }, 120);
  }, [currentBook, duration, flushPendingSeek]);

  const jumpRelative = useCallback((deltaSeconds: number) => {
    if (!currentBook) return;
    // Accumulate on top of any pending seek so spam never loses clicks:
    // 5x +10s = +50s even before YT confirms.
    const base = pendingSeekTargetRef.current ?? currentTimeRef.current;
    seekTo(base + deltaSeconds);
  }, [currentBook, seekTo]);

  const flushPendingChapterYt = useCallback(() => {
    const pending = pendingChapterYtRef.current;
    pendingChapterYtRef.current = null;
    chapterYtTimerRef.current = null;
    if (!pending) return;
    try {
      if (ytPlayer && isYtReady) {
        if (isPlayingRef.current) {
          ytPlayer.loadVideoById(pending.youtubeId, pending.resumeTime);
        } else {
          ytPlayer.cueVideoById(pending.youtubeId, pending.resumeTime);
        }
      }
    } catch (e) {
      console.warn('YT load chapter video error:', e);
    }
  }, [ytPlayer, isYtReady]);

  const selectChapter = useCallback((index: number) => {
    if (!currentBook) return;
    if (index >= 0 && index < currentBook.chapters.length) {
      // 1. Save progress of current chapter before leaving
      saveProgressNow();
      // New video intent — drop any previous player error banner.
      clearYtError();

      const targetChapter = currentBook.chapters[index];
      // 2. Restore saved timestamp in the target chapter (or 0)
      const resumeTime = currentBook.chapterProgress?.[index] ?? 0;

      // 3. Update active refs and local state synchronously so spam taps accumulate
      currentTimeRef.current = resumeTime;
      currentChapterIndexRef.current = index;
      pendingSeekTargetRef.current = null;
      seekPendingUntilRef.current = Date.now() + 600;
      setCurrentTime(resumeTime);
      // Swap the scrubber to the new chapter's length immediately — otherwise
      // the previous chapter's duration lingers until the YT poller corrects
      // it (same "wrong chapter time" flash as on fresh import).
      if (targetChapter.youtubeId) {
        setDuration(targetChapter.duration || 0);
      }

      setBooks((prev) => {
        const nextBooks = prev.map((b) => {
          if (b.id !== currentBook.id) return b;
          return {
            ...b,
            currentChapterIndex: index,
            currentTimeSeconds: resumeTime,
            youtubeId: targetChapter.youtubeId || b.youtubeId,
            chapterProgress: {
              ...(b.chapterProgress || {}),
              [index]: resumeTime,
            },
            lastListenedAt: new Date().toISOString(),
          };
        });
        try {
          localStorage.setItem('lyra_user_books_clean', JSON.stringify(nextBooks));
          localStorage.setItem('lyra_last_book_id', currentBook.id);
        } catch (e) {
          console.warn('Failed to save to localStorage:', e);
        }
        return nextBooks;
      });

      // 4. Debounce the expensive YT load so rapid next/prev ends on the last chapter
      if (targetChapter.youtubeId && ytPlayer && isYtReady) {
        pendingChapterYtRef.current = {
          youtubeId: targetChapter.youtubeId,
          resumeTime,
        };
        if (chapterYtTimerRef.current) clearTimeout(chapterYtTimerRef.current);
        chapterYtTimerRef.current = setTimeout(() => {
          flushPendingChapterYt();
        }, 150);
      } else if (!targetChapter.youtubeId) {
        let chapterOffset = 0;
        for (let i = 0; i < index; i++) {
          chapterOffset += currentBook.chapters[i].duration;
        }
        seekTo(chapterOffset + resumeTime);
      }
    }
  }, [currentBook, saveProgressNow, flushPendingChapterYt, seekTo, ytPlayer, isYtReady]);

  const nextChapter = useCallback(() => {
    if (!currentBook) return;
    // Use ref index so rapid taps accumulate instead of repeating the same +1
    const liveIdx = currentChapterIndexRef.current ?? currentBook.currentChapterIndex ?? 0;
    if (liveIdx < currentBook.chapters.length - 1) {
      const nextIdx = liveIdx + 1;
      // Pre-advance ref synchronously so the next spam tap builds on it
      currentChapterIndexRef.current = nextIdx;
      selectChapter(nextIdx);
      const title = currentBook.chapters[nextIdx]?.title;
      if (title) showToast(`עבר אל ${title}`);
    } else {
      showToast('הגעת לסוף הספר / הפלייליסט');
    }
  }, [currentBook, selectChapter]);

  const previousChapter = useCallback(() => {
    if (!currentBook) return;
    const liveIdx = currentChapterIndexRef.current ?? currentBook.currentChapterIndex ?? 0;
    if (liveIdx > 0) {
      const prevIdx = liveIdx - 1;
      currentChapterIndexRef.current = prevIdx;
      selectChapter(prevIdx);
      const title = currentBook.chapters[prevIdx]?.title;
      if (title) showToast(`עבר אל ${title}`);
    } else {
      seekTo(0);
      showToast('תחילת הפרק');
    }
  }, [currentBook, selectChapter, seekTo]);

  // ---------- Media Session API: earphones / lock-screen / OS media keys ----------
  // OS-level gesture map (device taps become these actions):
  //   play/pause tap → toggle (state-aware, never double-toggles)
  //   next-track (e.g. triple-tap) → next chapter
  //   previous-track (e.g. triple-tap back) → restart chapter if >3s in, else previous
  //   hold-to-seek / lock-screen scrub → ±seek / exact seek

  // What the OS shows: book + chapter + cover art
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    try {
      if (!currentBook) {
        navigator.mediaSession.playbackState = 'none';
        return;
      }
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentChapter
          ? `פרק ${currentChapter.number}: ${currentChapter.title}`
          : currentBook.title,
        artist: currentBook.author || '',
        album: currentBook.title || '',
        artwork: currentBook.coverUrl ? [{ src: currentBook.coverUrl }] : [],
      });
    } catch {
      // Media Session unsupported — earphone taps fall back to OS defaults
    }
  }, [currentBook, currentChapter]);

  // Whether the OS shows ▶ or ⏸ (lock-screen, earphone LED/hub, car display)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = !currentBook
        ? 'none'
        : isPlaying
          ? 'playing'
          : 'paused';
    } catch {}
  }, [currentBook, isPlaying]);

  // Which earphone/OS gestures the app responds to
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    const set = (
      action: MediaSessionAction,
      handler: ((details: MediaSessionActionDetails) => void) | null,
    ) => {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        // Action unsupported on this browser — skip it
      }
    };
    set('play', () => {
      if (!isPlayingRef.current) playPause();
    });
    set('pause', () => {
      if (isPlayingRef.current) playPause();
    });
    set('nexttrack', () => {
      nextChapter();
    });
    set('previoustrack', () => {
      if (currentTimeRef.current > 3) seekTo(0);
      else previousChapter();
    });
    set('seekbackward', (d) => {
      jumpRelative(-(d.seekOffset || 10));
    });
    set('seekforward', (d) => {
      jumpRelative(d.seekOffset || 10);
    });
    set('seekto', (d) => {
      if (typeof d.seekTime === 'number') seekTo(d.seekTime);
    });
    return () => {
      (
        ['play', 'pause', 'previoustrack', 'nexttrack', 'seekbackward', 'seekforward', 'seekto'] as MediaSessionAction[]
      ).forEach((a) => set(a, null));
    };
  }, [playPause, nextChapter, previousChapter, seekTo, jumpRelative]);

  const selectBook = (bookId: string, autoPlay = true, navigateToPlayer = true) => {
    // 1. Save progress in the outgoing book
    saveProgressNow();
    // New video intent — drop any previous player error banner.
    clearYtError();

    const rawTarget = books.find((b) => b.id === bookId);
    if (!rawTarget) return;

    // Replaying a completed book starts it over as a fresh listen.
    let target = rawTarget;
    if (rawTarget.category === 'completed') {
      target = {
        ...rawTarget,
        category: 'listening' as const,
        currentChapterIndex: 0,
        currentTimeSeconds: 0,
        chapterProgress: {},
      };
      setBooks((prev) => prev.map((b) => (b.id === bookId ? target : b)));
    }

    const resumeChapterIndex = target.currentChapterIndex || 0;
    const resumeTime =
      target.chapterProgress?.[resumeChapterIndex] ?? target.currentTimeSeconds ?? 0;

    setCurrentBookId(bookId);
    currentBookIdRef.current = bookId;
    currentChapterIndexRef.current = resumeChapterIndex;
    currentTimeRef.current = resumeTime;

    setCurrentTime(resumeTime);
    setDuration(
      target.isPlaylist
        ? target.chapters?.[resumeChapterIndex]?.duration || 0
        : target.totalDurationSeconds || 0,
    );

    try {
      localStorage.setItem('lyra_last_book_id', bookId);
    } catch {}

    const videoToPlay =
      (target.isPlaylist && target.chapters?.[resumeChapterIndex]?.youtubeId) || target.youtubeId;

    // Record intent first so the [currentBook?.id] sync effect can honor/skip
    // correctly, including when YT isn't ready yet.
    pendingAutoPlayRef.current = autoPlay;
    // Keep poller from clobbering the fresh resume position with a stale
    // getCurrentTime() read while the new video loads.
    seekPendingUntilRef.current = Date.now() + 1000;
    ytPausedStreakRef.current = 0;
    ytCuedStreakRef.current = 0;

    if (videoToPlay && ytPlayer && isYtReady) {
      try {
        if (autoPlay) {
          ytPlayer.loadVideoById(videoToPlay, resumeTime);
          const rate = playbackSpeedRef.current;
          if (rate && rate !== 1 && typeof ytPlayer.setPlaybackRate === 'function') {
            try {
              ytPlayer.setPlaybackRate(rate);
            } catch {}
          }
          isPlayingRef.current = true;
          setIsPlaying(true);
        } else {
          ytPlayer.cueVideoById(videoToPlay, resumeTime);
          isPlayingRef.current = false;
          setIsPlaying(false);
        }
        lastYtSwitchRef.current = {
          bookId,
          videoId: videoToPlay,
          start: resumeTime,
          at: Date.now(),
        };
        pendingAutoPlayRef.current = null;
      } catch (e) {
        console.warn('Failed to switch video on YT player:', e);
      }
    } else if (videoToPlay) {
      // YT target but no ready player (still loading, or blocked): stay
      // truthfully paused — the clock has no time source until the player
      // is ready, so claiming "playing" freezes the bar at 00:00:00.
      // Intent stays pending: the sync effect consumes it once YT is ready.
      isPlayingRef.current = false;
      setIsPlaying(false);
    } else {
      if (autoPlay) {
        isPlayingRef.current = true;
        setIsPlaying(true);
      } else {
        isPlayingRef.current = false;
        setIsPlaying(false);
      }
    }

    if (navigateToPlayer) {
      setActiveTab('player');
    }
  };

  // Atomic bookmark jump: book + chapter + timestamp in a SINGLE YT command.
  // The old BookmarksView flow (selectBook → delayed selectChapter → delayed
  // seekTo) raced: the seek's 120ms debounce fired BEFORE the chapter's 150ms
  // load, so the chapter load (with stale resumeTime) overwrote the bookmark
  // seek — landing on the right book but the wrong time.
  const jumpToBookmark = (bookId: string, timestampSeconds: number, chapterNumber?: number) => {
    const rawTarget = books.find((b) => b.id === bookId);
    if (!rawTarget) return;

    // Save outgoing position first (no-op if same book, harmless).
    saveProgressNow();
    // New video intent — drop any previous player error banner.
    clearYtError();

    // Revive completed books as listening, but keep the bookmark position
    // (unlike selectBook which restarts completed books from 0).
    let target = rawTarget;
    if (rawTarget.category === 'completed') {
      target = { ...rawTarget, category: 'listening' as const };
    }

    const hasChapters = (target.chapters?.length ?? 0) > 0;
    let chapterIdx = target.currentChapterIndex || 0;
    if (chapterNumber && chapterNumber > 0 && hasChapters) {
      const candidate = chapterNumber - 1;
      if (candidate >= 0 && candidate < (target.chapters?.length ?? 0)) {
        chapterIdx = candidate;
      }
    }

    const targetChapter = hasChapters ? target.chapters[chapterIdx] : undefined;
    const startSeconds = Math.max(0, Math.floor(timestampSeconds || 0));

    // Kill any in-flight debounced chapter-load / seek so they can't
    // overwrite this jump after it issues.
    if (chapterYtTimerRef.current) {
      clearTimeout(chapterYtTimerRef.current);
      chapterYtTimerRef.current = null;
    }
    pendingChapterYtRef.current = null;
    if (seekDebounceTimerRef.current) {
      clearTimeout(seekDebounceTimerRef.current);
      seekDebounceTimerRef.current = null;
    }
    pendingSeekTargetRef.current = null;

    const isYtChapter = Boolean(targetChapter?.youtubeId || (!hasChapters && target.youtubeId));
    const videoToPlay =
      targetChapter?.youtubeId || (!hasChapters ? target.youtubeId : undefined);

    // For non-YT chapters timestamp is absolute (global) time; for YT it is
    // per-video (chapter-local) time.
    let chapterOffset = 0;
    if (!isYtChapter && hasChapters) {
      for (let i = 0; i < chapterIdx; i++) {
        chapterOffset += target.chapters[i].duration || 0;
      }
    }
    const displayTime = isYtChapter ? startSeconds : chapterOffset + startSeconds;

    setCurrentBookId(bookId);
    currentBookIdRef.current = bookId;
    currentChapterIndexRef.current = chapterIdx;
    currentTimeRef.current = displayTime;
    setCurrentTime(displayTime);
    setDuration(
      target.isPlaylist
        ? target.chapters?.[chapterIdx]?.duration || 0
        : target.totalDurationSeconds || 0,
    );

    try {
      localStorage.setItem('lyra_last_book_id', bookId);
    } catch {}

    pendingAutoPlayRef.current = true;
    seekPendingUntilRef.current = Date.now() + 1000;
    ytPausedStreakRef.current = 0;
    ytCuedStreakRef.current = 0;

    const chapterProgressUpdate = isYtChapter
      ? startSeconds
      : displayTime;

    setBooks((prev) =>
      prev.map((b) => {
        if (b.id !== bookId) return b;
        return {
          ...b,
          category: 'listening' as const,
          currentChapterIndex: chapterIdx,
          currentTimeSeconds: chapterProgressUpdate,
          youtubeId: targetChapter?.youtubeId || b.youtubeId,
          chapterProgress: {
            ...(b.chapterProgress || {}),
            [chapterIdx]: chapterProgressUpdate,
          },
          lastListenedAt: new Date().toISOString(),
        };
      }),
    );
    try {
      const raw = localStorage.getItem('lyra_user_books_clean');
      if (raw) {
        const stored: Book[] = JSON.parse(raw);
        const updated = stored.map((b) => {
          if (b.id !== bookId) return b;
          return {
            ...b,
            category: 'listening' as const,
            currentChapterIndex: chapterIdx,
            currentTimeSeconds: chapterProgressUpdate,
            youtubeId: targetChapter?.youtubeId || b.youtubeId,
            chapterProgress: {
              ...(b.chapterProgress || {}),
              [chapterIdx]: chapterProgressUpdate,
            },
            lastListenedAt: new Date().toISOString(),
          };
        });
        localStorage.setItem('lyra_user_books_clean', JSON.stringify(updated));
      }
    } catch (e) {
      console.warn('Failed to save bookmark jump:', e);
    }

    if (videoToPlay && ytPlayer && isYtReady) {
      try {
        ytPlayer.loadVideoById(videoToPlay, startSeconds);
        const rate = playbackSpeedRef.current;
        if (rate && rate !== 1 && typeof ytPlayer.setPlaybackRate === 'function') {
          try {
            ytPlayer.setPlaybackRate(rate);
          } catch {}
        }
        isPlayingRef.current = true;
        setIsPlaying(true);
        lastYtSwitchRef.current = { bookId, videoId: videoToPlay, start: startSeconds, at: Date.now() };
        pendingAutoPlayRef.current = null;
      } catch (e) {
        console.warn('Bookmark jump YT load failed:', e);
      }
    } else if (videoToPlay) {
      // YT target but no ready player (still loading, or blocked): stay
      // truthfully paused — same frozen-00:00 dead zone as selectBook.
      // pendingAutoPlayRef is already true above; the sync effect consumes
      // it once YT is ready.
      isPlayingRef.current = false;
      setIsPlaying(false);
    } else {
      // Non-YT book: optimistic playing state; the synthetic timer drives
      // the clock immediately.
      isPlayingRef.current = true;
      setIsPlaying(true);
    }

    setActiveTab('player');
  };

  const addBook = (newBook: Book) => {
    setBooks((prev) => [newBook, ...prev]);
    setCurrentBookId(newBook.id);
    setCurrentTime(0);
    // Keep refs in sync synchronously — state updates are async and a
    // progress save / poller tick before the sync effect runs would
    // otherwise attribute position to the previous book / chapter index.
    currentBookIdRef.current = newBook.id;
    currentChapterIndexRef.current = 0;
    currentTimeRef.current = 0;
    pendingSeekTargetRef.current = null;
    // Chapter-level duration for fresh playlists (per-video scrubber),
    // book total otherwise — never show the whole-book sum as one chapter.
    setDuration(
      newBook.isPlaylist
        ? newBook.chapters?.[0]?.duration || 0
        : newBook.totalDurationSeconds,
    );
    // New books always start PAUSED — cue without autoplaying so the UI
    // (and lock-screen) indicator correctly shows the paused state.
    setIsPlaying(false);
    isPlayingRef.current = false;
    pendingAutoPlayRef.current = null;
    clearYtError();
    showToast(`"${newBook.title}" נוסף בהצלחה!`);

    if (newBook.youtubeId && ytPlayer && isYtReady) {
      try {
        ytPlayer.cueVideoById(newBook.youtubeId, 0);
        // Record the handshake so the [currentBook?.id] sync effect skips
        // its redundant second cue for this exact switch.
        lastYtSwitchRef.current = {
          bookId: newBook.id,
          videoId: newBook.youtubeId,
          start: 0,
          at: Date.now(),
        };
      } catch (e) {
        console.warn('YT cue error:', e);
      }
    }
  };

  const deleteBook = (bookId: string) => {
    setBooks((prev) => prev.filter((b) => b.id !== bookId));
    setBookmarks((prev) => prev.filter((bm) => bm.bookId !== bookId));
    if (currentBookId === bookId) {
      const remaining = books.filter((b) => b.id !== bookId);
      if (remaining.length > 0) {
        setCurrentBookId(remaining[0].id);
        if (remaining[0].youtubeId && ytPlayer && isYtReady) {
          try {
            ytPlayer.cueVideoById(remaining[0].youtubeId, remaining[0].currentTimeSeconds || 0);
          } catch {}
        }
      } else {
        setCurrentBookId(null);
        if (ytPlayer && typeof ytPlayer.stopVideo === 'function') {
          try {
            ytPlayer.stopVideo();
          } catch {}
        }
      }
      setIsPlaying(false);
    }
    showToast('הספר נמחק מהספרייה');
  };

  const setPlaybackSpeed = (speed: number) => {
    setPlaybackSpeedState(speed);
    try {
      localStorage.setItem('lyra_playback_speed', speed.toString());
    } catch {}
    if (currentBook?.youtubeId && ytPlayer && isYtReady) {
      try {
        ytPlayer.setPlaybackRate(speed);
      } catch (e) {
        console.warn('YT speed error:', e);
      }
    }
    showToast(`מהירות נגינה: ${speed}x`);
  };

  const setSleepTimer = (minutes: number | null) => {
    setSleepTimerMinutes(minutes);
    if (minutes === null) {
      setSleepTimerSecondsRemaining(null);
      showToast('טיימר שינה כבוי');
    } else {
      setSleepTimerSecondsRemaining(minutes * 60);
      showToast(`טיימר שינה הוגדר ל-${minutes} דקות`);
    }
  };

  const toggleBookmark = () => {
    if (!currentBook) {
      showToast('אין תוכן פעיל לשמירת סימנייה');
      return;
    }
    const formatted = formatTime(currentTime);
    const existing = bookmarks.find(
      (bm) => bm.bookId === currentBook.id && Math.abs(bm.timestampSeconds - currentTime) < 5
    );

    if (existing) {
      setBookmarks((prev) => prev.filter((bm) => bm.id !== existing.id));
      showToast('הסימנייה הוסרה');
    } else {
      const newBm: Bookmark = {
        id: `bm-${Date.now()}`,
        bookId: currentBook.id,
        bookTitle: currentBook.title,
        bookCover: currentBook.coverUrl,
        chapterNumber: currentChapter ? currentChapter.number : 1,
        chapterTitle: currentChapter ? currentChapter.title : 'סרטון מלא',
        timestampSeconds: Math.floor(currentTime),
        timestampFormatted: formatted,
        createdAt: 'הרגע',
      };
      setBookmarks((prev) => [newBm, ...prev]);
      showToast(`סימנייה נשמרה ב-${formatted}`);
    }
  };

  const removeBookmark = (id: string) => {
    setBookmarks((prev) => prev.filter((bm) => bm.id !== id));
    showToast('הסימנייה נמחקה');
  };

  const importYouTubeAudio = async (inputStr: string): Promise<boolean> => {
    if (!inputStr.trim()) return false;

    // Check for YouTube Playlist first!
    const playlistId = extractYouTubePlaylistId(inputStr);
    if (playlistId) {
      showToast('מייבא פלייליסט מיוטיוב ומחלק לפרקים...');
      try {
        const plData = await fetchYouTubePlaylist(playlistId);
        const firstVideoId = plData.chapters[0]?.youtubeId;

        const totalDuration = plData.chapters.reduce(
          (sum, c) => sum + (c.duration || 1800),
          0
        );

        const newBook: Book = {
          id: `yt-pl-${playlistId}-${Date.now()}`,
          youtubeId: firstVideoId,
          youtubePlaylistId: playlistId,
          isPlaylist: true,
          title: plData.title,
          author: plData.author,
          coverUrl: plData.thumbnailUrl,
          source: 'פלייליסט יוטיוב',
          category: 'listening',
          totalChapters: plData.chapters.length,
          currentChapterIndex: 0,
          totalDurationSeconds: totalDuration || 3600,
          currentTimeSeconds: 0,
          // Streamed from YouTube — requires connection, no true offline file.
          isOfflineAvailable: false,
          chapters: plData.chapters,
        };

        addBook(newBook);
        setActiveTab('player');
        showToast(`פלייליסט "${plData.title}" יובא עם ${plData.chapters.length} פרקים!`);
        return true;
      } catch (err) {
        console.error('Error importing playlist:', err);
        showToast('שגיאה בייבוא הפלייליסט');
        return false;
      }
    }

    // Otherwise single video - as requested, NOT divided into chapters!
    const videoId = extractYouTubeId(inputStr);
    if (!videoId) {
      showToast('קישור לא תקין, אנא הדבק קישור לסרטון או לפלייליסט מיוטיוב');
      return false;
    }

    showToast('טוען נתונים מיוטיוב...');
    const meta = await fetchYouTubeMetadata(videoId);

    // Initial placeholder duration until YouTube reports exact duration
    const initialDuration = 3600;

    const newBook: Book = {
      id: `yt-${videoId}-${Date.now()}`,
      youtubeId: videoId,
      isPlaylist: false,
      title: meta.title,
      author: meta.author,
      coverUrl: meta.thumbnailUrl,
      source: 'וידאו יוטיוב',
      category: 'listening',
      totalChapters: 1,
      currentChapterIndex: 0,
      totalDurationSeconds: initialDuration,
      currentTimeSeconds: 0,
      // Streamed from YouTube — requires connection, no true offline file.
      isOfflineAvailable: false,
      chapters: [],
    };

    addBook(newBook);
    setActiveTab('player');
    return true;
  };

  const exportLibrary = () => {
    try {
      const backup = buildBackup({
        books,
        bookmarks,
        settings: { playbackSpeed, audioSoundEnabled },
      });
      downloadBackup(backup);
      showToast(
        books.length === 0 && bookmarks.length === 0
          ? 'הספרייה ריקה — יוצא גיבוי ריק'
          : `הגיבוי הורד: ${books.length} ספרים, ${bookmarks.length} סימניות`,
      );
    } catch {
      showToast('ייצוא הגיבוי נכשל — נסו שוב');
    }
  };

  const applyBackup = (backup: LyraBackup, mode: ImportMode) => {
    if (mode === 'replace') {
      setBooks(backup.books);
      setBookmarks(backup.bookmarks);
      if (!backup.books.some((b) => b.id === currentBookIdRef.current)) {
        setCurrentBookId(backup.books.length > 0 ? backup.books[0].id : null);
      }
      showToast(`הספרייה הוחלפה: ${backup.books.length} ספרים, ${backup.bookmarks.length} סימניות`);
    } else {
      setBooks((prev) => mergeBooks(prev, backup.books));
      setBookmarks((prev) => mergeBookmarks(prev, backup.bookmarks));
      showToast(`הגיבוי מוזג: ${backup.books.length} ספרים, ${backup.bookmarks.length} סימניות`);
    }
    // Global prefs apply in both modes — no per-item conflict is possible.
    setPlaybackSpeedState(backup.settings.playbackSpeed);
    try {
      localStorage.setItem('lyra_playback_speed', backup.settings.playbackSpeed.toString());
    } catch {}
    setAudioSoundEnabledState(backup.settings.audioSoundEnabled);
    try {
      localStorage.setItem('lyra_sound_enabled', String(backup.settings.audioSoundEnabled));
    } catch {}
  };

  const formatTime = (totalSeconds: number): string => {
    if (!totalSeconds || isNaN(totalSeconds)) return '00:00:00';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  const formatRemainingTime = (currentSeconds: number, totalSeconds: number): string => {
    if (!totalSeconds || isNaN(totalSeconds)) return '-00:00:00';
    const remaining = Math.max(0, totalSeconds - currentSeconds);
    return `-${formatTime(remaining)}`;
  };

  return (
    <AudioContext.Provider
      value={{
        books,
        currentBook,
        currentChapter,
        isPlaying,
        currentTime,
        duration,
        playbackSpeed,
        sleepTimerMinutes,
        sleepTimerSecondsRemaining,
        activeTab,
        activeFilter,
        bookmarks,
        isChaptersDrawerOpen,
        isSleepTimerModalOpen,
        isSearchModalOpen,
        isAccountModalOpen,
        audioSoundEnabled,
        toastMessage,
        isVideoMode,
        toggleVideoMode,
        ytPlayer,
        setYtPlayer,
        isYtReady,
        setIsYtReady,
        ytBlocked,
        setYtBlocked,
        reportYtApiBlocked,
        ytRetryToken,
        retryYt,
        ytError,
        reportYtError,
        clearYtError,
        playPause,
        seekTo,
        jumpRelative,
        nextChapter,
        previousChapter,
        selectChapter,
        selectBook,
        jumpToBookmark,
        addBook,
        deleteBook,
        markBookCompleted,
        setPlaybackSpeed,
        setSleepTimer,
        toggleBookmark,
        removeBookmark,
        importYouTubeAudio,
        exportLibrary,
        applyBackup,
        setActiveTab,
        setActiveFilter,
        setIsChaptersDrawerOpen,
        setIsSleepTimerModalOpen,
        setIsSearchModalOpen,
        setIsAccountModalOpen,
        setAudioSoundEnabled,
        showToast,
        formatTime,
        formatRemainingTime,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
}
