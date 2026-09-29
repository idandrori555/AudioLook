import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useAudio } from '../context/AudioContext';
import { pressTap, springFast, tx, useAppReducedMotion } from './motion';

export default function MiniPlayer() {
  const {
    currentBook,
    currentChapter,
    isPlaying,
    currentTime,
    duration,
    playPause,
    jumpRelative,
    setActiveTab,
    activeTab,
  } = useAudio();
  const reduced = useAppReducedMotion();

  // Hide mini-player when already on full player screen or when no book is active
  const visible = activeTab !== 'player' && Boolean(currentBook);

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <AnimatePresence>
      {visible && currentBook && (
    <motion.aside
      key="mini-player"
      initial={{ opacity: 0, y: reduced ? 0 : 72 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduced ? 0 : 72 }}
      transition={tx(reduced, springFast)}
      className="fixed mini-player-dock inset-x-0 z-40 px-3 pb-1 pointer-events-auto max-w-xl mx-auto"
    >
      <motion.div
        onClick={() => setActiveTab('player')}
        whileTap={reduced ? undefined : pressTap}
        className="relative overflow-hidden bg-[#24252a]/95 backdrop-blur-2xl rounded-2xl p-2.5 px-3 border border-white/[0.08] shadow-[0_16px_40px_rgba(0,0,0,0.6)] flex items-center justify-between gap-3 cursor-pointer hover:border-white/[0.14] transition-colors group"
      >
        {/* Subtle top/bottom progress indicator line (no transition — updates every 500ms) */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-white/[0.06] pointer-events-none">
          <div
            className="h-full bg-[#ffb86b]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Mini Book Art & Track info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-black/40 flex-shrink-0 ring-1 ring-white/10">
            <img
              className="w-full h-full object-cover"
              alt={currentBook.title}
              src={currentBook.coverUrl}
            />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[14px] font-medium text-white truncate leading-tight group-hover:text-[#ffb86b] transition-colors">
              {currentBook.title}
            </span>
            <span className="text-[11px] text-white/50 truncate mt-0.5">
              {currentBook.youtubeId
                ? currentBook.author
                : currentChapter
                ? `פרק ${currentChapter.number} • ${currentChapter.title}`
                : currentBook.author}
            </span>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => jumpRelative(-10)}
            aria-label="10 שניות אחורה"
            className="w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white active:scale-95 transition-all cursor-pointer"
            title="קפוץ 10 שניות אחורה"
          >
            <span className="material-symbols-outlined text-[20px]">replay_10</span>
          </button>
          <motion.button
            onClick={playPause}
            whileTap={reduced ? undefined : { scale: 0.88 }}
            aria-label={isPlaying ? 'השהה' : 'נגן'}
            className="w-10 h-10 rounded-full bg-[#e89838] hover:bg-[#ffb86b] text-[#2c1700] flex items-center justify-center shadow-md shadow-[#e89838]/20 transition-colors cursor-pointer"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={isPlaying ? 'pause' : 'play'}
                initial={{ opacity: 0, scale: reduced ? 1 : 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: reduced ? 1 : 0.6 }}
                transition={tx(reduced, springFast)}
                className="material-symbols-outlined text-[22px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {isPlaying ? 'pause' : 'play_arrow'}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </div>
      </motion.div>
    </motion.aside>
      )}
    </AnimatePresence>
  );
}
