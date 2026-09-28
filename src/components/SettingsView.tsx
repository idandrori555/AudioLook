import React from 'react';
import { useAudio } from '../context/AudioContext';

export default function SettingsView() {
  const {
    playbackSpeed,
    setPlaybackSpeed,
    audioSoundEnabled,
    setAudioSoundEnabled,
    books,
    showToast,
  } = useAudio();

  const totalMB = books.length * 85;
  const storageFormatted = totalMB >= 1000 ? `${(totalMB / 1024).toFixed(1)}GB` : `${totalMB}MB`;

  const handleClearCache = () => {
    showToast(`זיכרון מטמון נוקה (${storageFormatted} פונו)`);
  };

  return (
    <main className="flex-1 w-full pb-36 px-5 max-w-xl mx-auto flex flex-col gap-6 pt-5" dir="rtl">
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-semibold tracking-tight text-white">הגדרות האפליקציה</h1>
        <p className="text-[13px] text-[#9a9da6]">התאמה אישית של חוויית ההאזנה והאחסון</p>
      </div>

      {/* Audio Playback Preferences */}
      <section className="bg-[#16171b] rounded-2xl p-4 border border-white/[0.04] flex flex-col gap-4">
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
                className={`px-2.5 py-1 rounded-lg text-[12px] font-medium transition-colors cursor-pointer ${
                  playbackSpeed === s
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
            className={`w-12 h-7 rounded-full p-1 transition-colors cursor-pointer flex items-center ${
              audioSoundEnabled ? 'bg-[#ffb86b] justify-end' : 'bg-white/10 justify-start'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full ${
                audioSoundEnabled ? 'bg-[#2c1700]' : 'bg-white/60'
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
      </section>

      {/* Storage and Downloads */}
      <section className="bg-[#16171b] rounded-2xl p-4 border border-white/[0.04] flex flex-col gap-4">
        <h2 className="text-[15px] font-semibold text-[#ffb86b] flex items-center gap-2">
          <span className="material-symbols-outlined text-[19px]">cloud_download</span>
          <span>אחסון והורדות אופליין</span>
        </h2>

        <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
          <div className="flex flex-col">
            <span className="text-[14px] text-white">נפח תפוס במכשיר</span>
            <span className="text-[11px] text-[#9a9da6]">
              {books.length > 0
                ? `${storageFormatted} (${books.length} ספרים שמורים להאזנה במטוס)`
                : '0MB (אין ספרים שמורים כרגע)'}
            </span>
          </div>
          <button
            onClick={handleClearCache}
            className="px-3 py-1.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-[12px] transition-colors cursor-pointer"
          >
            פנה מקום
          </button>
        </div>

        <div className="flex items-center justify-between py-2">
          <div className="flex flex-col">
            <span className="text-[14px] text-white">איכות אודיו</span>
            <span className="text-[11px] text-[#9a9da6]">High Bitrate AAC (320kbps)</span>
          </div>
          <span className="text-[12px] text-[#ffb86b] bg-[#ffb86b]/10 px-2.5 py-1 rounded-lg">
            גבוהה
          </span>
        </div>
      </section>

      {/* App Info */}
      <div className="text-center py-4 flex flex-col items-center gap-1.5 text-white/35 text-[12px]">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white/60">אודיולוק AudioLook</span>
          <span>גרסה 2.4.0</span>
        </div>
        <span>פותח בהשראת Apple Books לחובבי ספרות והסכתים עמוקים</span>
      </div>
    </main>
  );
}
