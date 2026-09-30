import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useAudio } from '../context/AudioContext';
import { springFast, staggerDelay, tx, useAppReducedMotion } from './motion';

export default function ChaptersDrawer() {
  const {
    isChaptersDrawerOpen,
    setIsChaptersDrawerOpen,
    currentBook,
    selectChapter,
    isPlaying,
  } = useAudio();
  const reduced = useAppReducedMotion();

  const open = isChaptersDrawerOpen && Boolean(currentBook);
  // Panel docks to the RTL inline-end side (visually left) — slide from there.

  // mode="wait": a reopen during exit no longer mounts a second
  // backdrop+panel over the exiting one (double-dark flash + two sliding
  // panels), and exiting rows can't morph mid-exit.
  return (
    <AnimatePresence mode="wait">
      {open && currentBook && (
      <motion.div
        key="chapters-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={tx(reduced, springFast)}
        className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm"
        onClick={() => setIsChaptersDrawerOpen(false)}
      >
      <motion.div
        key="chapters-panel"
        initial={reduced ? { opacity: 0 } : { opacity: 0, x: -56 }}
        animate={{ opacity: 1, x: 0 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, x: -40 }}
        transition={tx(reduced, springFast)}
        className="glass relative w-full max-w-md h-dvh flex flex-col !rounded-none !border-y-0 !border-l-0 pt-[env(safe-area-inset-top,0px)]"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="min-h-16 px-5 py-2 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex flex-col">
            <h2 className="text-[17px] font-semibold text-white">תוכן עניינים ופרקים</h2>
            <span className="text-[12px] text-[#9a9da6] truncate">
              {currentBook.title} •{' '}
              {currentBook.isPlaylist
                ? `${currentBook.chapters?.length || 0} סרטונים / פרקים`
                : currentBook.youtubeId
                ? 'סרטון רציף'
                : `${currentBook.chapters?.length || 0} פרקים`}
            </span>
          </div>
          <button
            onClick={() => setIsChaptersDrawerOpen(false)}
            className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-white/80 flex items-center justify-center cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Chapters List */}
        <div className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] space-y-2">
          {!currentBook.chapters || currentBook.chapters.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-8 text-white/50 gap-2 h-full">
              <span className="material-symbols-outlined text-[36px] text-[#ffb86b]/70">smart_display</span>
              <p className="text-[14px] text-white/80 font-medium">סרטון וידאו רציף</p>
              <p className="text-[12px] text-[#9a9da6] max-w-xs">
                תוכן וידאו זה מתנגן כיחידה אחת שלמה ואינו מחולק לפרקים.
              </p>
            </div>
          ) : (
            currentBook.chapters.map((chapter, index) => {
              const isCurrent = index === currentBook.currentChapterIndex;

              return (
                <div
                  key={chapter.id}
                  onClick={() => {
                    selectChapter(index);
                    setIsChaptersDrawerOpen(false);
                  }}
                  style={
                    reduced
                      ? undefined
                      : { animationDelay: `${Math.round(staggerDelay(index, 0.03, 0.3) * 1000)}ms` }
                  }
                  className={`glass-static p-3.5 rounded-xl ${reduced ? '' : 'drawer-row-in '}transition-[border-color,background-color,box-shadow] duration-300 cursor-pointer flex items-center justify-between gap-3 ${
                    isCurrent
                      ? '!border-[#ffb86b]/40 text-[#ffb86b] shadow-[0_8px_24px_-8px_rgb(255_184_107/0.35)]'
                      : 'text-white/90 hover:border-[#ffb86b]/20'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-[13px] font-bold flex-shrink-0 ${
                        isCurrent
                          ? 'bg-[#ffb86b] text-[#492900]'
                          : 'bg-white/[0.06] text-white/60'
                      }`}
                    >
                      {chapter.number}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span
                        className={`text-[14px] font-medium truncate ${
                          isCurrent ? 'text-[#ffb86b]' : 'text-white'
                        }`}
                      >
                        {chapter.title}
                      </span>
                      <span className="text-[11px] text-[#9a9da6]">
                        משך: {chapter.durationFormatted}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isCurrent && isPlaying && !reduced ? (
                      <div className="flex items-end gap-[3px] h-4" aria-hidden="true">
                        <span className="eq-bar w-1 rounded-full bg-[#ffb86b] h-4" style={{ animationDelay: '0ms' }} />
                        <span className="eq-bar w-1 rounded-full bg-[#ffb86b] h-4" style={{ animationDelay: '200ms' }} />
                        <span className="eq-bar w-1 rounded-full bg-[#ffb86b] h-4" style={{ animationDelay: '400ms' }} />
                      </div>
                    ) : (
                      <span className="material-symbols-outlined text-[18px] text-white/40">
                        play_circle
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );
}
