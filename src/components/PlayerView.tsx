import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion, useMotionValue, animate } from 'motion/react';
import type { PanInfo } from 'motion/react';
import { useAudio } from '../context/AudioContext';
import { springSnappy, tx, useAppReducedMotion } from './motion';
import { FALLBACK_COVER } from './CoverImg';

export default function PlayerView() {
  const {
    currentBook,
    currentChapter,
    isPlaying,
    currentTime,
    duration,
    playbackSpeed,
    sleepTimerSecondsRemaining,
    sleepTimerMinutes,
    playPause,
    seekTo,
    jumpRelative,
    nextChapter,
    previousChapter,
    setPlaybackSpeed,
    toggleBookmark,
    bookmarks,
    setActiveTab,
    setIsChaptersDrawerOpen,
    setIsSleepTimerModalOpen,
    formatTime,
    formatRemainingTime,
    isVideoMode,
    toggleVideoMode,
  } = useAudio();

  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);
  // Nudge counters — bumped per tap so rapid ±10s spam re-triggers the spring
  // via key remount instead of fighting a boolean + timeout (never gets stuck).
  const [replayNudge, setReplayNudge] = useState(0);
  const [forwardNudge, setForwardNudge] = useState(0);
  const scrubberRef = useRef<HTMLDivElement | null>(null);
  const [dragSeekTime, setDragSeekTime] = useState<number | null>(null);
  const reduced = useAppReducedMotion();

  // Chapter-toss direction: +1 = moved forward (next), -1 = moved back.
  // Derived from the live index so every source (buttons, drawer, earphones,
  // auto-advance) tosses the right way. Time flows left-to-right here (LTR
  // scrubber), so "next" throws the old card off to the left like a page turn.
  const chapterIdx = currentBook?.currentChapterIndex ?? 0;
  const bookId = currentBook?.id ?? null;
  // Render-phase derivation (not an effect): AnimatePresence resolves exit/
  // enter variants during the commit render, so the direction must already be
  // fresh in that pass. Deriving it in useEffect updated tossDir one commit
  // too late — the backward skip replayed the forward toss. React applies
  // these setStates with an immediate re-render before committing (no flash).
  const [prevPos, setPrevPos] = useState<{ bookId: string | null; idx: number }>({ bookId, idx: chapterIdx });
  const [tossDir, setTossDir] = useState<1 | -1>(1);
  if (prevPos.bookId !== bookId || prevPos.idx !== chapterIdx) {
    if (prevPos.bookId === bookId && prevPos.idx !== chapterIdx) {
      setTossDir(chapterIdx > prevPos.idx ? 1 : -1);
    }
    setPrevPos({ bookId, idx: chapterIdx });
  }
  const chapterKey = currentChapter ? currentChapter.id : `single-${bookId}`;

  // Tinder-style card toss variants (custom = { dir, soft }).
  // Slightly overshooting spring so chapter changes feel playful, not stiff.
  // `soft` enters are for fling switches: the flung card's flight IS the
  // show, so the incoming card just materializes instead of streaking in.
  const tossSpring = { type: 'spring', stiffness: 380, damping: 30, mass: 0.7 } as const;
  interface CoverCustom {
    dir: 1 | -1;
    soft: boolean;
  }
  const tossVariants = {
    enter: (c: CoverCustom) =>
      reduced
        ? { opacity: 0 }
        : c.soft
          ? { opacity: 0, scale: 0.93 }
          : { opacity: 0, x: c.dir * 260, rotate: c.dir * 10, scale: 0.9 },
    center: { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 },
    exit: (c: CoverCustom) =>
      reduced
        ? { opacity: 0 }
        : { opacity: 0, x: -c.dir * 340, rotate: -c.dir * 14, scale: 0.93 },
  };

  const speedOptions = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

  // Check if current timestamp is bookmarked
  const isCurrentlyBookmarked = currentBook
    ? bookmarks.some(
      (bm) => bm.bookId === currentBook.id && Math.abs(bm.timestampSeconds - currentTime) < 6
    )
    : false;

  const [isDraggingScrubber, setIsDraggingScrubber] = useState(false);

  const calculateSeekTime = (clientX: number) => {
    if (!scrubberRef.current || !currentBook || duration <= 0) return 0;
    const rect = scrubberRef.current.getBoundingClientRect();
    const clickXFromLeft = clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, clickXFromLeft / rect.width));
    return fraction * duration;
  };

  const handleScrubberPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!currentBook) return;
    setIsDraggingScrubber(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch { }
    // Preview only — commit a single seek on pointer-up to avoid YT seek floods
    setDragSeekTime(calculateSeekTime(e.clientX));
  };

  const handleScrubberPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingScrubber || !currentBook) return;
    // Local preview, no seekTo here (spam-proof)
    setDragSeekTime(calculateSeekTime(e.clientX));
  };

  const commitScrubber = (clientX: number) => {
    const targetSeconds = calculateSeekTime(clientX);
    setDragSeekTime(null);
    seekTo(targetSeconds);
  };

  const handleScrubberPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingScrubber) {
      setIsDraggingScrubber(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch { }
      commitScrubber(e.clientX);
    }
  };

  const handleScrubberPointerCancel = () => {
    setIsDraggingScrubber(false);
    setDragSeekTime(null);
  };

  const handleReplay10 = () => {
    if (!reduced) setReplayNudge((n) => n + 1);
    jumpRelative(-10);
  };

  const handleForward10 = () => {
    if (!reduced) setForwardNudge((n) => n + 1);
    jumpRelative(10);
  };

  // While dragging, show the preview position instead of the live playback position
  const displayTime = isDraggingScrubber && dragSeekTime !== null ? dragSeekTime : currentTime;
  const displayPercent = duration > 0 ? Math.min(100, Math.max(0, (displayTime / duration) * 100)) : 0;

  // Up-next chapter
  const nextChapterObj =
    currentBook && currentBook.chapters
      ? currentBook.chapters[currentBook.currentChapterIndex + 1] || null
      : null;

  if (!currentBook) {
    return (
      <div className="min-h-[calc(100dvh-4rem)] flex flex-col bg-[#121316] text-[#e3e2e6] select-none page-with-nav justify-center items-center p-6 text-center" dir="rtl">
        <div className="w-16 h-16 rounded-full bg-white/[0.04] text-[#ffb86b] flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-[32px]">headphones</span>
        </div>
        <h2 className="text-[20px] font-semibold text-white mb-2">אין ספר שמע או סרטון פעיל</h2>
        <p className="text-[13px] text-[#9d9ca4] max-w-xs mb-6">
          הדביקו קישור יוטיוב בספרייה כדי להפעיל ולצפות בסרטון ישירות באפליקציה.
        </p>
        <button
          onClick={() => setActiveTab('library')}
          className="px-5 py-2.5 rounded-xl bg-[#ffb86b] text-[#492900] font-medium text-[14px] hover:bg-[#ffc685] transition-colors cursor-pointer flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">local_library</span>
          <span>מעבר לספרייה</span>
        </button>
      </div>
    );
  }

  const isYouTubeBook = Boolean(currentBook.youtubeId);

  // Tinder gesture: fling the cover to switch chapters — free in 2D, the
  // frame tilts with your finger, and the card breaks out of its square.
  // Same availability as the next/prev buttons (playlists + multi-chapter).
  const canSwitchChapters = Boolean(
    currentBook.isPlaylist ||
      (!isYouTubeBook && currentBook.chapters && currentBook.chapters.length > 1),
  );
  // Frame tilt driven by the drag (the frame owns no rotate variants, so no
  // fight with the card's enter/exit toss). Card x/y stay internal to the
  // dragged element, so exits correctly continue from the release point.
  const frameRotate = useMotionValue(0);
  // While true the frame stops clipping, so the card visibly leaves its box.
  const [coverFree, setCoverFree] = useState(false);
  // Soft incoming toss right after a fling switch (the flight was the show).
  const [softEnter, setSoftEnter] = useState(false);
  const coverRestoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const softEnterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (coverRestoreTimer.current) clearTimeout(coverRestoreTimer.current);
      if (softEnterTimer.current) clearTimeout(softEnterTimer.current);
    };
  }, []);

  const scheduleCoverRestore = (ms: number) => {
    if (coverRestoreTimer.current) clearTimeout(coverRestoreTimer.current);
    coverRestoreTimer.current = setTimeout(() => setCoverFree(false), ms);
  };
  const settleFrame = () => {
    animate(frameRotate, 0, { type: 'spring', stiffness: 320, damping: 24 });
  };

  const handleCoverDragStart = () => {
    if (!canSwitchChapters) return;
    if (coverRestoreTimer.current) clearTimeout(coverRestoreTimer.current);
    if (softEnterTimer.current) clearTimeout(softEnterTimer.current);
    setCoverFree(true);
  };
  const handleCoverDrag = (_: unknown, info: PanInfo) => {
    frameRotate.set(Math.max(-14, Math.min(14, info.offset.x * 0.06)));
  };
  const handleCoverDragEnd = (_: unknown, info: PanInfo) => {
    if (!canSwitchChapters) return;
    settleFrame();
    const { x: offsetX } = info.offset;
    const { x: velocityX } = info.velocity;
    // Screen pixels: fling left = next chapter, fling right = previous,
    // matching the toss direction (old card exits to the left on "next").
    // Vertical movement is free play and always springs back.
    if (offsetX <= -90 || velocityX <= -600) {
      setSoftEnter(true);
      if (softEnterTimer.current) clearTimeout(softEnterTimer.current);
      softEnterTimer.current = setTimeout(() => setSoftEnter(false), 650);
      nextChapter();
      // Let the flung card fly out freely before re-clipping the frame.
      scheduleCoverRestore(550);
    } else if (offsetX >= 90 || velocityX >= 600) {
      setSoftEnter(true);
      if (softEnterTimer.current) clearTimeout(softEnterTimer.current);
      softEnterTimer.current = setTimeout(() => setSoftEnter(false), 650);
      previousChapter();
      scheduleCoverRestore(550);
    } else {
      // Below threshold: the elastic constraints spring the card home.
      scheduleCoverRestore(380);
    }
  };

  return (
    <div className="relative min-h-[calc(100dvh-4rem)] flex flex-col bg-[#121316] text-[#e3e2e6] select-none page-with-nav">
      {/* Header */}
      <header className="sticky top-0 inset-x-0 z-40 bg-[#121316]/90 backdrop-blur-md pt-safe border-b border-white/[0.05]">
        <div className="h-14 px-5 flex items-center justify-between max-w-md mx-auto">
          {/* Chevron / Down dismiss button */}
          <button
            onClick={() => setActiveTab('library')}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#9d9ca4] hover:text-[#e3e2e6] active:bg-white/5 transition-colors cursor-pointer"
            title="סגור תצוגה מורחבת לספרייה"
          >
            <span className="material-symbols-outlined text-[24px]">expand_more</span>
          </button>

          {/* Center Brand & Book Label */}
          <div className="flex flex-col items-center" />

          {/* Action: Chapter List drawer (For multi-chapter audiobooks or YouTube playlists) */}
          {(currentBook.isPlaylist || (!isYouTubeBook && currentBook.chapters && currentBook.chapters.length > 1)) && (
            <button
              onClick={() => setIsChaptersDrawerOpen(true)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#9d9ca4] hover:text-[#e3e2e6] active:bg-white/5 transition-colors cursor-pointer"
              id="chapters-modal-btn"
              title="רשימת פרקים"
            >
              <span className="material-symbols-outlined text-[21px]">list</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Player Content Area */}
      <main className="flex-1 flex flex-col w-full max-w-md mx-auto pt-3 pb-20 px-6 select-none justify-between">
        {/* Toggle Mode Bar for YouTube tracks */}
        {isYouTubeBook && (
          <div className="flex justify-center mb-3">
            <div className="flex items-center gap-1 bg-white/[0.05] p-1 rounded-full border border-white/[0.08]">
              <button
                onClick={() => !isVideoMode && toggleVideoMode()}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium transition-all cursor-pointer ${isVideoMode
                  ? 'bg-[#ffb86b] text-[#2c1700] shadow-sm'
                  : 'text-white/60 hover:text-white'
                  }`}
              >
                <span className="material-symbols-outlined text-[15px]">smart_display</span>
                <span>וידאו יוטיוב</span>
              </button>
              <button
                onClick={() => isVideoMode && toggleVideoMode()}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium transition-all cursor-pointer ${!isVideoMode
                  ? 'bg-[#ffb86b] text-[#2c1700] shadow-sm'
                  : 'text-white/60 hover:text-white'
                  }`}
              >
                <span className="material-symbols-outlined text-[15px]">headphones</span>
                <span>האזנה (כריכה)</span>
              </button>
            </div>
          </div>
        )}

        {/* Video / Artwork Display Frame */}
        <div className="w-full flex justify-center my-auto py-1">
          {isYouTubeBook && isVideoMode ? (
            /* Target slot measured by YouTubeHost to display the live YouTube video */
            <div
              id="yt-player-target-slot"
              className="relative w-full max-w-[360px] aspect-video rounded-2xl overflow-hidden shadow-[0_20px_40px_-15px_rgba(0,0,0,0.8)] border border-white/[0.08] bg-black flex items-center justify-center"
            >
              <span className="text-[12px] text-white/40">טוען נגן וידאו מיוטיוב...</span>
            </div>
          ) : (
            /* Standard or Audio-only Cover Artwork — shared-element target
               for the library-thumbnail → player morph */
            <div className="relative">
              <div
                aria-hidden="true"
                className={`absolute -inset-8 rounded-[2rem] bg-[#ffb86b]/20 blur-3xl pointer-events-none ${isPlaying && !reduced ? 'cover-aura-playing' : 'opacity-40'}`}
              />
            <motion.div
              layoutId={`cover-${currentBook.id}`}
              transition={tx(reduced, springSnappy)}
              initial={reduced ? false : { scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileTap={reduced ? undefined : { scale: 0.98 }}
              style={{ rotate: frameRotate }}
              className={`relative w-[min(58vw,30dvh)] max-w-72 aspect-square rounded-2xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.8)] border bg-[#18191c] transition-colors duration-500 ${coverFree ? 'overflow-visible z-20' : 'overflow-hidden'} ${isPlaying ? 'border-[#ffb86b]/30' : 'border-white/[0.08]'}`}
            >
              <AnimatePresence initial={false} custom={{ dir: tossDir, soft: softEnter }}>
                <motion.img
                  key={chapterKey}
                  custom={{ dir: tossDir, soft: softEnter }}
                  variants={tossVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={tx(reduced, tossSpring)}
                  drag={canSwitchChapters ? true : false}
                  dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                  dragElastic={0.55}
                  dragMomentum={false}
                  onDragStart={handleCoverDragStart}
                  onDrag={handleCoverDrag}
                  onDragEnd={handleCoverDragEnd}
                  whileDrag={{ cursor: 'grabbing', scale: 1.03 }}
                  className="absolute inset-0 w-full h-full object-cover rounded-2xl touch-pan-y cursor-grab"
                  title={canSwitchChapters ? 'גרור הצידה למעבר פרק' : undefined}
                  alt={currentBook.title}
                  src={currentBook.coverUrl}
                  draggable={false}
                  onError={(e) => {
                    const img = e.currentTarget;
                    if (!img.dataset.fb) {
                      img.dataset.fb = '1';
                      img.src = FALLBACK_COVER;
                    }
                  }}
                />
              </AnimatePresence>
            </motion.div>
            </div>
          )}
        </div>

        {/* Metadata Section: Book Title, Author, Quiet Chapter Subtitle */}
        <div className="text-center px-2 mt-4 mb-4">
          <h1 className="text-lg sm:text-xl font-bold text-[#e3e2e6] tracking-tight leading-snug line-clamp-2">
            {currentBook.title}
          </h1>
          <p className="text-sm font-normal text-[#9d9ca4] mt-1 truncate">{currentBook.author}</p>
          {currentChapter && (
            <button
              onClick={() => setIsChaptersDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 mt-2.5 px-3 py-1 rounded-full bg-white/[0.04] hover:bg-[#ffb86b]/10 ring-1 ring-transparent hover:ring-[#ffb86b]/25 text-[13px] text-[#ffb86b]/95 font-medium transition-all cursor-pointer overflow-hidden"
            >
              {isPlaying && !reduced && (
                <span className="flex items-end gap-[2px] h-3 flex-shrink-0" aria-hidden="true">
                  <span className="eq-bar w-[2.5px] rounded-full bg-[#ffb86b] h-3" style={{ animationDelay: '0ms' }} />
                  <span className="eq-bar w-[2.5px] rounded-full bg-[#ffb86b] h-3" style={{ animationDelay: '180ms' }} />
                  <span className="eq-bar w-[2.5px] rounded-full bg-[#ffb86b] h-3" style={{ animationDelay: '360ms' }} />
                </span>
              )}
              <AnimatePresence initial={false} mode="wait" custom={tossDir}>
                <motion.span
                  key={chapterKey}
                  custom={tossDir}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, x: tossDir * 48 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, x: -tossDir * 48 }}
                  transition={tx(reduced, springSnappy)}
                  className="truncate max-w-[280px]"
                >
                  פרק {currentChapter.number}: {currentChapter.title}
                </motion.span>
              </AnimatePresence>
              <span className="material-symbols-outlined text-[14px]">expand_more</span>
            </button>
          )}
        </div>

        {/* Refined Minimalist Scrubber & Timestamps */}
        <div className="w-full px-1 mb-5" dir="ltr">
          <div
            ref={scrubberRef}
            onPointerDown={handleScrubberPointerDown}
            onPointerMove={handleScrubberPointerMove}
            onPointerUp={handleScrubberPointerUp}
            onPointerCancel={handleScrubberPointerCancel}
            className="relative w-full py-3 cursor-pointer group touch-none select-none"
            id="scrubber-container"
          >
            {/* Background Track */}
            <div className="w-full h-[5px] rounded-full bg-white/10 overflow-hidden relative">
              {/* Active Progress Bar (LTR left-to-right) */}
              <div
                className="h-full bg-gradient-to-r from-[#e89838] to-[#ffc685] rounded-full shadow-[0_0_12px_rgba(232,152,56,0.6)]"
                id="progress-fill"
                style={{ width: `${displayPercent}%` }}
              />
            </div>
            {/* Thumb */}
            <div
              className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#ffb86b] shadow-md border-2 border-[#121316] pointer-events-none transition-transform ${isDraggingScrubber ? 'scale-125 ring-2 ring-[#ffb86b]/40' : 'group-hover:scale-125'
                }`}
              id="scrubber-head"
              style={{ left: `calc(${displayPercent}% - 8px)` }}
            />
          </div>

          {/* Timestamps */}
          <div className="flex items-center justify-between text-[12px] font-mono text-[#9d9ca4] px-0.5 tracking-tight select-none">
            <span className="text-[#e3e2e6]/80" id="elapsed-time">
              {formatTime(displayTime)}
            </span>
            <span id="remaining-time">{formatRemainingTime(displayTime, duration)}</span>
          </div>
        </div>

        {/* Tactile Ergonomic Primary Controls */}
        <div className="flex items-center justify-center gap-3 min-[380px]:gap-6 sm:gap-9 mb-6">
          {/* Next Chapter (For multi-chapter audiobooks or YouTube playlists) */}
          {(currentBook.isPlaylist || (!isYouTubeBook && currentBook.chapters && currentBook.chapters.length > 1)) && (
            <button
              onClick={nextChapter}
              aria-label="פרק הבא"
              className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-[#9d9ca4] hover:text-[#e3e2e6] active:scale-90 transition-all cursor-pointer"
              title="פרק הבא"
            >
              <span className="material-symbols-outlined text-[26px]">keyboard_double_arrow_right</span>
            </button>
          )}

          {/* Jump Forward 10s — rotary nudge re-triggers per tap via key */}
          <motion.button
            onClick={handleForward10}
            whileTap={reduced ? undefined : { scale: 0.88 }}
            aria-label="10 שניות קדימה"
            className="relative w-10 h-10 min-[380px]:w-12 min-[380px]:h-12 shrink-0 rounded-full flex items-center justify-center text-[#e3e2e6] hover:text-[#ffb86b] transition-colors cursor-pointer"
            id="btn-forward-10"
            title="קפוץ 10 שניות קדימה"
          >
            <motion.span
              key={forwardNudge}
              initial={reduced ? false : { rotate: 24, scale: 0.88 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={tx(reduced, springSnappy)}
              className="flex items-center justify-center"
            >
              <svg
                className="w-[30px] h-[30px]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <polyline points="21 3 21 8 16 8" />
                <text
                  x="12"
                  y="15.2"
                  textAnchor="middle"
                  fontSize="8"
                  fontFamily="Rubik, sans-serif"
                  fontWeight="700"
                  fill="currentColor"
                  stroke="none"
                >
                  10
                </text>
              </svg>
            </motion.span>
          </motion.button>

          {/* Centerpiece Warm Amber Play/Pause */}
          <motion.button
            onClick={playPause}
            whileTap={reduced ? undefined : { scale: 0.92 }}
            whileHover={reduced ? undefined : { scale: 1.04 }}
            aria-label="נגן או השהה"
            className={`relative isolate w-16 h-16 min-[380px]:w-[72px] min-[380px]:h-[72px] shrink-0 rounded-full bg-gradient-to-b from-[#ffc685] to-[#e89838] text-[#2c1700] flex items-center justify-center hover:brightness-105 transition-all cursor-pointer ${isPlaying ? 'shadow-[0_8px_36px_rgba(232,152,56,0.5)]' : 'shadow-[0_8px_24px_rgba(232,152,56,0.3)]'}`}
            id="main-play-btn"
          >
            {isPlaying && !reduced && (
              <span aria-hidden="true" className="play-halo pointer-events-none absolute -inset-1.5 rounded-full bg-[#e89838]/40 blur-md -z-10" />
            )}
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={isPlaying ? 'pause' : 'play'}
                initial={reduced ? false : { scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={reduced ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
                transition={tx(reduced, springSnappy)}
                className="material-symbols-outlined text-[38px] flex items-center justify-center"
                id="play-pause-icon"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {isPlaying ? 'pause' : 'play_arrow'}
              </motion.span>
            </AnimatePresence>
          </motion.button>


          {/* Jump Back 10s — rotary nudge re-triggers per tap via key */}
          <motion.button
            onClick={handleReplay10}
            whileTap={reduced ? undefined : { scale: 0.88 }}
            aria-label="10 שניות אחורה"
            className="relative w-10 h-10 min-[380px]:w-12 min-[380px]:h-12 shrink-0 rounded-full flex items-center justify-center text-[#e3e2e6] hover:text-[#ffb86b] transition-colors cursor-pointer"
            id="btn-replay-10"
            title="קפוץ 10 שניות אחורה"
          >
            <motion.span
              key={replayNudge}
              initial={reduced ? false : { rotate: -24, scale: 0.88 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={tx(reduced, springSnappy)}
              className="flex items-center justify-center"
            >
              <svg
                className="w-[30px] h-[30px]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <polyline points="3 3 3 8 8 8" />
                <text
                  x="12"
                  y="15.2"
                  textAnchor="middle"
                  fontSize="8"
                  fontFamily="Rubik, sans-serif"
                  fontWeight="700"
                  fill="currentColor"
                  stroke="none"
                >
                  10
                </text>
              </svg>
            </motion.span>
          </motion.button>



          {/* Previous Chapter (For multi-chapter audiobooks or YouTube playlists) */}
          {(currentBook.isPlaylist || (!isYouTubeBook && currentBook.chapters && currentBook.chapters.length > 1)) && (
            <button
              onClick={previousChapter}
              aria-label="פרק קודם"
              className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-[#9d9ca4] hover:text-[#e3e2e6] active:scale-90 transition-all cursor-pointer"
              title="פרק קודם"
            >
              <span className="material-symbols-outlined text-[26px]">keyboard_double_arrow_left</span>
            </button>
          )}
        </div>

        {/* Secondary Quiet Utility Strip (Speed, Sleep Timer, Bookmark) */}
        <div className="glass-static relative flex items-center justify-around flex-wrap gap-y-2 py-3 px-1 min-[380px]:px-2 rounded-2xl mb-5">
          <div className="glass-glint" />
          {/* Speed Selector */}
          <div className="relative">
            <button
              onClick={() => setIsSpeedMenuOpen(!isSpeedMenuOpen)}
              className="flex items-center gap-1.5 py-1 px-3 rounded-lg text-[#e3e2e6]/90 hover:text-[#ffb86b] active:bg-white/5 transition-colors cursor-pointer"
              id="speed-picker-btn"
            >
              <span className="material-symbols-outlined text-[18px] text-[#9d9ca4]">speed</span>
              <span className="text-[13px] font-semibold tracking-wide" id="current-speed-label">
                {playbackSpeed}x
              </span>
            </button>

            {/* Tap-anywhere backdrop to dismiss (transparent, no animation needed) */}
            {isSpeedMenuOpen && (
              <button
                aria-label="סגור תפריט מהירות"
                onClick={() => setIsSpeedMenuOpen(false)}
                className="fixed inset-0 z-20 cursor-default bg-transparent"
              />
            )}
            {/* Floating Speed Menu */}
            <AnimatePresence>
            {isSpeedMenuOpen && (
                <motion.div
                  key="speed-menu"
                  initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 4 }}
                  transition={tx(reduced, springSnappy)}
                  className="glass absolute bottom-11 right-1/2 translate-x-1/2 rounded-xl p-1.5 z-30 flex flex-col gap-1 min-w-[70px] origin-bottom"
                  id="speed-menu"
                >
                {speedOptions.map((speed) => (
                  <button
                    key={speed}
                    onClick={() => {
                      setPlaybackSpeed(speed);
                      setIsSpeedMenuOpen(false);
                    }}
                    className={`speed-opt px-2.5 py-1 rounded text-[12px] text-center cursor-pointer transition-colors ${playbackSpeed === speed
                      ? 'font-bold bg-[#e89838] text-[#2c1700]'
                      : 'text-[#9d9ca4] hover:bg-white/5 hover:text-white'
                      }`}
                  >
                    {speed}x
                  </button>
                ))}
                </motion.div>
            )}
            </AnimatePresence>
          </div>

          <div className="w-[1px] h-4 bg-white/[0.08]" />

          {/* Sleep Timer */}
          <button
            onClick={() => setIsSleepTimerModalOpen(true)}
            className="flex items-center gap-1.5 py-1 px-3 rounded-lg text-[#e3e2e6]/90 hover:text-[#ffb86b] active:bg-white/5 transition-colors cursor-pointer"
            id="sleep-timer-pill"
            title="טיימר שינה"
          >
            <span className="material-symbols-outlined text-[18px] text-[#9d9ca4]">bedtime</span>
            <span className="text-[13px] font-medium">
              {sleepTimerSecondsRemaining
                ? `${Math.ceil(sleepTimerSecondsRemaining / 60)} דק׳`
                : sleepTimerMinutes
                  ? `${sleepTimerMinutes} דק׳`
                  : 'כבוי'}
            </span>
          </button>

          <div className="w-[1px] h-4 bg-white/[0.08]" />

          {/* Bookmark button */}
          <button
            onClick={toggleBookmark}
            className={`flex items-center gap-1.5 py-1 px-3 rounded-lg active:bg-white/5 transition-colors cursor-pointer ${isCurrentlyBookmarked
              ? 'text-[#ffb86b]'
              : 'text-[#e3e2e6]/90 hover:text-[#ffb86b]'
              }`}
            id="quick-bookmark-btn"
            title="שמור סימנייה"
          >
            <motion.span
              key={isCurrentlyBookmarked ? 'marked' : 'unmarked'}
              initial={reduced ? false : { scale: 0.4 }}
              animate={{ scale: 1 }}
              transition={tx(reduced, springSnappy)}
              className={`material-symbols-outlined text-[18px] ${isCurrentlyBookmarked ? 'text-[#ffb86b]' : 'text-[#9d9ca4]'
                }`}
              id="quick-bm-icon"
              style={isCurrentlyBookmarked ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {isCurrentlyBookmarked ? 'bookmark' : 'bookmark_border'}
            </motion.span>
            <span className="text-[13px] font-medium">
              {isCurrentlyBookmarked ? 'שמור' : 'סימנייה'}
            </span>
          </button>
        </div>

        {/* Understated Up-Next Card (For multi-chapter audiobooks or YouTube playlists) */}
        {(currentBook.isPlaylist || !isYouTubeBook) && nextChapterObj && (
          <div
            onClick={nextChapter}
            className="glass-static flex items-center justify-between px-4 py-2.5 rounded-xl text-[#9d9ca4] text-[12px] hover:border-white/[0.14] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 truncate">
              <span className="text-[#e3e2e6]/60 font-medium">הבא:</span>
              <span className="text-[#e3e2e6] truncate">
                פרק {nextChapterObj.number}: {nextChapterObj.title}
              </span>
            </div>
            <span className="text-[11px] text-[#9d9ca4] flex-shrink-0 mr-2">
              {nextChapterObj.durationFormatted}
            </span>
          </div>
        )}
      </main>
    </div>
  );
}
