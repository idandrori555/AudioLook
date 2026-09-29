import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useAudio } from '../context/AudioContext';
import { springFast, tx, useAppReducedMotion } from './motion';

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

  return (
    <AnimatePresence>
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
        initial={reduced ? { opacity: 0 } : { opacity: 0, x: -88 }}
        animate={{ opacity: 1, x: 0 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, x: -64 }}
        transition={tx(reduced, springFast)}
        className="glass relative w-full max-w-md h-full flex flex-col !rounded-none !border-y-0 !border-l-0"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="h-16 px-5 border-b border-white/[0.08] flex items-center justify-between">
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
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
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
                  className={`glass-static p-3.5 rounded-xl transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                    isCurrent
                      ? '!border-[#ffb86b]/40 text-[#ffb86b]'
                      : 'text-white/90 hover:border-white/[0.14]'
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
                    {isCurrent && isPlaying ? (
                      <div className="flex items-end gap-0.5 h-4">
                        <span className="w-1 bg-[#ffb86b] rounded-full animate-[bounce_0.6s_infinite_100ms] h-3" />
                        <span className="w-1 bg-[#ffb86b] rounded-full animate-[bounce_0.6s_infinite_200ms] h-4" />
                        <span className="w-1 bg-[#ffb86b] rounded-full animate-[bounce_0.6s_infinite_300ms] h-2" />
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
