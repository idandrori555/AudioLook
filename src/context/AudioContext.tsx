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
  jumpToBookmark: (bookId: string, timestampSeconds: number, chapterNumber?: number) => void;
  addBook: (book: Book) => void;
  deleteBook: (bookId: string) => void;
  markBookCompleted: (bookId: string) => void;
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
  // Default is cover-audio mode (האזנה). The _v2 key retires the old default
  // (video) so every install picks up audio-first once, then remembers choice.
  const VIDEO_MODE_KEY = 'audiolook_video_mode_v2';
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
      setDuration(currentBook.totalDurationSeconds || 0);

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
          pendingAutoPlayRef.current = null;
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
        localStorage.setItem('audiolook_user_books_clean', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save completion:', e);
      }
      return updated;
    });
    setIsPlaying(false);
    saveProgressNow();
    if (currentBookIdRef.current === bookId) {
      const doneBook = books.find((b) => b.id === bookId);
      showToast(doneBook ? `סיימת את "${doneBook.title}"!` : 'סיימת את הספר!');
    }
  }, [books, saveProgressNow, showToast]);

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
        try {
          // Two-way state sync: the player can pause/stop outside our UI
          // (earphone tap routed to the iframe, YT native controls, phone call).
          // Mirror definitive states into the app so icons/lock-screen stay true.
          // YT states: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued.
          if (typeof ytPlayer.getPlayerState === 'function') {
            const st = ytPlayer.getPlayerState();
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
          syncMediaPositionState();
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
  }, [isPlaying, currentBook?.youtubeId, ytPlayer, isYtReady, duration, playbackSpeed, saveProgressNow, syncMediaPositionState, markBookCompleted]);

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
    setDuration(target.totalDurationSeconds || 0);

    try {
      localStorage.setItem('audiolook_last_book_id', bookId);
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
    } else {
      if (autoPlay) {
        isPlayingRef.current = true;
        setIsPlaying(true);
      } else {
        isPlayingRef.current = false;
        setIsPlaying(false);
      }
      // Intent stays pending: the sync effect consumes it once YT is ready.
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
    if (target.totalDurationSeconds) setDuration(target.totalDurationSeconds);

    try {
      localStorage.setItem('audiolook_last_book_id', bookId);
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
      const raw = localStorage.getItem('audiolook_user_books_clean');
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
        localStorage.setItem('audiolook_user_books_clean', JSON.stringify(updated));
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
    } else {
      // YT not ready (or non-YT book): optimistic playing state; the
      // [currentBook?.id] sync effect consumes pendingAutoPlayRef once ready.
      isPlayingRef.current = true;
      setIsPlaying(true);
    }

    setActiveTab('player');
  };

  const addBook = (newBook: Book) => {
    setBooks((prev) => [newBook, ...prev]);
    setCurrentBookId(newBook.id);
    setCurrentTime(0);
    currentTimeRef.current = 0;
    setDuration(newBook.totalDurationSeconds);
    // New books always start PAUSED — cue without autoplaying so the UI
    // (and lock-screen) indicator correctly shows the paused state.
    setIsPlaying(false);
    showToast(`"${newBook.title}" נוסף בהצלחה!`);

    if (newBook.youtubeId && ytPlayer && isYtReady) {
      try {
        ytPlayer.cueVideoById(newBook.youtubeId, 0);
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
        jumpToBookmark,
        addBook,
        deleteBook,
        markBookCompleted,
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
