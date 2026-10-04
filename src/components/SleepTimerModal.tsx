import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useAudio } from '../context/AudioContext';
import { easeApple, springFast, springGentle, staggerDelay, tx, useAppReducedMotion } from './motion';

const MAX_CUSTOM_MINUTES = 480;

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
  const [customMinutes, setCustomMinutes] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);
  const [isCustomOpen, setIsCustomOpen] = useState(false);

  const applyCustomMinutes = () => {
    const parsed = Math.floor(Number(customMinutes));
    if (!customMinutes.trim() || isNaN(parsed) || parsed < 1) {
      setCustomError('הכניסו מספר דקות חוקי (1 ומעלה)');
      return;
    }
    if (parsed > MAX_CUSTOM_MINUTES) {
      setCustomError(`עד ${MAX_CUSTOM_MINUTES} דקות (8 שעות)`);
      return;
    }
    setCustomError(null);
    setSleepTimer(parsed);
    setIsSleepTimerModalOpen(false);
    setCustomMinutes('');
  };

  const isCustomSelected =
    sleepTimerMinutes !== null && !presets.some((p) => p.minutes === sleepTimerMinutes);

  // If a custom timer is already active, expand its editor on open so the
  // value is visible and editable instead of hidden behind the toggle.
  useEffect(() => {
    if (isSleepTimerModalOpen && isCustomSelected) {
      setIsCustomOpen(true);
    }
  }, [isSleepTimerModalOpen, isCustomSelected]);

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
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 6 }}
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
                    className={`flex items-center justify-between p-3 rounded-xl border text-[14px] font-medium transition-all cursor-pointer ${isSelected
                        ? 'bg-[#ffb86b] text-[#2c1700] border-[#ffb86b] font-semibold shadow-[0_8px_24px_-8px_rgb(255_184_107/0.5)]'
                        : 'bg-white/[0.04] hover:bg-[#ffb86b]/10 hover:border-[#ffb86b]/25 text-white/90 border-white/[0.04]'
                      }`}
                  >
                    <span>{preset.label}</span>
                    {isSelected && <span className="material-symbols-outlined text-[18px]">check</span>}
                  </motion.button>
                );
              })}

          <motion.button
            key="custom-toggle"
            initial={{ opacity: 0, y: reduced ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={tx(reduced, { ...springGentle, delay: staggerDelay(presets.length, 0.04, 0.2) })}
            whileTap={reduced ? undefined : { scale: 0.98 }}
            onClick={() => setIsCustomOpen((v) => !v)}
            aria-expanded={isCustomOpen}
            className={`flex items-center justify-between p-3 rounded-xl border text-[14px] font-medium transition-all cursor-pointer ${isCustomSelected
                ? 'bg-[#ffb86b]/[0.07] border-[#ffb86b]/40 text-white/90'
                : 'bg-white/[0.04] hover:bg-[#ffb86b]/10 hover:border-[#ffb86b]/25 text-white/90 border-white/[0.04]'
              }`}
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className={`material-symbols-outlined text-[18px] flex-shrink-0 ${isCustomSelected ? 'text-[#ffb86b]' : 'text-white/40'}`}>
                schedule
              </span>
              <span className="truncate">
                {isCustomSelected && sleepTimerMinutes
                  ? `${sleepTimerMinutes} דקות (מותאם אישית)`
                  : 'מותאם אישית…'}
              </span>
            </span>
            <span className="flex items-center gap-1 flex-shrink-0">
              {isCustomSelected && (
                <span className="material-symbols-outlined text-[18px] text-[#ffb86b]">check</span>
              )}
              <motion.span
                animate={{ rotate: isCustomOpen ? 180 : 0 }}
                transition={tx(reduced, springFast)}
                className="material-symbols-outlined text-[20px] text-white/50 flex"
              >
                expand_more
              </motion.span>
            </span>
          </motion.button>

          <AnimatePresence initial={false}>
            {isCustomOpen && (
              <motion.div
                key="custom-expand"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={tx(reduced, { type: 'tween', duration: 0.22, ease: easeApple })}
                className="overflow-hidden"
              >
                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex items-center gap-2 p-2.5 rounded-xl border border-white/[0.04] bg-white/[0.04] focus-within:border-[#ffb86b]/40 text-[14px] transition-colors">
                    <input
                      value={customMinutes}
                      autoFocus={!reduced}
                      onChange={(e) => {
                        setCustomMinutes(e.target.value.replace(/[^0-9]/g, '').slice(0, 3));
                        setCustomError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') applyCustomMinutes();
                      }}
                      inputMode="numeric"
                      type="number"
                      min={1}
                      max={MAX_CUSTOM_MINUTES}
                      placeholder="כמה דקות?"
                      aria-label="זמן מותאם אישית בדקות"
                      className="flex-1 min-w-[3rem] bg-transparent outline-none font-mono text-white/90 text-start placeholder:text-white/30 placeholder:font-sans placeholder:text-[13px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      onClick={applyCustomMinutes}
                      className="px-3.5 py-1.5 rounded-lg text-[13px] font-medium bg-white/[0.08] text-white/85 hover:bg-[#ffb86b]/15 hover:text-[#ffb86b] active:scale-95 transition-all cursor-pointer flex-shrink-0"
                    >
                      הגדר
                    </button>
                  </div>
                  {customError && (
                    <p className="text-[12px] text-red-400 text-center">{customError}</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

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
