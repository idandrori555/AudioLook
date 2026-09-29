import React, { useState } from 'react';
import { useAudio } from '../context/AudioContext';
import AddBookModal from './AddBookModal';

export default function LibraryView() {
  const {
    books,
    currentBook,
    currentChapter,
    isPlaying,
    currentTime,
    duration,
    playPause,
    selectBook,
    deleteBook,
    setActiveTab,
    toggleBookmark,
    activeFilter,
    setActiveFilter,
    importYouTubeAudio,
    formatTime,
    formatRemainingTime,
    setIsSleepTimerModalOpen,
    sleepTimerSecondsRemaining,
    showToast,
  } = useAudio();

  const [importUrl, setImportUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'success'>('idle');
  const [activeMenuBookId, setActiveMenuBookId] = useState<string | null>(null);
  const [isAddBookModalOpen, setIsAddBookModalOpen] = useState(false);

  const handleImport = async () => {
    if (!importUrl.trim()) return;
    setIsImporting(true);
    setImportStatus('importing');
    const success = await importYouTubeAudio(importUrl);
    if (success) {
      setImportStatus('success');
      setImportUrl('');
      setTimeout(() => {
        setImportStatus('idle');
        setIsImporting(false);
      }, 1600);
    } else {
      setIsImporting(false);
      setImportStatus('idle');
    }
  };

  // Filter books based on active tab
  const filteredBooks = books.filter((book) => {
    if (activeFilter === 'all') return true;
    return book.category === activeFilter;
  });

  const allCount = books.length;
  const listeningCount = books.filter((b) => b.category === 'listening').length;
  const completedCount = books.filter((b) => b.category === 'completed').length;
  const queuedCount = books.filter((b) => b.category === 'queued').length;

  // Real stats
  const totalHoursListened = Math.round(
    books.reduce((acc, b) => acc + (b.currentTimeSeconds / 3600), 0) * 10
  ) / 10;

  const totalOfflineStorageMB = books.length * 85; // ~85MB average per saved track
  const storageFormatted =
    totalOfflineStorageMB >= 1000
      ? `${(totalOfflineStorageMB / 1024).toFixed(1)}GB`
      : `${totalOfflineStorageMB}MB`;

  const currentBookProgressPercent =
    currentBook && duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const heroHoursRemaining = currentBook
    ? Math.max(0, Math.round(((duration - currentTime) / 3600) * 10) / 10)
    : 0;

  return (
    <main className="flex-1 w-full page-with-dock px-5 max-w-xl mx-auto flex flex-col gap-6 pt-5">
      {/* Title & Real Statistics Summary */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <h1 className="text-[28px] font-semibold tracking-tight text-white">הספרייה שלי</h1>
          {/* <button */}
          {/*   onClick={() => setIsAddBookModalOpen(true)} */}
          {/*   className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/80 hover:text-white text-[12px] font-medium transition-colors cursor-pointer" */}
          {/* > */}
          {/*   <span className="material-symbols-outlined text-[16px]">add</span> */}
          {/*   <span>הוסף ספר</span> */}
          {/* </button> */}
        </div>
        <p className="text-[13px] text-[#9a9da6] flex items-center gap-2">
          <span>{totalHoursListened} שעות האזנה</span>
          <span className="inline-block w-1 h-1 rounded-full bg-white/20" />
          <span>{books.length > 0 ? `${storageFormatted} שמורים אופליין` : '0MB שמורים אופליין'}</span>
        </p>
      </div>

      {/* Quiet Integrated Quick-Import Field */}
      <div className="relative flex items-center bg-[#16171b] border border-white/[0.06] rounded-2xl p-1.5 pr-3.5 focus-within:border-[#ffb86b]/40 focus-within:bg-[#1d1e23] transition-all shadow-sm">
        <span className="material-symbols-outlined text-white/40 text-[19px] ml-2 flex-shrink-0">
          add_link
        </span>
        <input
          value={importUrl}
          onChange={(e) => setImportUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleImport()}
          className="bg-transparent text-[14px] text-white placeholder:text-white/35 w-full outline-none py-1.5 min-w-0"
          id="quick-input"
          placeholder="הדבק קישור יוטיוב"
          type="url"
        />
        <button
          onClick={handleImport}
          disabled={isImporting}
          className="flex-shrink-0 px-3.5 py-1.5 rounded-xl bg-white/[0.07] hover:bg-[#ffb86b] hover:text-[#492900] text-[13px] font-medium text-white/85 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          id="quick-btn"
        >
          {importStatus === 'importing' ? (
            <>
              <span className="material-symbols-outlined text-[15px] animate-spin">refresh</span>
              <span>מייבא...</span>
            </>
          ) : importStatus === 'success' ? (
            <>
              <span className="material-symbols-outlined text-[15px]">done</span>
              <span>נוסף</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[15px]">arrow_downward</span>
              {/* <span>ייבא</span> */}
            </>
          )}
        </button>
      </div>

      {/* Minimal Category Segmented Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5" id="shelf-filters">
        <button
          onClick={() => setActiveFilter('all')}
          className={`filter-tab px-4 py-2 rounded-full text-[13px] font-medium transition-all cursor-pointer whitespace-nowrap ${activeFilter === 'all'
            ? 'bg-white/[0.12] text-white'
            : 'bg-transparent text-white/60 hover:text-white hover:bg-white/[0.05]'
            }`}
        >
          הכל ({allCount})
        </button>
        <button
          onClick={() => setActiveFilter('listening')}
          className={`filter-tab px-4 py-2 rounded-full text-[13px] font-medium transition-all cursor-pointer whitespace-nowrap ${activeFilter === 'listening'
            ? 'bg-white/[0.12] text-white'
            : 'bg-transparent text-white/60 hover:text-white hover:bg-white/[0.05]'
            }`}
        >
          בהאזנה ({listeningCount})
        </button>
        <button
          onClick={() => setActiveFilter('completed')}
          className={`filter-tab px-4 py-2 rounded-full text-[13px] font-medium transition-all cursor-pointer whitespace-nowrap ${activeFilter === 'completed'
            ? 'bg-white/[0.12] text-white'
            : 'bg-transparent text-white/60 hover:text-white hover:bg-white/[0.05]'
            }`}
        >
          הושלמו ({completedCount})
        </button>
        <button
          onClick={() => setActiveFilter('queued')}
          className={`filter-tab px-4 py-2 rounded-full text-[13px] font-medium transition-all cursor-pointer whitespace-nowrap ${activeFilter === 'queued'
            ? 'bg-white/[0.12] text-white'
            : 'bg-transparent text-white/60 hover:text-white hover:bg-white/[0.05]'
            }`}
        >
          רשימת המתנה ({queuedCount})
        </button>
      </div>

      {/* Continue Listening Hero Card (Now Playing Focus) OR Empty State */}
      {currentBook ? (
        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-[13px] font-medium text-white/50 px-1">
            <span>
              {currentBook.isPlaylist
                ? 'פלייליסט פעיל'
                : currentBook.youtubeId
                  ? 'סרטון פעיל'
                  : 'האזנה נוכחית'}
            </span>
            <span className="text-[#ffb86b]/90 text-[12px] flex items-center gap-1">
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full bg-[#ffb86b] ${isPlaying ? 'animate-pulse' : ''
                  }`}
              />
              {currentBook.isPlaylist && currentChapter
                ? `פרק ${currentChapter.number} מתוך ${currentBook.totalChapters}`
                : currentBook.youtubeId
                  ? 'וידאו מלא'
                  : currentChapter
                    ? `פרק ${currentChapter.number} מתוך ${currentBook.totalChapters}`
                    : 'ספר מלא'}
            </span>
          </div>

          <div className="bg-[#1d1e23] rounded-2xl p-4 border border-white/[0.05] hover:border-white/[0.08] transition-all flex flex-col gap-4 shadow-lg shadow-black/20">
            <div
              className="flex items-start gap-4 cursor-pointer"
              onClick={() => setActiveTab('player')}
            >
              <div className="relative w-20 h-28 rounded-lg overflow-hidden flex-shrink-0 shadow-md bg-[#0a0b0d] ring-1 ring-white/10 group">
                <img
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  alt={currentBook.title}
                  src={currentBook.coverUrl}
                />
                {currentBook.isOfflineAvailable && (
                  <div className="absolute bottom-1 right-1 bg-black/60 backdrop-blur-md rounded p-0.5 text-white/90">
                    <span className="material-symbols-outlined text-[13px] block">offline_pin</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col flex-1 min-w-0 justify-between py-0.5 h-28">
                <div className="flex flex-col min-w-0">
                  <h2 className="text-[17px] font-semibold text-white tracking-tight truncate leading-snug hover:text-[#ffb86b] transition-colors">
                    {currentBook.title}
                  </h2>
                  <p className="text-[13px] text-[#9a9da6] truncate mt-0.5">{currentBook.author}</p>
                  {currentChapter && (currentBook.isPlaylist || !currentBook.youtubeId) && (
                    <p className="text-[12px] text-[#d8b28a] truncate mt-1">
                      פרק {currentChapter.number}: {currentChapter.title}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between text-[12px] text-white/45">
                  <span>נותרו {heroHoursRemaining} שעות</span>
                  <span className="text-white/60">
                    {Math.round(currentBookProgressPercent)}% הושלמו
                  </span>
                </div>
              </div>
            </div>

            {/* Clean Progress Bar */}
            <div className="flex flex-col gap-1.5" dir="ltr">
              <div className="w-full h-1.5 bg-white/[0.08] rounded-full overflow-hidden relative">
                <div
                  className="bg-[#ffb86b] h-full rounded-full transition-all duration-300"
                  style={{ width: `${currentBookProgressPercent}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[11px] text-white/40 font-mono">
                <span>{formatTime(currentTime)}</span>
                <span>{formatRemainingTime(currentTime, duration)}</span>
              </div>
            </div>

            {/* Play Action Strip */}
            <div className="flex items-center gap-3 pt-1 border-t border-white/[0.04]">
              <button
                onClick={() => {
                  if (!isPlaying) playPause();
                  setActiveTab('player');
                }}
                className="flex-1 h-11 rounded-xl bg-[#ffb86b] hover:bg-[#ffc685] text-[#492900] font-medium text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md shadow-[#ffb86b]/10 cursor-pointer"
              >
                <span
                  className="material-symbols-outlined text-[20px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {isPlaying ? 'pause' : 'play_arrow'}
                </span>
                <span>
                  {isPlaying
                    ? 'נגן כעת (פתח נגן)'
                    : currentTime > 0
                      ? `המשך מ-${formatTime(currentTime)}`
                      : 'התחל האזנה'}
                </span>
              </button>
              <button
                onClick={toggleBookmark}
                aria-label="סימניה"
                className="w-11 h-11 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-white/75 hover:text-[#ffb86b] flex items-center justify-center transition-colors active:scale-95 cursor-pointer"
                title="שמור סימנייה"
              >
                <span className="material-symbols-outlined text-[19px]">bookmark_add</span>
              </button>
              <div className="relative">
                <button
                  onClick={() =>
                    setActiveMenuBookId(activeMenuBookId === 'hero' ? null : 'hero')
                  }
                  aria-label="אפשרויות"
                  className="w-11 h-11 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-white/75 hover:text-white flex items-center justify-center transition-colors active:scale-95 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[19px]">more_horiz</span>
                </button>
                {activeMenuBookId === 'hero' && (
                  <div className="absolute bottom-13 left-0 bg-[#24252a] border border-white/[0.1] rounded-xl p-1.5 shadow-2xl z-30 min-w-[160px] text-[13px] flex flex-col gap-1">
                    <button
                      onClick={() => {
                        setActiveTab('player');
                        setActiveMenuBookId(null);
                      }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-white hover:bg-white/10 text-right cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[17px]">headphones</span>
                      <span>פתח נגן מלא</span>
                    </button>
                    <button
                      onClick={() => {
                        toggleBookmark();
                        setActiveMenuBookId(null);
                      }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-white hover:bg-white/10 text-right cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[17px]">bookmark</span>
                      <span>הוסף סימנייה</span>
                    </button>
                    <button
                      onClick={() => {
                        deleteBook(currentBook.id);
                        setActiveMenuBookId(null);
                      }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 text-right cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[17px]">delete</span>
                      <span>מחק ספר מהספרייה</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="bg-[#18191c] rounded-2xl p-6 border border-white/[0.06] text-center flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 rounded-full bg-white/[0.04] text-[#ffb86b] flex items-center justify-center">
            <span className="material-symbols-outlined text-[30px]">local_library</span>
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-[17px] font-semibold text-white">הספרייה שלך ריקה כרגע</h3>
            <p className="text-[13px] text-[#9a9da6] max-w-sm">
              הדבק קישור יוטיוב בשורת הייבוא למעלה.
            </p>
          </div>

          {/* <button */}
          {/*   onClick={() => setIsAddBookModalOpen(true)} */}
          {/*   className="mt-1 px-4 py-2 rounded-xl bg-[#ffb86b] text-[#492900] text-[13px] font-medium hover:bg-[#ffc685] transition-colors cursor-pointer flex items-center gap-1.5" */}
          {/* > */}
          {/*   <span className="material-symbols-outlined text-[17px]">add</span> */}
          {/*   <span>הוסף ספר שמע</span> */}
          {/* </button> */}
        </section>
      )}

      {/* Bookshelf Section: Thoughtful list of books */}
      <section className="flex flex-col gap-3 mt-1">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[17px] font-semibold text-white">ספרי שמע</h3>
          <span className="text-[12px] text-white/40">{filteredBooks.length} פריטים</span>
        </div>

        {filteredBooks.length === 0 ? (
          <div className="py-8 text-center text-white/40 text-[13px] bg-[#16171b]/40 rounded-xl border border-white/[0.04]">
            אין פריטים להצגה בסינון זה
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filteredBooks.map((book) => {
              const isSelected = currentBook?.id === book.id;
              const progress =
                book.totalDurationSeconds > 0
                  ? Math.min(100, Math.round((book.currentTimeSeconds / book.totalDurationSeconds) * 100))
                  : 0;

              const isDone = book.category === 'completed';

              return (
                <div
                  key={book.id}
                  onClick={() => selectBook(book.id, true, false)}
                  className={`group bg-[#16171b] hover:bg-[#1d1e23] border border-white/[0.04] hover:border-white/[0.08] rounded-2xl p-3 flex items-center gap-3.5 transition-all cursor-pointer ${isDone ? 'opacity-85' : ''
                    } ${isSelected ? 'border-[#ffb86b]/30 bg-[#1d1e23]' : ''}`}
                >
                  {/* Thumbnail */}
                  <div className="relative w-14 h-19 rounded-md overflow-hidden flex-shrink-0 shadow-sm bg-[#0a0b0d] ring-1 ring-white/5">
                    <img
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      alt={book.title}
                      src={book.coverUrl}
                    />
                    {isDone && (
                      <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                        <span className="material-symbols-outlined text-[16px] text-white/90">done</span>
                      </div>
                    )}
                    {isSelected && isPlaying && (
                      <div className="absolute inset-0 bg-[#ffb86b]/20 flex items-center justify-center">
                        <span className="w-2 h-2 rounded-full bg-[#ffb86b] animate-ping" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex flex-col min-w-0 flex-1 justify-center gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-[15px] font-medium text-white truncate group-hover:text-[#ffb86b] transition-colors">
                        {book.title}
                      </h4>
                    </div>

                    <p className="text-[12px] text-[#9a9da6] truncate">
                      {book.author} • {book.source}
                    </p>

                    {/* Progress / Status */}
                    {isDone ? (
                      <div className="flex items-center gap-2 text-[11px] text-white/45 mt-1">
                        <span className="text-[#ffb86b]/90 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">check_circle</span>
                          <span>הושלם</span>
                        </span>
                      </div>
                    ) : book.currentTimeSeconds === 0 ? (
                      <div className="flex items-center gap-2 text-[11px] text-white/45 mt-1">
                        <span>משך: {formatTime(book.totalDurationSeconds).slice(0, 5)} ש׳</span>
                        <span>•</span>
                        <span className="text-[#ffb86b]/80">טרם הושמע</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 text-[11px] text-white/45 mt-1">
                        <div className="w-20 h-1 bg-white/[0.08] rounded-full overflow-hidden flex flex-row-reverse">
                          <div
                            className="bg-[#ffb86b]/80 h-full rounded-full"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span>
                          {progress}% • נותרו{' '}
                          {Math.max(
                            0.1,
                            Math.round(
                              ((book.totalDurationSeconds - book.currentTimeSeconds) / 3600) * 10
                            ) / 10
                          )}{' '}
                          ש׳
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuBookId(activeMenuBookId === book.id ? null : book.id);
                      }}
                      aria-label="אפשרויות"
                      className="text-white/35 hover:text-white transition-colors p-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">more_vert</span>
                    </button>

                    {activeMenuBookId === book.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute left-0 top-7 bg-[#24252a] border border-white/[0.1] rounded-xl p-1.5 shadow-2xl z-30 min-w-[150px] text-[13px] flex flex-col gap-1"
                      >
                        <button
                          onClick={() => {
                            selectBook(book.id, true, true);
                            setActiveMenuBookId(null);
                          }}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-white hover:bg-white/10 text-right cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                          <span>נגן במסך מלא</span>
                        </button>
                        <button
                          onClick={() => {
                            deleteBook(book.id);
                            setActiveMenuBookId(null);
                          }}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-red-400 hover:bg-red-500/10 text-right cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                          <span>מחק ספר</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Right Action Button */}
                  {isDone ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        selectBook(book.id, true, true);
                      }}
                      aria-label="האזן שוב"
                      className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/70 hover:text-white flex items-center justify-center flex-shrink-0 transition-all active:scale-95 cursor-pointer"
                      title="האזן שוב"
                    >
                      <span className="material-symbols-outlined text-[18px]">replay</span>
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isSelected) {
                          playPause();
                        } else {
                          selectBook(book.id, true, false);
                        }
                      }}
                      aria-label="נגן"
                      className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-95 cursor-pointer ${isSelected && isPlaying
                        ? 'bg-[#ffb86b] text-[#492900]'
                        : 'bg-white/[0.06] group-hover:bg-[#ffb86b] group-hover:text-[#492900] text-white/80'
                        }`}
                    >
                      <span
                        className="material-symbols-outlined text-[20px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        {isSelected && isPlaying ? 'pause' : 'play_arrow'}
                      </span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Subtle Sleep Companion Bar */}
      <div className="bg-[#16171b]/60 border border-white/[0.04] rounded-2xl px-4 py-3 flex items-center justify-between text-[#9a9da6]">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[#ffb86b]/80 text-[20px]">bedtime</span>
          <div className="flex flex-col">
            <span className="text-[13px] text-white/90 font-medium">טיימר שינה מתוזמן</span>
            <span className="text-[11px] text-white/45">
              {sleepTimerSecondsRemaining
                ? `כיבוי בעוד ${Math.ceil(sleepTimerSecondsRemaining / 60)} דקות`
                : 'כיבוי בסיום הפרק הנוכחי'}
            </span>
          </div>
        </div>
        <button
          onClick={() => setIsSleepTimerModalOpen(true)}
          className="text-[12px] text-[#ffb86b] hover:underline px-2 py-1 cursor-pointer font-medium"
        >
          הגדרות
        </button>
      </div>

      {/* Modal to add custom book */}
      <AddBookModal isOpen={isAddBookModalOpen} onClose={() => setIsAddBookModalOpen(false)} />
    </main>
  );
}
