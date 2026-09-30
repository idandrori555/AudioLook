import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useAudio } from '../context/AudioContext';
import { springFast, springGentle, staggerDelay, tx, useAppReducedMotion } from './motion';
import CoverImg from './CoverImg';

export default function SearchModal() {
  const { isSearchModalOpen, setIsSearchModalOpen, books, selectBook } = useAudio();
  const [query, setQuery] = useState('');
  const reduced = useAppReducedMotion();

  const results = query.trim()
    ? books.filter(
        (b) =>
          b.title.toLowerCase().includes(query.toLowerCase()) ||
          b.author.toLowerCase().includes(query.toLowerCase()) ||
          b.chapters.some((ch) => ch.title.toLowerCase().includes(query.toLowerCase()))
      )
    : books.slice(0, 4);

  return (
    <AnimatePresence>
      {isSearchModalOpen && (
      <motion.div
        key="search-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={tx(reduced, springFast)}
        className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 bg-black/75 backdrop-blur-md"
        onClick={() => setIsSearchModalOpen(false)}
      >
      <motion.div
        key="search-panel"
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: -24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.98 }}
        transition={tx(reduced, springFast)}
        className="glass relative w-full max-w-md rounded-2xl flex flex-col max-h-[80vh] overflow-hidden"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="glass-glint" />
        {/* Search input header */}
        <div className="p-3 border-b border-white/[0.06] flex items-center gap-2">
          <span className="material-symbols-outlined text-white/40 text-[20px] mr-1">search</span>
          <input
            ref={(el) => {
              // Autofocus only with a fine pointer (desktop): on phones it
              // pops the keyboard on open and jumps the layout.
              if (el && window.matchMedia?.('(pointer: fine)').matches) el.focus();
            }}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חפש ספר, סופר או פרק..."
            className="flex-1 bg-transparent text-[15px] text-white placeholder:text-white/35 outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-white/40 hover:text-white p-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
          <button
            onClick={() => setIsSearchModalOpen(false)}
            className="px-2.5 py-1 text-[13px] text-[#ffb86b] hover:underline cursor-pointer"
          >
            סגור
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {books.length === 0 ? (
            <div className="py-8 text-center text-white/40 text-[13px]">
              אין עדיין ספרי שמע בספרייה לחיפוש
            </div>
          ) : results.length === 0 ? (
            <div className="py-8 text-center text-white/40 text-[13px]">
              לא נמצאו תוצאות עבור "{query}"
            </div>
          ) : (
            <>
              <span className="text-[11px] text-white/40 px-2 block">
                {query.trim() ? `נמצאו ${results.length} תוצאות` : 'חיפושים בספרייה:'}
              </span>

              {results.map((book, i) => (
                <motion.div
                  key={book.id}
                  initial={{ opacity: 0, y: reduced ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={tx(reduced, { ...springGentle, delay: staggerDelay(i, 0.035, 0.2) })}
                  onClick={() => {
                    selectBook(book.id, true, true);
                    setIsSearchModalOpen(false);
                  }}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-[#ffb86b]/[0.07] transition-colors cursor-pointer"
                >
                  <CoverImg
                    src={book.coverUrl}
                    alt={book.title}
                    className="w-10 h-14 object-cover rounded-md flex-shrink-0"
                    iconClassName="text-[16px]"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[14px] font-medium text-white truncate">{book.title}</h4>
                    <p className="text-[12px] text-[#9a9da6] truncate">{book.author}</p>
                  </div>
                  <span className="material-symbols-outlined text-[18px] text-white/40">
                    arrow_back_ios
                  </span>
                </motion.div>
              ))}
            </>
          )}
        </div>
      </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );
}
