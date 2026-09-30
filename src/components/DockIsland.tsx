import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useAudio } from '../context/AudioContext';
import { pressTap, springFast, springSnappy, tx, useAppReducedMotion } from './motion';
import { TabType } from '../types';

const tabs: { id: TabType; label: string; icon: string }[] = [
  { id: 'library', label: 'ספרייה', icon: 'auto_stories' },
  { id: 'player', label: 'נגן', icon: 'headphones' },
  { id: 'bookmarks', label: 'סימניות', icon: 'bookmark' },
  { id: 'settings', label: 'הגדרות', icon: 'tune' },
];

export default function DockIsland() {
  const {
    activeTab,
    setActiveTab,
    bookmarks,
    isPlaying,
    currentBook,
    currentChapter,
    currentTime,
    duration,
    playPause,
    jumpRelative,
  } = useAudio();
  const reduced = useAppReducedMotion();

  const showMini = activeTab !== 'player' && Boolean(currentBook);
  const progressPercent =
    duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const handleSelect = (tab: TabType) => {
    if (tab === activeTab) return;
    try {
      navigator.vibrate?.(8);
    } catch {}
    setActiveTab(tab);
  };

  return (
    <div className="fixed inset-x-0 bottom-[calc(0.75rem+var(--sab,env(safe-area-inset-bottom,0px)))] z-50 flex justify-center px-4 pointer-events-none">
      <motion.div
        layout
        initial={{ opacity: 0, y: reduced ? 0 : 48 }}
        animate={{ opacity: 1, y: 0 }}
        transition={tx(reduced, springFast)}
        className="glass pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-[26px]"
      >
        {/* Specular top light + soft sheen */}
        <div className="glass-glint" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.07] to-transparent" />

        {/* Playback progress hairline — fades with the mini section */}
        <AnimatePresence initial={false}>
          {showMini && (
            <motion.div
              key="dock-progress"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={tx(reduced, { duration: 0.18 })}
              className="absolute top-0 inset-x-0 h-[2px] bg-white/[0.06] pointer-events-none z-10"
            >
              <div className="h-full bg-[#ffb86b]" style={{ width: `${progressPercent}%` }} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mini-player section — height-animated, single island */}
        <AnimatePresence initial={false}>
          {showMini && currentBook && (
            <motion.div
              key="dock-mini"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={tx(reduced, springFast)}
              className="overflow-hidden"
            >
              <div
                onClick={() => setActiveTab('player')}
                className="relative p-2.5 px-3 pt-3 flex items-center justify-between gap-3 cursor-pointer group"
              >
                {/* Mini Book Art & Track info */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-black/40 flex-shrink-0 ring-1 ring-white/10">
                    <img
                      className="w-full h-full object-cover"
                      alt={currentBook.title}
                      src={currentBook.coverUrl}
                    />
                  </div>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={currentBook.id}
                      initial={{ opacity: 0, y: reduced ? 0 : 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: reduced ? 0 : -4 }}
                      transition={tx(reduced, springFast)}
                      className="flex flex-col min-w-0"
                    >
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
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Playback Controls */}
                <div
                  className="flex items-center gap-1 flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
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
              </div>
              {/* Soft edge-faded separator — floats between sections instead of a hard rule */}
              <div className="px-8 pb-1.5 pt-0.5" aria-hidden="true">
                <div className="h-px bg-gradient-to-l from-transparent via-white/[0.14] to-transparent" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom navigation row */}
        <nav aria-label="ניווט תחתון" className="relative flex justify-around items-center h-12 px-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const showBadge = tab.id === 'bookmarks' && bookmarks.length > 0;
            const showPlayingDot = tab.id === 'player' && isPlaying;
            return (
              <motion.button
                key={tab.id}
                onClick={() => handleSelect(tab.id)}
                whileTap={reduced ? undefined : { scale: 0.88 }}
                aria-current={isActive ? 'page' : undefined}
                aria-label={tab.label}
                className={`relative flex flex-col items-center justify-center gap-0.5 w-14 py-0.5 cursor-pointer ${
                  isActive ? 'text-[#ffb86b]' : 'text-white/45 hover:text-white'
                }`}
              >
                <span className="relative flex items-center justify-center w-11 h-7">
                  {isActive && (
                    <motion.span
                      layoutId="nav-active-pill"
                      transition={tx(reduced, springSnappy)}
                      className="absolute inset-0 rounded-full bg-[#ffb86b]/15 ring-1 ring-[#ffb86b]/20"
                    />
                  )}
                  <motion.span
                    animate={reduced ? undefined : { scale: isActive ? 1.1 : 1 }}
                    transition={tx(reduced, springSnappy)}
                    className="material-symbols-outlined text-[22px] relative"
                    style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                  >
                    {tab.icon}
                  </motion.span>
                  <AnimatePresence>
                    {showBadge && (
                      <motion.span
                        key={bookmarks.length}
                        initial={reduced ? false : { scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.4, opacity: 0 }}
                        transition={tx(reduced, springSnappy)}
                        className="absolute -top-1 -left-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ffb86b] text-[#2c1700] text-[10px] font-bold flex items-center justify-center shadow-md shadow-black/40"
                      >
                        {bookmarks.length > 99 ? '99+' : bookmarks.length}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {showPlayingDot && !isActive && (
                    <span className="absolute top-0 right-2 w-1.5 h-1.5 rounded-full bg-[#ffb86b] animate-pulse" />
                  )}
                </span>
              </motion.button>
            );
          })}
        </nav>
      </motion.div>
    </div>
  );
}
