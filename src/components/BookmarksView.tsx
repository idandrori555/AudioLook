import React from 'react';
import { useAudio } from '../context/AudioContext';

export default function BookmarksView() {
  const { bookmarks, removeBookmark, selectBook, selectChapter, seekTo, setActiveTab } = useAudio();

  const handleJumpToBookmark = (bookId: string, timestampSeconds: number, chapterNumber?: number) => {
    selectBook(bookId, true, true);
    setTimeout(() => {
      if (chapterNumber && chapterNumber > 0) {
        selectChapter(chapterNumber - 1);
      }
      seekTo(timestampSeconds);
    }, 120);
  };

  return (
    <main className="flex-1 w-full pb-36 px-5 max-w-xl mx-auto flex flex-col gap-6 pt-5" dir="rtl">
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-semibold tracking-tight text-white">סימניות והערות</h1>
        <p className="text-[13px] text-[#9a9da6]">
          {bookmarks.length} סימניות שמורות להאזנה ממוקדת
        </p>
      </div>

      {bookmarks.length === 0 ? (
        <div className="py-16 text-center flex flex-col items-center justify-center gap-3 bg-[#16171b] rounded-2xl border border-white/[0.04] p-6">
          <span className="material-symbols-outlined text-[48px] text-white/20">bookmark_border</span>
          <p className="text-white/70 text-[15px]">טרם נשמרו סימניות</p>
          <p className="text-white/40 text-[12px] max-w-xs">
            לחצו על כפתור הסימנייה בנגן או בכרטיס הספר כדי לשמור נקודות ציון חשובות
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {bookmarks.map((bm) => (
            <div
              key={bm.id}
              className="bg-[#16171b] hover:bg-[#1d1e23] border border-white/[0.04] rounded-2xl p-3.5 flex items-start gap-3.5 transition-all"
            >
              <div
                onClick={() => handleJumpToBookmark(bm.bookId, bm.timestampSeconds, bm.chapterNumber)}
                className="w-14 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-black/40 shadow cursor-pointer group relative"
              >
                <img className="w-full h-full object-cover" alt={bm.bookTitle} src={bm.bookCover} />
                <div className="absolute inset-0 bg-black/40 group-hover:bg-[#ffb86b]/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="material-symbols-outlined text-[20px] text-white">play_arrow</span>
                </div>
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-between h-full gap-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col min-w-0">
                    <h3
                      onClick={() => handleJumpToBookmark(bm.bookId, bm.timestampSeconds, bm.chapterNumber)}
                      className="text-[15px] font-semibold text-white truncate cursor-pointer hover:text-[#ffb86b] transition-colors"
                    >
                      {bm.bookTitle}
                    </h3>
                    <span className="text-[12px] text-[#ffb86b]">
                      פרק {bm.chapterNumber}: {bm.chapterTitle}
                    </span>
                  </div>

                  <button
                    onClick={() => removeBookmark(bm.id)}
                    className="text-white/30 hover:text-red-400 p-1 cursor-pointer transition-colors"
                    title="מחק סימנייה"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>

                {bm.note && (
                  <p className="text-[12px] text-white/70 bg-white/[0.03] p-2 rounded-lg border border-white/[0.04] mt-1 line-clamp-2">
                    "{bm.note}"
                  </p>
                )}

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.04]">
                  <span className="text-[12px] font-mono text-[#ffb86b] bg-[#ffb86b]/10 px-2 py-0.5 rounded">
                    {bm.timestampFormatted}
                  </span>
                  <button
                    onClick={() => handleJumpToBookmark(bm.bookId, bm.timestampSeconds, bm.chapterNumber)}
                    className="text-[12px] font-medium text-white/80 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <span>קפוץ לנקודה</span>
                    <span className="material-symbols-outlined text-[15px]">arrow_back</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
