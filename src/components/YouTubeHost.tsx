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
    playPause,
    isPlaying,
    nextChapter,
  } = useAudio();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerInstanceRef = useRef<any>(null);
  const [slotRect, setSlotRect] = useState<DOMRect | null>(null);

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
        setSlotRect(slot.getBoundingClientRect());
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    const interval = setInterval(updatePosition, 300);

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
          videoId: currentBook?.youtubeId || '',
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
              if (currentBook?.youtubeId) {
                const chIdx = currentBook.currentChapterIndex || 0;
                const resumeTime =
                  currentBook.chapterProgress?.[chIdx] ??
                  currentBook.currentTimeSeconds ??
                  0;
                event.target.cueVideoById(currentBook.youtubeId, resumeTime);
              }
            },
            onStateChange: (event: any) => {
              // 0 = ENDED, 1 = PLAYING, 2 = PAUSED, 3 = BUFFERING
              if (event.data === 0) {
                if (currentBook?.isPlaylist) {
                  nextChapter();
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
  }, [currentBook?.youtubeId, setYtPlayer, setIsYtReady, isPlaying]);

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
