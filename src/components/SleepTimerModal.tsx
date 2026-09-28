import React from 'react';
import { useAudio } from '../context/AudioContext';

export default function SleepTimerModal() {
  const {
    isSleepTimerModalOpen,
    setIsSleepTimerModalOpen,
    sleepTimerMinutes,
    sleepTimerSecondsRemaining,
    setSleepTimer,
  } = useAudio();

  if (!isSleepTimerModalOpen) return null;

  const presets = [
    { label: '15 דקות', minutes: 15 },
    { label: '25 דקות', minutes: 25 },
    { label: '45 דקות', minutes: 45 },
    { label: '60 דקות (שעה)', minutes: 60 },
    { label: 'בסיום הפרק הנוכחי', minutes: 35 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div
        className="w-full max-w-sm bg-[#1e1f24] rounded-2xl border border-white/[0.08] p-5 shadow-2xl flex flex-col gap-4 text-right"
        dir="rtl"
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ffb86b] text-[22px]">bedtime</span>
            <h3 className="text-[17px] font-semibold text-white">טיימר שינה מתוזמן</h3>
          </div>
          <button
            onClick={() => setIsSleepTimerModalOpen(false)}
            className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-white/70 flex items-center justify-center cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {sleepTimerSecondsRemaining && (
          <div className="p-3 bg-[#ffb86b]/10 border border-[#ffb86b]/20 rounded-xl text-center">
            <p className="text-[12px] text-[#ffb86b]">טיימר פעיל כעת</p>
            <p className="text-[20px] font-bold text-white font-mono mt-0.5">
              נותרו {Math.ceil(sleepTimerSecondsRemaining / 60)} דקות
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {presets.map((preset) => {
            const isSelected = sleepTimerMinutes === preset.minutes;

            return (
              <button
                key={preset.label}
                onClick={() => {
                  setSleepTimer(preset.minutes);
                  setIsSleepTimerModalOpen(false);
                }}
                className={`flex items-center justify-between p-3 rounded-xl border text-[14px] font-medium transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#ffb86b] text-[#2c1700] border-[#ffb86b] font-semibold'
                    : 'bg-white/[0.04] hover:bg-white/[0.08] text-white/90 border-white/[0.04]'
                }`}
              >
                <span>{preset.label}</span>
                {isSelected && <span className="material-symbols-outlined text-[18px]">check</span>}
              </button>
            );
          })}

          <button
            onClick={() => {
              setSleepTimer(null);
              setIsSleepTimerModalOpen(false);
            }}
            className="flex items-center justify-center p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-red-500/10 text-white/60 hover:text-red-400 text-[13px] transition-colors cursor-pointer mt-1"
          >
            ביטול וכיבוי הטיימר
          </button>
        </div>
      </div>
    </div>
  );
}
