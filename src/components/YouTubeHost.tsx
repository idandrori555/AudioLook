import React, { useEffect, useRef, useState } from 'react';
import { useAudio } from '../context/AudioContext';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export default function YouTubeHost() {
  const {
    currentBook,
    setYtPlayer,
    setIsYtReady,
    activeTab,
    isVideoMode,
    nextChapter,
    markBookCompleted,
  } = useAudio();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerInstanceRef = useRef<any>(null);
  const nextChapterRef = useRef(nextChapter);
  const markCompletedRef = useRef(markBookCompleted);
  const endStateRef = useRef<{ bookId: string | null; isPlaylist: boolean; isLastChapter: boolean }>({
    bookId: null,
    isPlaylist: false,
    isLastChapter: true,
  });
  const [slotRect, setSlotRect] = useState<DOMRect | null>(null);

  // Keep event-handler refs fresh without re-subscribing the YT player
  const currentBookRef = useRef(currentBook);
  useEffect(() => {
    currentBookRef.current = currentBook;
  }, [currentBook]);
  useEffect(() => {
    nextChapterRef.current = nextChapter;
  }, [nextChapter]);
  useEffect(() => {
    markCompletedRef.current = markBookCompleted;
  }, [markBookCompleted]);
  useEffect(() => {
    const chCount = currentBook?.chapters?.length ?? 0;
    const idx = currentBook?.currentChapterIndex ?? 0;
    endStateRef.current = {
      bookId: currentBook?.id ?? null,
      isPlaylist: Boolean(currentBook?.isPlaylist),
      isLastChapter: !currentBook?.isPlaylist || chCount === 0 || idx >= chCount - 1,
    };
  }, [currentBook?.id, currentBook?.isPlaylist, currentBook?.chapters?.length, currentBook?.currentChapterIndex]);

  // Load YouTube IFrame API if not already present
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // Update target slot position when in player view with video mode
  useEffect(() => {
    if (activeTab !== 'player' || !isVideoMode || !currentBook?.youtubeId) {
      setSlotRect(null);
      return;
    }

    const updatePosition = () => {
      const slot = document.getElementById('yt-player-target-slot');
      if (slot) {
        const rect = slot.getBoundingClientRect();
        // Only trigger a re-render when the slot actually moved/resized (>1px)
        // so scroll/resize spam doesn't jitter the fixed overlay.
        setSlotRect((prev) => {
          if (
            prev &&
            Math.abs(prev.top - rect.top) < 1 &&
            Math.abs(prev.left - rect.left) < 1 &&
            Math.abs(prev.width - rect.width) < 1 &&
            Math.abs(prev.height - rect.height) < 1
          ) {
            return prev;
          }
          return rect;
        });
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, { passive: true });

    const interval = setInterval(updatePosition, 500);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
      clearInterval(interval);
    };
  }, [activeTab, isVideoMode, currentBook?.youtubeId]);

  // Initialize YT Player once the API is loaded
  useEffect(() => {
    let checkInterval: NodeJS.Timeout | null = null;

    const initPlayer = () => {
      if (playerInstanceRef.current || !containerRef.current) return;

      try {
        const player = new window.YT.Player('audiolook-yt-iframe-root', {
          height: '100%',
          width: '100%',
          videoId: currentBookRef.current?.youtubeId || '',
          playerVars: {
            autoplay: 1,
            controls: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            enablejsapi: 1,
            origin: window.location.origin,
            fs: 1,
          },
          events: {
            onReady: (event: any) => {
              playerInstanceRef.current = event.target;
              setYtPlayer(event.target);
              setIsYtReady(true);
              const latestBook = currentBookRef.current;
              if (latestBook?.youtubeId) {
                const chIdx = latestBook.currentChapterIndex || 0;
                const resumeTime =
                  latestBook.chapterProgress?.[chIdx] ??
                  latestBook.currentTimeSeconds ??
                  0;
                try {
                  event.target.cueVideoById(latestBook.youtubeId, resumeTime);
                } catch { }
              }
            },
            onStateChange: (event: any) => {
              // 0 = ENDED, 1 = PLAYING, 2 = PAUSED, 3 = BUFFERING
              // Use refs so the handler never goes stale across book changes.
              // Fires once per finish: advance mid-playlist, complete at the end.
              if (event.data === 0) {
                const end = endStateRef.current;
                if (end.isPlaylist && !end.isLastChapter) {
                  nextChapterRef.current();
                } else if (end.bookId) {
                  markCompletedRef.current(end.bookId);
                }
              }
            },
            onError: (err: any) => {
              console.warn('YouTube Player encountered an issue:', err);
            },
          },
        });
      } catch (e) {
        console.warn('Error instantiating YT.Player:', e);
      }
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
      checkInterval = setInterval(() => {
        if (window.YT && window.YT.Player) {
          initPlayer();
          if (checkInterval) clearInterval(checkInterval);
        }
      }, 400);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
    // NOTE: intentionally omit isPlaying/nextChapter/currentBook — the player is a
    // singleton; re-running init on playback toggles caused re-init checks + glitches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setYtPlayer, setIsYtReady]);

  const shouldDisplayInSlot =
    activeTab === 'player' && isVideoMode && Boolean(currentBook?.youtubeId) && slotRect;

  return (
    <div
      ref={containerRef}
      style={
        shouldDisplayInSlot
          ? {
              position: 'fixed',
              top: `${slotRect.top}px`,
              left: `${slotRect.left}px`,
              width: `${slotRect.width}px`,
              height: `${slotRect.height}px`,
              zIndex: 35,
              opacity: 1,
              pointerEvents: 'auto',
              borderRadius: '1rem',
              overflow: 'hidden',
              boxShadow: '0 20px 40px -15px rgba(0,0,0,0.8)',
            }
          : {
              position: 'fixed',
              top: '-9999px',
              left: '-9999px',
              width: '320px',
              height: '180px',
              opacity: 0,
              pointerEvents: 'none',
              zIndex: -1,
            }
      }
      className="bg-black transition-opacity duration-200"
    >
      <div id="audiolook-yt-iframe-root" className="w-full h-full" />
    </div>
  );
}
