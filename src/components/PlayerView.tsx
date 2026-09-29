import React, { useState, useRef } from 'react';
import { useAudio } from '../context/AudioContext';

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
  const [bounceReplay, setBounceReplay] = useState(false);
  const [bounceForward, setBounceForward] = useState(false);
  const scrubberRef = useRef<HTMLDivElement | null>(null);

  const speedOptions = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

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
    e.currentTarget.setPointerCapture(e.pointerId);
    const targetSeconds = calculateSeekTime(e.clientX);
    seekTo(targetSeconds);
  };

  const handleScrubberPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingScrubber || !currentBook) return;
    const targetSeconds = calculateSeekTime(e.clientX);
    seekTo(targetSeconds);
  };

  const handleScrubberPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingScrubber) {
      setIsDraggingScrubber(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch { }
      const targetSeconds = calculateSeekTime(e.clientX);
      seekTo(targetSeconds);
    }
  };

  const handleReplay10 = () => {
    setBounceReplay(true);
    jumpRelative(-10);
    setTimeout(() => setBounceReplay(false), 150);
  };

  const handleForward10 = () => {
    setBounceForward(true);
    jumpRelative(10);
    setTimeout(() => setBounceForward(false), 150);
  };

  // Up-next chapter
  const nextChapterObj =
    currentBook && currentBook.chapters
      ? currentBook.chapters[currentBook.currentChapterIndex + 1] || null
      : null;

  if (!currentBook) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex flex-col bg-[#121316] text-[#e3e2e6] select-none page-with-nav justify-center items-center p-6 text-center" dir="rtl">
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

  return (
    <div className="relative min-h-[calc(100vh-64px)] flex flex-col bg-[#121316] text-[#e3e2e6] select-none page-with-nav">
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
          <div className="flex flex-col items-center">
            {/* <span className="text-[13px] font-medium tracking-tight text-[#e3e2e6]/90">אודיולוק</span> */}
            {/* <span className="text-[11px] text-[#9d9ca4]">AudioLook Player</span> */}
          </div>

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
            /* Standard or Audio-only Cover Artwork */
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-2xl overflow-hidden shadow-[0_20px_40px_-15px_rgba(0,0,0,0.8)] border border-white/[0.08] bg-[#18191c] transition-transform duration-300 active:scale-[0.98]">
              <img
                className="w-full h-full object-cover"
                alt={currentBook.title}
                src={currentBook.coverUrl}
              />
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
              className="inline-flex items-center gap-1.5 mt-2.5 px-3 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-[13px] text-[#ffb86b]/95 font-medium transition-colors cursor-pointer"
            >
              <span className="truncate max-w-[280px]">
                פרק {currentChapter.number}: {currentChapter.title}
              </span>
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
            className="relative w-full py-3 cursor-pointer group touch-none select-none"
            id="scrubber-container"
          >
            {/* Background Track */}
            <div className="w-full h-[5px] rounded-full bg-white/10 overflow-hidden relative">
              {/* Active Progress Bar (LTR left-to-right) */}
              <div
                className="h-full bg-[#e89838] rounded-full transition-all duration-75"
                id="progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {/* Thumb */}
            <div
              className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#ffb86b] shadow-md border-2 border-[#121316] pointer-events-none transition-transform ${isDraggingScrubber ? 'scale-125 ring-2 ring-[#ffb86b]/40' : 'group-hover:scale-125'
                }`}
              id="scrubber-head"
              style={{ left: `calc(${progressPercent}% - 8px)` }}
            />
          </div>

          {/* Timestamps */}
          <div className="flex items-center justify-between text-[12px] font-mono text-[#9d9ca4] px-0.5 tracking-tight select-none">
            <span className="text-[#e3e2e6]/80" id="elapsed-time">
              {formatTime(currentTime)}
            </span>
            <span id="remaining-time">{formatRemainingTime(currentTime, duration)}</span>
          </div>
        </div>

        {/* Tactile Ergonomic Primary Controls */}
        <div className="flex items-center justify-center gap-7 sm:gap-9 mb-6">
          {/* Previous Chapter (For multi-chapter audiobooks or YouTube playlists) */}
          {(currentBook.isPlaylist || (!isYouTubeBook && currentBook.chapters && currentBook.chapters.length > 1)) && (
            <button
              onClick={previousChapter}
              aria-label="פרק קודם"
              className="w-10 h-10 rounded-full flex items-center justify-center text-[#9d9ca4] hover:text-[#e3e2e6] active:scale-90 transition-all cursor-pointer"
              title="פרק קודם"
            >
              <span className="material-symbols-outlined text-[26px]">skip_next</span>
            </button>
          )}

          {/* Jump Forward 10s */}
          <button
            onClick={handleForward10}
            aria-label="10 שניות קדימה"
            className={`relative w-12 h-12 rounded-full flex items-center justify-center text-[#e3e2e6] hover:text-[#ffb86b] transition-all cursor-pointer ${bounceForward ? 'scale-90 text-[#ffb86b]' : 'active:scale-90'
              }`}
            id="btn-forward-10"
            title="קפוץ 10 שניות קדימה"
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
          </button>

          {/* Centerpiece Warm Amber Play/Pause */}
          <button
            onClick={playPause}
            aria-label="נגן או השהה"
            className="w-[72px] h-[72px] rounded-full bg-[#e89838] text-[#2c1700] flex items-center justify-center shadow-[0_8px_24px_rgba(232,152,56,0.3)] hover:brightness-105 active:scale-95 transition-all cursor-pointer"
            id="main-play-btn"
          >
            <span
              className="material-symbols-outlined text-[38px]"
              id="play-pause-icon"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
          </button>


          {/* Jump Back 10s */}
          <button
            onClick={handleReplay10}
            aria-label="10 שניות אחורה"
            className={`relative w-12 h-12 rounded-full flex items-center justify-center text-[#e3e2e6] hover:text-[#ffb86b] transition-all cursor-pointer ${bounceReplay ? 'scale-90 text-[#ffb86b]' : 'active:scale-90'
              }`}
            id="btn-replay-10"
            title="קפוץ 10 שניות אחורה"
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
          </button>



          {/* Next Chapter (For multi-chapter audiobooks or YouTube playlists) */}
          {(currentBook.isPlaylist || (!isYouTubeBook && currentBook.chapters && currentBook.chapters.length > 1)) && (
            <button
              onClick={nextChapter}
              aria-label="פרק הבא"
              className="w-10 h-10 rounded-full flex items-center justify-center text-[#9d9ca4] hover:text-[#e3e2e6] active:scale-90 transition-all cursor-pointer"
              title="פרק הבא"
            >
              <span className="material-symbols-outlined text-[26px]">skip_previous</span>
            </button>
          )}
        </div>

        {/* Secondary Quiet Utility Strip (Speed, Sleep Timer, Bookmark) */}
        <div className="relative flex items-center justify-around py-3 px-2 rounded-2xl bg-white/[0.03] border border-white/[0.05] mb-5">
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

            {/* Floating Speed Menu */}
            {isSpeedMenuOpen && (
              <div
                className="absolute bottom-11 right-1/2 translate-x-1/2 bg-[#1f2024] border border-white/[0.08] rounded-xl p-1.5 shadow-xl z-30 flex flex-col gap-1 min-w-[70px]"
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
              </div>
            )}
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
            <span
              className={`material-symbols-outlined text-[18px] ${isCurrentlyBookmarked ? 'text-[#ffb86b]' : 'text-[#9d9ca4]'
                }`}
              id="quick-bm-icon"
              style={isCurrentlyBookmarked ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {isCurrentlyBookmarked ? 'bookmark' : 'bookmark_border'}
            </span>
            <span className="text-[13px] font-medium">
              {isCurrentlyBookmarked ? 'שמור' : 'סימנייה'}
            </span>
          </button>
        </div>

        {/* Understated Up-Next Card (For multi-chapter audiobooks or YouTube playlists) */}
        {(currentBook.isPlaylist || !isYouTubeBook) && nextChapterObj && (
          <div
            onClick={nextChapter}
            className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] text-[#9d9ca4] text-[12px] hover:bg-white/[0.05] transition-colors cursor-pointer"
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
