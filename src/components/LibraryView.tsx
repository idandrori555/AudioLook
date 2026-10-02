import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useAudio } from '../context/AudioContext';
import { pressTap, springGentle, springSnappy, staggerDelay, tx, useAppReducedMotion, useIntroPlayed } from './motion';
import CoverImg from './CoverImg';


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
  const [pendingDeleteBookId, setPendingDeleteBookId] = useState<string | null>(null);
  const reduced = useAppReducedMotion();
  // Entrance choreography plays once — revisits render instantly so the tab
  // doesn't blink twice (container fade + staggered list wave).
  const intro = useIntroPlayed('library');

  const pendingDeleteBook = pendingDeleteBookId
    ? books.find((b) => b.id === pendingDeleteBookId) ?? null
    : null;

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

  // (Removed: cumulative listened-time stat — summing live positions isn't real listening history.)

  // Book-level hero stats. For playlists, the live player position/duration
  // only cover the CURRENT video — so elapsed/total are accumulated across
  // all chapters instead (completed chapters count in full).
  const heroStats = (() => {
    if (!currentBook) return { elapsed: 0, total: 0 };
    const chs = currentBook.chapters || [];
    if (currentBook.isPlaylist && chs.length > 0) {
      const dur = (i: number) => Math.max(0, chs[i]?.duration || 0);
      const total = chs.reduce((s, _, i) => s + dur(i), 0);
      if (total > 0) {
        const idx = Math.min(Math.max(0, currentBook.currentChapterIndex || 0), chs.length - 1);
        const before = chs.slice(0, idx).reduce((s, _, i) => s + dur(i), 0);
        const chapterDur = dur(idx);
        const posInChapter =
          chapterDur > 0
            ? Math.min(Math.max(0, currentTime), chapterDur)
            : Math.max(0, currentTime);
        return { elapsed: Math.min(total, before + posInChapter), total };
      }
    }
    return { elapsed: currentTime, total: duration };
  })();

  const currentBookProgressPercent =
    heroStats.total > 0 ? Math.min(100, Math.max(0, (heroStats.elapsed / heroStats.total) * 100)) : 0;

  const heroHoursRemaining = currentBook
    ? Math.max(0, Math.round(((heroStats.total - heroStats.elapsed) / 3600) * 10) / 10)
    : 0;

  return (
    <main className="flex-1 w-full page-with-dock px-5 max-w-xl mx-auto flex flex-col gap-6 pt-5">
      {/* Title & Real Statistics Summary */}
      <motion.div
        initial={intro ? { opacity: 0, y: reduced ? 0 : 10 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={tx(reduced, springGentle)}
        className="flex flex-col gap-1"
      >
        <div className="flex items-center justify-between">
          <h1 className="text-[28px] font-semibold tracking-tight text-white">הספרייה שלי</h1>
        </div>
        <p className="text-[13px] text-[#9a9da6] flex items-center gap-2">
          <span>{books.length} פריטים בספרייה</span>
        </p>
      </motion.div>

      {/* Quiet Integrated Quick-Import Field */}
      <div className="glass-static relative flex items-center rounded-2xl p-1.5 pr-3.5 focus-within:!border-[#ffb86b]/40 transition-colors overflow-hidden">
        <div className="glass-glint" />
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
          className="flex-shrink-0 px-2.5 py-1.5 rounded-xl bg-white/[0.07] hover:bg-[#ffb86b] hover:text-[#492900] text-[13px] font-medium text-white/85 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          id="quick-btn"
        >
          {importStatus === 'importing' ? (
            <>
              <span className="material-symbols-outlined text-[15px] animate-spin motion-reduce:animate-none">refresh</span>
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
            </>
          )}
        </button>
      </div>

      {/* Minimal Category Segmented Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5" id="shelf-filters">
        <button
          onClick={() => setActiveFilter('all')}
          className={`filter-tab px-4 py-2 rounded-full text-[13px] font-medium transition-all cursor-pointer whitespace-nowrap ${activeFilter === 'all'
            ? 'bg-[#ffb86b]/15 text-[#ffb86b] ring-1 ring-inset ring-[#ffb86b]/25'
            : 'bg-transparent text-white/60 hover:text-white hover:bg-white/[0.05]'
            }`}
        >
          הכל ({allCount})
        </button>
        <button
          onClick={() => setActiveFilter('listening')}
          className={`filter-tab px-4 py-2 rounded-full text-[13px] font-medium transition-all cursor-pointer whitespace-nowrap ${activeFilter === 'listening'
            ? 'bg-[#ffb86b]/15 text-[#ffb86b] ring-1 ring-inset ring-[#ffb86b]/25'
            : 'bg-transparent text-white/60 hover:text-white hover:bg-white/[0.05]'
            }`}
        >
          בהאזנה ({listeningCount})
        </button>
        <button
          onClick={() => setActiveFilter('completed')}
          className={`filter-tab px-4 py-2 rounded-full text-[13px] font-medium transition-all cursor-pointer whitespace-nowrap ${activeFilter === 'completed'
            ? 'bg-[#ffb86b]/15 text-[#ffb86b] ring-1 ring-inset ring-[#ffb86b]/25'
            : 'bg-transparent text-white/60 hover:text-white hover:bg-white/[0.05]'
            }`}
        >
          הושלמו ({completedCount})
        </button>
        <button
          onClick={() => setActiveFilter('queued')}
          className={`filter-tab px-4 py-2 rounded-full text-[13px] font-medium transition-all cursor-pointer whitespace-nowrap ${activeFilter === 'queued'
            ? 'bg-[#ffb86b]/15 text-[#ffb86b] ring-1 ring-inset ring-[#ffb86b]/25'
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
          </div>

          <motion.div
            initial={intro ? { opacity: 0, y: reduced ? 0 : 14 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={tx(reduced, springGentle)}
            className="glass-static relative overflow-hidden rounded-2xl p-4 hover:border-[#ffb86b]/25 hover:shadow-[0_16px_48px_-12px_rgb(255_184_107/0.25)] transition-all duration-300 flex flex-col gap-4"
          >
            <div className="glass-glint" />
            <div className="pointer-events-none absolute -top-20 -end-20 w-56 h-56 rounded-full bg-[#ffb86b]/[0.07] blur-3xl" aria-hidden="true" />
            <div
              className="flex items-start gap-4 cursor-pointer"
              onClick={() => setActiveTab('player')}
            >
              <div className="relative w-20 h-28 rounded-lg overflow-hidden flex-shrink-0 shadow-md bg-[#0a0b0d] ring-1 ring-white/10 group">
                <CoverImg
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  alt={currentBook.title}
                  src={currentBook.coverUrl}
                />
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
                  className="progress-shimmer bg-gradient-to-l from-[#ffb86b] to-[#ffc685] h-full rounded-full transition-all duration-300"
                  style={{ width: `${currentBookProgressPercent}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[11px] text-white/40 font-mono">
                <span>{formatTime(heroStats.elapsed)}</span>
                <span>{formatRemainingTime(heroStats.elapsed, heroStats.total)}</span>
              </div>
            </div>

            {/* Play Action Strip */}
            <div className="flex items-center gap-3 pt-1 border-t border-white/[0.04]">
              <button
                onClick={() => {
                  if (!isPlaying) playPause();
                  setActiveTab('player');
                }}
                className="flex-1 min-w-0 h-11 rounded-xl bg-[#ffb86b] hover:bg-[#ffc685] text-[#492900] font-medium text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md shadow-[#ffb86b]/10 cursor-pointer px-2"
              >
                <span
                  className="material-symbols-outlined text-[20px] shrink-0"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {isPlaying ? 'pause' : 'play_arrow'}
                </span>
                <span className="truncate">
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
              <button
                onClick={() => currentBook && setPendingDeleteBookId(currentBook.id)}
                aria-label="מחק ספר"
                className="w-11 h-11 rounded-xl bg-white/[0.05] hover:bg-red-500/10 text-white/75 hover:text-red-400 flex items-center justify-center transition-colors active:scale-95 cursor-pointer"
                title="מחק ספר מהספרייה"
              >
                <span className="material-symbols-outlined text-[19px]">delete</span>
              </button>
            </div>
          </motion.div>
        </section>
      ) : (
        <section className="glass-static rounded-2xl p-6 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 rounded-full bg-white/[0.04] text-[#ffb86b] flex items-center justify-center">
            <span className="material-symbols-outlined text-[30px]">local_library</span>
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-[17px] font-semibold text-white">הספרייה שלך ריקה כרגע</h3>
            <p className="text-[13px] text-[#9a9da6] max-w-sm">
              הדבק קישור יוטיוב בשורת הייבוא למעלה.
            </p>
          </div>
        </section>
      )}

      {/* Bookshelf Section: Thoughtful list of books */}
      <section className="flex flex-col gap-3 mt-1">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[17px] font-semibold text-white">ספרי שמע</h3>
          <span className="text-[12px] text-white/40">{filteredBooks.length} פריטים</span>
        </div>

        {filteredBooks.length === 0 ? (
          <div className="glass-static py-8 text-center text-white/40 text-[13px] rounded-xl">
            אין פריטים להצגה בסינון זה
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filteredBooks.map((book, i) => {
              const isSelected = currentBook?.id === book.id;

              const isDone = book.category === 'completed';

              return (
                <motion.div
                  key={book.id}
                  onClick={() => selectBook(book.id, true, false)}
                  initial={intro ? { opacity: 0, y: reduced ? 0 : 14 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={tx(reduced, { ...springGentle, delay: intro ? staggerDelay(i) : 0 })}
                  whileTap={reduced ? undefined : pressTap}
                  whileHover={reduced ? undefined : { y: -2 }}
                  className={`group glass-static rounded-2xl p-3 flex items-center gap-3.5 hover:border-[#ffb86b]/25 hover:shadow-[0_12px_32px_-12px_rgb(0_0_0/0.6)] transition-all duration-300 cursor-pointer ${isDone ? 'opacity-85' : ''
                    } ${isSelected ? '!border-[#ffb86b]/40 shadow-[0_12px_32px_-12px_rgb(255_184_107/0.3)]' : ''}`}
                >
                  {/* Thumbnail — shared-element source for the player cover morph */}
                  <motion.div
                    layoutId={`cover-${book.id}`}
                    transition={tx(reduced, springSnappy)}
                    className="relative w-14 h-19 rounded-md overflow-hidden flex-shrink-0 shadow-sm bg-[#0a0b0d] ring-1 ring-white/5"
                  >
                    <CoverImg
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      alt={book.title}
                      src={book.coverUrl}
                      iconClassName="text-[16px]"
                    />
                    {isDone && (
                      <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                        <span className="material-symbols-outlined text-[16px] text-white/90">done</span>
                      </div>
                    )}
                  </motion.div>

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
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingDeleteBookId(book.id);
                    }}
                    aria-label="מחק ספר"
                    className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-white/35 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    title="מחק ספר מהספרייה"
                  >
                    <span className="material-symbols-outlined text-[18px] leading-none">delete</span>
                  </button>

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
                        className="material-symbols-outlined text-[20px] leading-none"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        {isSelected && isPlaying ? 'pause' : 'play_arrow'}
                      </span>
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* Subtle Sleep Companion Bar */}
      <div className="glass-static rounded-2xl px-4 py-3 flex items-center justify-between text-[#9a9da6]">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[#ffb86b]/80 text-[20px]">bedtime</span>
          <div className="flex flex-col">
            <span className="text-[13px] text-white/90 font-medium">טיימר שינה מתוזמן</span>
            <span className="text-[11px] text-white/45">
              {sleepTimerSecondsRemaining
                ? `כיבוי בעוד ${Math.ceil(sleepTimerSecondsRemaining / 60)} דקות`
                : 'כבוי — ללא טיימר פעיל'}
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

      {/* Delete confirmation */}
      <AnimatePresence>
        {pendingDeleteBookId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={tx(reduced, springSnappy)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
            onClick={() => setPendingDeleteBookId(null)}
          >
            <motion.div
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 10 }}
              transition={tx(reduced, springSnappy)}
              className="glass relative overflow-hidden w-full max-w-sm max-h-[90dvh] overflow-y-auto rounded-2xl p-5 flex flex-col gap-4 text-right"
              dir="rtl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="glass-glint" />
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-red-400 text-[22px]">delete</span>
                <h3 className="text-[17px] font-semibold text-white">למחוק את הספר?</h3>
              </div>
              <p className="text-[13px] text-white/60 leading-relaxed">
                {pendingDeleteBook
                  ? `״${pendingDeleteBook.title}״ יימחק מהספרייה יחד עם הסימניות שלו. לא ניתן לבטל פעולה זו.`
                  : 'הספר יימחק מהספרייה יחד עם הסימניות שלו. לא ניתן לבטל פעולה זו.'}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPendingDeleteBookId(null)}
                  className="flex-1 h-11 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white text-[14px] font-medium transition-colors cursor-pointer"
                >
                  ביטול
                </button>
                <button
                  onClick={() => {
                    if (pendingDeleteBookId) deleteBook(pendingDeleteBookId);
                    setPendingDeleteBookId(null);
                  }}
                  className="flex-1 h-11 rounded-xl bg-red-500 hover:bg-red-400 text-white text-[14px] font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                  <span>מחק</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
