import React, { useState } from 'react';
import { useAudio } from '../context/AudioContext';
import { Book } from '../types';

interface AddBookModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddBookModal({ isOpen, onClose }: AddBookModalProps) {
  const { addBook, importYouTubeAudio } = useAudio();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [youtubeInput, setYoutubeInput] = useState('');
  const [source, setSource] = useState('ספר קולי');
  const [coverUrl, setCoverUrl] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('45');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // If a YouTube playlist or video URL was entered, use importYouTubeAudio
    if (youtubeInput.trim() && (youtubeInput.includes('list=') || !title.trim())) {
      setIsProcessing(true);
      const success = await importYouTubeAudio(youtubeInput.trim());
      setIsProcessing(false);
      if (success) {
        onClose();
        return;
      }
    }

    if (!title.trim()) return;

    const durMin = parseInt(durationMinutes) || 45;
    const durSec = durMin * 60;

    let parsedYtId: string | undefined = undefined;
    if (youtubeInput.trim()) {
      const regExp = /^.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
      const match = youtubeInput.trim().match(regExp);
      parsedYtId = match && match[1]?.length === 11 ? match[1] : youtubeInput.trim().length === 11 ? youtubeInput.trim() : undefined;
    }

    const defaultCover = parsedYtId
      ? `https://img.youtube.com/vi/${parsedYtId}/hqdefault.jpg`
      : 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80';

    const newBook: Book = {
      id: `book-${Date.now()}`,
      youtubeId: parsedYtId,
      title: title.trim(),
      author: author.trim() || (parsedYtId ? 'ערוץ יוטיוב' : 'סופר לא ידוע'),
      source: source.trim() || (parsedYtId ? 'וידאו יוטיוב' : 'ספר קולי'),
      coverUrl: coverUrl.trim() || defaultCover,
      category: 'listening',
      totalChapters: parsedYtId ? 1 : 3,
      currentChapterIndex: 0,
      totalDurationSeconds: durSec,
      currentTimeSeconds: 0,
      isOfflineAvailable: true,
      sizeOffline: `${Math.round(durMin * 1.2)}MB`,
      chapters: parsedYtId
        ? []
        : [
            { id: `c-1`, number: 1, title: 'חלק 1: פתיחה ומבוא', duration: Math.floor(durSec * 0.3), durationFormatted: `${Math.floor(durMin * 0.3)} דק׳` },
            { id: `c-2`, number: 2, title: 'חלק 2: גוף הסיפור', duration: Math.floor(durSec * 0.5), durationFormatted: `${Math.floor(durMin * 0.5)} דק׳` },
            { id: `c-3`, number: 3, title: 'חלק 3: סיום ומסקנות', duration: Math.floor(durSec * 0.2), durationFormatted: `${Math.floor(durMin * 0.2)} דק׳` },
          ],
    };

    addBook(newBook);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div
        className="w-full max-w-sm bg-[#1e1f24] rounded-2xl border border-white/[0.08] p-5 shadow-2xl flex flex-col gap-4 text-right"
        dir="rtl"
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ffb86b] text-[22px]">auto_stories</span>
            <h3 className="text-[17px] font-semibold text-white">הוספת ספר שמע חדש</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-white/70 flex items-center justify-center cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-[12px] text-white/70 mb-1 block">שם הספר / הפודקאסט *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="למשל: הנסיך הקטן"
              className="w-full bg-[#16171b] border border-white/[0.08] rounded-xl px-3 py-2 text-[14px] text-white placeholder:text-white/30 outline-none focus:border-[#ffb86b]/60"
            />
          </div>

          <div>
            <label className="text-[12px] text-white/70 mb-1 block">שם הסופר / יוצר</label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="למשל: אנטואן דה סנט-אכזופרי"
              className="w-full bg-[#16171b] border border-white/[0.08] rounded-xl px-3 py-2 text-[14px] text-white placeholder:text-white/30 outline-none focus:border-[#ffb86b]/60"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[12px] text-white/70">קישור יוטיוב (סרטון או פלייליסט שלם)</label>
              <span className="text-[11px] text-[#ffb86b]">פלייליסט מחולק לפרקים</span>
            </div>
            <input
              type="text"
              value={youtubeInput}
              onChange={(e) => setYoutubeInput(e.target.value)}
              placeholder="קישור לפלייליסט או סרטון (לדוגמה: https://www.youtube.com/playlist?list=...)"
              className="w-full bg-[#16171b] border border-white/[0.08] rounded-xl px-3 py-2 text-[14px] text-white placeholder:text-white/30 outline-none focus:border-[#ffb86b]/60"
            />
            <span className="text-[11px] text-[#9a9da6] mt-1 block">
              הזנת קישור פלייליסט תחלק אוטומטית את התוכן לפרקים לפי כל סרטון בפלייליסט!
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[12px] text-white/70 mb-1 block">משך (בדקות)</label>
              <input
                type="number"
                min="5"
                max="1200"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="w-full bg-[#16171b] border border-white/[0.08] rounded-xl px-3 py-2 text-[14px] text-white outline-none focus:border-[#ffb86b]/60"
              />
            </div>
            <div>
              <label className="text-[12px] text-white/70 mb-1 block">מקור / סוג</label>
              <input
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="ספר קולי / פודקאסט"
                className="w-full bg-[#16171b] border border-white/[0.08] rounded-xl px-3 py-2 text-[14px] text-white outline-none focus:border-[#ffb86b]/60"
              />
            </div>
          </div>

          <div>
            <label className="text-[12px] text-white/70 mb-1 block">כתובת תמונת כריכה (אופציונלי)</label>
            <input
              type="url"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-[#16171b] border border-white/[0.08] rounded-xl px-3 py-2 text-[14px] text-white placeholder:text-white/30 outline-none focus:border-[#ffb86b]/60"
            />
          </div>

          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white text-[13px] font-medium transition-colors cursor-pointer"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="flex-1 py-2 rounded-xl bg-[#ffb86b] hover:bg-[#ffc685] text-[#492900] text-[13px] font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
                  <span>מעבד ומייבא...</span>
                </>
              ) : (
                <span>שמור והוסף</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
