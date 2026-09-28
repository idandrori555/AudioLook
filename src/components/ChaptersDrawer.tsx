import React from 'react';
import { useAudio } from '../context/AudioContext';

export default function ChaptersDrawer() {
  const {
    isChaptersDrawerOpen,
    setIsChaptersDrawerOpen,
    currentBook,
    selectChapter,
    isPlaying,
  } = useAudio();

  if (!isChaptersDrawerOpen || !currentBook) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm transition-opacity">
      <div
        className="w-full max-w-md bg-[#18191c] h-full flex flex-col shadow-2xl border-r border-white/[0.08] animate-in slide-in-from-right duration-200"
        dir="rtl"
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
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isCurrent
                      ? 'bg-[#22242a] border-[#ffb86b]/40 text-[#ffb86b] shadow-md shadow-black/20'
                      : 'bg-[#1f2024]/60 hover:bg-[#1f2024] border-white/[0.04] text-white/90'
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
      </div>
    </div>
  );
}
