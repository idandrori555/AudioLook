import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Book, Chapter, Bookmark, TabType, FilterType } from '../types';
import { INITIAL_BOOKS, INITIAL_BOOKMARKS } from '../data/mockData';
import {
  extractYouTubeId,
  extractYouTubePlaylistId,
  fetchYouTubeMetadata,
  fetchYouTubePlaylist,
} from '../services/youtube';

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
  
  // Handlers
  playPause: () => void;
  seekTo: (timeSeconds: number) => void;
  jumpRelative: (deltaSeconds: number) => void;
  nextChapter: () => void;
  previousChapter: () => void;
  selectChapter: (index: number) => void;
  selectBook: (bookId: string, autoPlay?: boolean, navigateToPlayer?: boolean) => void;
  addBook: (book: Book) => void;
  deleteBook: (bookId: string) => void;
  setPlaybackSpeed: (speed: number) => void;
  setSleepTimer: (minutes: number | null) => void;
  toggleBookmark: () => void;
  removeBookmark: (id: string) => void;
  importYouTubeAudio: (url: string) => Promise<boolean>;
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
  const [books, setBooks] = useState<Book[]>(() => {
    try {
      localStorage.removeItem('audiolook_books');
      const saved = localStorage.getItem('audiolook_user_books_clean');
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
      const savedId = localStorage.getItem('audiolook_last_book_id');
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
  const [duration, setDuration] = useState<number>(() => currentBook?.totalDurationSeconds || 0);

  const [playbackSpeed, setPlaybackSpeedState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('audiolook_playback_speed');
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
      const saved = localStorage.getItem('audiolook_active_tab') as TabType;
      if (saved && ['library', 'player', 'bookmarks', 'settings'].includes(saved)) {
        return saved;
      }
    } catch {}
    return 'library';
  });

  const setActiveTab = (tab: TabType) => {
    setActiveTabState(tab);
    try {
      localStorage.setItem('audiolook_active_tab', tab);
    } catch {}
  };

  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  
  // YouTube player reference & state
  const [ytPlayer, setYtPlayer] = useState<any>(null);
  const [isYtReady, setIsYtReady] = useState(false);
  const [isVideoMode, setIsVideoModeState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('audiolook_video_mode');
      if (saved !== null) return saved === 'true';
    } catch {}
    return true;
  });

  const setIsVideoMode = (mode: boolean) => {
    setIsVideoModeState(mode);
    try {
      localStorage.setItem('audiolook_video_mode', String(mode));
    } catch {}
  };

  const toggleVideoMode = () => {
    setIsVideoModeState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('audiolook_video_mode', String(next));
      } catch {}
      return next;
    });
  };

  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => {
    try {
      localStorage.removeItem('audiolook_bookmarks');
      const saved = localStorage.getItem('audiolook_user_bookmarks_clean');
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
      const saved = localStorage.getItem('audiolook_sound_enabled');
      if (saved !== null) return saved === 'true';
    } catch {}
    return true;
  });

  const setAudioSoundEnabled = (enabled: boolean) => {
    setAudioSoundEnabledState(enabled);
    try {
      localStorage.setItem('audiolook_sound_enabled', String(enabled));
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

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

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
    localStorage.setItem('audiolook_user_books_clean', JSON.stringify(books));
  }, [books]);

  // Persist bookmarks
  useEffect(() => {
    localStorage.setItem('audiolook_user_bookmarks_clean', JSON.stringify(bookmarks));
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
            localStorage.setItem('audiolook_user_books_clean', JSON.stringify(updated));
            localStorage.setItem('audiolook_last_book_id', bId);
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
      const raw = localStorage.getItem('audiolook_user_books_clean');
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
        localStorage.setItem('audiolook_user_books_clean', JSON.stringify(updated));
      }
      localStorage.setItem('audiolook_last_book_id', bId);
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

  // Sync current time & duration when switching book
  useEffect(() => {
    if (currentBook) {
      const chIdx = currentBook.currentChapterIndex || 0;
      const resumeTime =
        currentBook.chapterProgress?.[chIdx] ?? currentBook.currentTimeSeconds ?? 0;
      setCurrentTime(resumeTime);
      currentTimeRef.current = resumeTime;
      currentChapterIndexRef.current = chIdx;
      setDuration(currentBook.totalDurationSeconds || 0);

      const videoToCue =
        (currentBook.isPlaylist && currentBook.chapters?.[chIdx]?.youtubeId) ||
        currentBook.youtubeId;

      if (videoToCue && ytPlayer && isYtReady) {
        try {
          ytPlayer.cueVideoById(videoToCue, resumeTime);
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

  // YouTube polling interval to keep time & duration accurate and save progress
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (currentBook?.youtubeId && ytPlayer && isYtReady) {
      interval = setInterval(() => {
        try {
          if (typeof ytPlayer.getCurrentTime === 'function') {
            const ytTime = ytPlayer.getCurrentTime();
            if (typeof ytTime === 'number' && !isNaN(ytTime) && ytTime >= 0) {
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
              setDuration(Math.floor(ytDur));
            }
          }
        } catch {
          // ignore
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
            setIsPlaying(false);
            saveProgressNow(duration);
            return duration;
          }
          return next;
        });

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
  }, [isPlaying, currentBook?.youtubeId, ytPlayer, isYtReady, duration, playbackSpeed, saveProgressNow]);

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
  }, [currentBook, ytPlayer, isYtReady, saveProgressNow]);

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

      const targetChapter = currentBook.chapters[index];
      // 2. Restore saved timestamp in the target chapter (or 0)
      const resumeTime = currentBook.chapterProgress?.[index] ?? 0;

      // 3. Update active refs and local state synchronously so spam taps accumulate
      currentTimeRef.current = resumeTime;
      currentChapterIndexRef.current = index;
      pendingSeekTargetRef.current = null;
      seekPendingUntilRef.current = Date.now() + 600;
      setCurrentTime(resumeTime);

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
          localStorage.setItem('audiolook_user_books_clean', JSON.stringify(nextBooks));
          localStorage.setItem('audiolook_last_book_id', currentBook.id);
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

  const selectBook = (bookId: string, autoPlay = true, navigateToPlayer = true) => {
    // 1. Save progress in the outgoing book
    saveProgressNow();

    const target = books.find((b) => b.id === bookId);
    if (!target) return;

    const resumeChapterIndex = target.currentChapterIndex || 0;
    const resumeTime =
      target.chapterProgress?.[resumeChapterIndex] ?? target.currentTimeSeconds ?? 0;

    setCurrentBookId(bookId);
    currentBookIdRef.current = bookId;
    currentChapterIndexRef.current = resumeChapterIndex;
    currentTimeRef.current = resumeTime;

    setCurrentTime(resumeTime);
    setDuration(target.totalDurationSeconds || 0);

    try {
      localStorage.setItem('audiolook_last_book_id', bookId);
    } catch {}

    const videoToPlay =
      (target.isPlaylist && target.chapters?.[resumeChapterIndex]?.youtubeId) || target.youtubeId;

    if (videoToPlay && ytPlayer && isYtReady) {
      try {
        if (autoPlay) {
          ytPlayer.loadVideoById(videoToPlay, resumeTime);
          setIsPlaying(true);
        } else {
          ytPlayer.cueVideoById(videoToPlay, resumeTime);
        }
      } catch (e) {
        console.warn('Failed to switch video on YT player:', e);
      }
    } else if (autoPlay) {
      setIsPlaying(true);
    }

    if (navigateToPlayer) {
      setActiveTab('player');
    }
  };

  const addBook = (newBook: Book) => {
    setBooks((prev) => [newBook, ...prev]);
    setCurrentBookId(newBook.id);
    setCurrentTime(0);
    setDuration(newBook.totalDurationSeconds);
    showToast(`"${newBook.title}" נוסף בהצלחה!`);

    if (newBook.youtubeId && ytPlayer && isYtReady) {
      try {
        ytPlayer.loadVideoById(newBook.youtubeId, 0);
        setIsPlaying(true);
      } catch (e) {
        console.warn('YT load error:', e);
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
      localStorage.setItem('audiolook_playback_speed', speed.toString());
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
          isOfflineAvailable: true,
          sizeOffline: `${Math.max(1, plData.chapters.length) * 35}MB`,
          chapters: plData.chapters,
        };

        addBook(newBook);
        setActiveTab('player');
        setIsVideoMode(true);
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
      isOfflineAvailable: true,
      sizeOffline: '72MB',
      chapters: [],
    };

    addBook(newBook);
    setActiveTab('player');
    setIsVideoMode(true);
    return true;
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
        playPause,
        seekTo,
        jumpRelative,
        nextChapter,
        previousChapter,
        selectChapter,
        selectBook,
        addBook,
        deleteBook,
        setPlaybackSpeed,
        setSleepTimer,
        toggleBookmark,
        removeBookmark,
        importYouTubeAudio,
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
