import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useAudio } from '../context/AudioContext';
import { springGentle, tx, useAppReducedMotion, useIntroPlayed } from './motion';
import { parseBackupText } from '../services/backup';
import type { ImportMode, LyraBackup } from '../services/backup';
import { clearCoverCaches, formatBytes, useStorageEstimate } from '../services/deviceStorage';

export default function SettingsView() {
  const {
    playbackSpeed,
    setPlaybackSpeed,
    audioSoundEnabled,
    setAudioSoundEnabled,
    books,
    showToast,
    exportLibrary,
    applyBackup,
  } = useAudio();

  const reduced = useAppReducedMotion();
  const intro = useIntroPlayed('settings');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingBackup, setPendingBackup] = useState<{
    backup: LyraBackup;
    fileName: string;
    skipped: string | null;
  } | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const storage = useStorageEstimate();

  const sectionAnim = (i: number) => ({
    initial: (intro ? { opacity: 0, y: reduced ? 0 : 14 } : false) as false | { opacity: number; y: number },
    animate: { opacity: 1, y: 0 },
    transition: tx(reduced, { ...springGentle, delay: intro ? i * 0.07 : 0 }),
  });

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    setBackupBusy(true);
    try {
      const result = parseBackupText(await file.text());
      if (!result.ok) {
        showToast(result.error);
        return;
      }
      const { backup, booksSkipped, bookmarksSkipped } = result.parsed;
      setPendingBackup({
        backup,
        fileName: file.name,
        skipped:
          booksSkipped + bookmarksSkipped > 0
            ? `דולגו ${booksSkipped} ספרים ו-${bookmarksSkipped} סימניות פגומים`
            : null,
      });
    } catch {
      showToast('קריאת קובץ הגיבוי נכשלה');
    } finally {
      setBackupBusy(false);
    }
  };

  const confirmImport = (mode: ImportMode) => {
    if (!pendingBackup) return;
    applyBackup(pendingBackup.backup, mode);
    setPendingBackup(null);
  };

  const handleClearCaches = async () => {
    const { clearedCaches, freedBytes } = await clearCoverCaches();
    showToast(
      clearedCaches === 0
        ? 'לא נמצא מטמון תמונות לניקוי'
        : `נוקה מטמון תמונות (${formatBytes(freedBytes)} פונו)`,
    );
  };

  return (
    <main className="flex-1 w-full page-with-dock px-5 max-w-xl mx-auto flex flex-col gap-6 pt-5" dir="rtl">
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-semibold tracking-tight text-white">הגדרות האפליקציה</h1>
        <p className="text-[13px] text-[#9a9da6]">התאמה אישית של חוויית ההאזנה והאחסון</p>
      </div>

      {/* Audio Playback Preferences */}
      <motion.section {...sectionAnim(0)} className="glass-static rounded-2xl p-4 flex flex-col gap-4 hover:border-[#ffb86b]/20 transition-colors duration-300">
        <h2 className="text-[15px] font-semibold text-[#ffb86b] flex items-center gap-2">
          <span className="material-symbols-outlined text-[19px]">tune</span>
          <span>נגינה ושמע</span>
        </h2>

        <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
          <div className="flex flex-col">
            <span className="text-[14px] text-white">מהירות ברירת מחדל</span>
            <span className="text-[11px] text-[#9a9da6]">משפיע על כל ספרי השמע</span>
          </div>
          <div className="flex items-center gap-1 bg-[#1d1e23] p-1 rounded-xl border border-white/[0.06]">
            {[1.0, 1.25, 1.5].map((s) => (
              <button
                key={s}
                onClick={() => setPlaybackSpeed(s)}
                className={`px-2.5 py-1 rounded-lg text-[12px] font-medium transition-colors cursor-pointer ${playbackSpeed === s
                  ? 'bg-[#ffb86b] text-[#2c1700] font-bold'
                  : 'text-white/60 hover:text-white'
                  }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
          <div className="flex flex-col">
            <span className="text-[14px] text-white">טון אנלוגי חמים ברקע</span>
            <span className="text-[11px] text-[#9a9da6]">
              תדר 136.1Hz להרגעה והתמקדות בזמן האזנה
            </span>
          </div>
          <button
            onClick={() => setAudioSoundEnabled(!audioSoundEnabled)}
            role="switch"
            aria-checked={audioSoundEnabled}
            className={`w-12 h-7 rounded-full p-1 transition-colors duration-300 cursor-pointer flex items-center ${audioSoundEnabled ? 'bg-[#ffb86b] justify-end shadow-[0_0_16px_rgba(255,184,107,0.4)]' : 'bg-white/10 justify-start'
              }`}
          >
            <motion.div
              layout
              transition={tx(reduced, springGentle)}
              className={`w-5 h-5 rounded-full shadow ${audioSoundEnabled ? 'bg-[#2c1700]' : 'bg-white/60'
                }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between py-2">
          <div className="flex flex-col">
            <span className="text-[14px] text-white">הקפצה בלחיצה</span>
            <span className="text-[11px] text-[#9a9da6]">10 שניות אחורה • 10 שניות קדימה</span>
          </div>
          <span className="text-[12px] font-mono text-white/50 bg-white/[0.04] px-2.5 py-1 rounded-lg">
            10s / 10s
          </span>
        </div>
      </motion.section>

      {/* Library Backup & Restore */}
      <motion.section {...sectionAnim(1)} className="glass-static rounded-2xl p-4 flex flex-col gap-4 hover:border-[#ffb86b]/20 transition-colors duration-300">
        <h2 className="text-[15px] font-semibold text-[#ffb86b] flex items-center gap-2">
          <span className="material-symbols-outlined text-[19px]">backup</span>
          <span>גיבוי ושחזור</span>
        </h2>

        <p className="text-[12px] text-[#9a9da6] leading-relaxed">
          הספרייה נשמרת רק על המכשיר הזה ({books.length} ספרים). ייצאו גיבוי כדי לא לאבד אותה.
        </p>

        <div className="flex items-center gap-2">
          <button
            onClick={exportLibrary}
            className="flex-1 h-11 rounded-xl bg-[#ffb86b] hover:bg-[#ffc685] text-[#492900] font-medium text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            <span>ייצוא גיבוי</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={backupBusy}
            className="flex-1 h-11 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white text-[14px] font-medium flex items-center justify-center gap-2 transition-colors active:scale-[0.98] cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">upload</span>
            <span>{backupBusy ? 'קורא קובץ...' : 'ייבוא גיבוי'}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            aria-label="בחירת קובץ גיבוי"
            onChange={(e) => {
              handleImportFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>

        {pendingBackup && (
          <div className="rounded-xl border border-[#ffb86b]/30 bg-[#ffb86b]/[0.06] p-3.5 flex flex-col gap-2.5">
            <div className="flex flex-col">
              <span className="text-[13px] font-medium text-white truncate" dir="ltr">{pendingBackup.fileName}</span>
              <span className="text-[12px] text-[#9a9da6]">
                {pendingBackup.backup.books.length} ספרים • {pendingBackup.backup.bookmarks.length} סימניות
                {' • '}
                {new Date(pendingBackup.backup.exportedAt).toLocaleDateString('he-IL')}
              </span>
              {pendingBackup.skipped && (
                <span className="text-[11px] text-amber-300/80 mt-0.5">{pendingBackup.skipped}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => confirmImport('merge')}
                className="flex-1 h-10 rounded-xl bg-[#ffb86b] hover:bg-[#ffc685] text-[#492900] text-[13px] font-medium transition-colors cursor-pointer"
              >
                מזג לספרייה
              </button>
              <button
                onClick={() => confirmImport('replace')}
                className="flex-1 h-10 rounded-xl border border-red-500/40 text-red-300 hover:bg-red-500/10 text-[13px] font-medium transition-colors cursor-pointer"
              >
                החלף את הספרייה
              </button>
              <button
                onClick={() => setPendingBackup(null)}
                className="h-10 px-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/80 text-[13px] transition-colors cursor-pointer"
              >
                בטל
              </button>
            </div>
            <p className="text-[11px] text-white/40 leading-relaxed">
              מיזוג שומר את הקיים ומוסיף חדשים (ההתקדמות החדשה מנצחת). החלפה מוחקת את הספרייה הנוכחית.
            </p>
          </div>
        )}
      </motion.section>

      {/* Storage and Streaming */}
      <motion.section {...sectionAnim(2)} className="glass-static rounded-2xl p-4 flex flex-col gap-4 hover:border-[#ffb86b]/20 transition-colors duration-300">
        <h2 className="text-[15px] font-semibold text-[#ffb86b] flex items-center gap-2">
          <span className="material-symbols-outlined text-[19px]">hard_drive</span>
          <span>אחסון וסטרימינג</span>
        </h2>

        <div className="flex items-center justify-between gap-3 py-2 border-b border-white/[0.04]">
          <div className="flex flex-col">
            <span className="text-[14px] text-white">נפח אחסון דפדפן</span>
            <span className="text-[11px] text-[#9a9da6]">
              {storage === undefined
                ? 'מודד...'
                : storage === null
                  ? 'לא נתמך בדפדפן זה'
                  : `${formatBytes(storage.usageBytes)} מתוך ${formatBytes(storage.quotaBytes)}`}
            </span>
          </div>
          <button
            onClick={handleClearCaches}
            className="flex-shrink-0 px-3 py-1.5 rounded-xl border border-white/[0.12] text-white/80 hover:bg-white/[0.06] text-[12px] transition-colors cursor-pointer"
          >
            נקה מטמון תמונות
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 py-2 border-b border-white/[0.04]">
          <div className="flex flex-col">
            <span className="text-[14px] text-white">מצב אופליין</span>
            <span className="text-[11px] text-[#9a9da6]">התכנים מוזרמים מיוטיוב ודורשים חיבור — אין הורדות אופליין בגרסה זו</span>
          </div>
          <span className="flex-shrink-0 text-[12px] text-white/60 bg-white/[0.05] px-2.5 py-1 rounded-lg">
            סטרימינג בלבד
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 py-2">
          <div className="flex flex-col">
            <span className="text-[14px] text-white">איכות אודיו</span>
            <span className="text-[11px] text-[#9a9da6]">מותאמת אוטומטית לחיבור שלכם</span>
          </div>
          <span className="flex-shrink-0 text-[12px] text-[#ffb86b] bg-[#ffb86b]/10 px-2.5 py-1 rounded-lg">
            YouTube אדפטיבית
          </span>
        </div>
      </motion.section>

    </main>
  );
}
