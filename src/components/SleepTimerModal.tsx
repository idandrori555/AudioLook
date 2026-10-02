import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useAudio } from '../context/AudioContext';
import { springFast, springGentle, staggerDelay, tx, useAppReducedMotion } from './motion';

export default function SleepTimerModal() {
  const {
    isSleepTimerModalOpen,
    setIsSleepTimerModalOpen,
    sleepTimerMinutes,
    sleepTimerSecondsRemaining,
    setSleepTimer,
  } = useAudio();
  const reduced = useAppReducedMotion();

  const presets = [
    { label: '15 דקות', minutes: 15 },
    { label: '25 דקות', minutes: 25 },
    { label: '45 דקות', minutes: 45 },
    { label: '60 דקות (שעה)', minutes: 60 },
  ];

  return (
    <AnimatePresence>
      {isSleepTimerModalOpen && (
      <motion.div
        key="sleep-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={tx(reduced, springFast)}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
        onClick={() => setIsSleepTimerModalOpen(false)}
      >
      <motion.div
        key="sleep-panel"
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 10 }}
        transition={tx(reduced, springFast)}
        className="glass relative overflow-hidden w-full max-w-sm max-h-[90dvh] overflow-y-auto rounded-2xl p-5 flex flex-col gap-4 text-right"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="glass-glint" />
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
          {presets.map((preset, i) => {
            const isSelected = sleepTimerMinutes === preset.minutes;

            return (
              <motion.button
                key={preset.label}
                initial={{ opacity: 0, y: reduced ? 0 : 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={tx(reduced, { ...springGentle, delay: staggerDelay(i, 0.04, 0.2) })}
                whileTap={reduced ? undefined : { scale: 0.98 }}
                onClick={() => {
                  setSleepTimer(preset.minutes);
                  setIsSleepTimerModalOpen(false);
                }}
                className={`flex items-center justify-between p-3 rounded-xl border text-[14px] font-medium transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#ffb86b] text-[#2c1700] border-[#ffb86b] font-semibold shadow-[0_8px_24px_-8px_rgb(255_184_107/0.5)]'
                    : 'bg-white/[0.04] hover:bg-[#ffb86b]/10 hover:border-[#ffb86b]/25 text-white/90 border-white/[0.04]'
                }`}
              >
                <span>{preset.label}</span>
                {isSelected && <span className="material-symbols-outlined text-[18px]">check</span>}
              </motion.button>
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
      </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );
}
