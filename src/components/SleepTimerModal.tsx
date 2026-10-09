import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useAudio } from '../context/AudioContext';
import { easeApple, springFast, springGentle, staggerDelay, tx, useAppReducedMotion } from './motion';

const MAX_CUSTOM_MINUTES = 480;
const CUSTOM_DEFAULT_MINUTES = 10;

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
  const [customDraft, setCustomDraft] = useState(CUSTOM_DEFAULT_MINUTES);
  const [isCustomOpen, setIsCustomOpen] = useState(false);

  const stepCustom = (delta: number) => {
    setCustomDraft((prev) => Math.min(MAX_CUSTOM_MINUTES, Math.max(1, prev + delta)));
    try {
      navigator.vibrate?.(8);
    } catch {}
  };

  // Press-and-hold to repeat: first step fires on pointer-down, then fast
  // repeat after a short pause. Keyboard users get single steps via onClick
  // (detail === 0), so pointer clicks must not double-step.
  const repeatRef = useRef<{
    timeout: ReturnType<typeof setTimeout> | null;
    interval: ReturnType<typeof setInterval> | null;
  }>({ timeout: null, interval: null });

  const stopRepeat = () => {
    if (repeatRef.current.timeout) clearTimeout(repeatRef.current.timeout);
    if (repeatRef.current.interval) clearInterval(repeatRef.current.interval);
    repeatRef.current.timeout = null;
    repeatRef.current.interval = null;
  };

  const startRepeat = (delta: number) => {
    stopRepeat();
    repeatRef.current.timeout = setTimeout(() => {
      repeatRef.current.interval = setInterval(() => stepCustom(delta), 70);
    }, 450);
  };

  // Cleanup repeat timers on unmount (avoids setState after unmount)
  useEffect(() => stopRepeat, []);

  const applyCustomMinutes = () => {
    stopRepeat();
    setSleepTimer(customDraft);
    setIsSleepTimerModalOpen(false);
  };

  const isCustomSelected =
    sleepTimerMinutes !== null && !presets.some((p) => p.minutes === sleepTimerMinutes);

  // On open: seed the stepper from the active custom timer (or the default),
  // and expand its editor if a custom timer is already active.
  useEffect(() => {
    if (isSleepTimerModalOpen) {
      setCustomDraft(
        isCustomSelected && sleepTimerMinutes ? sleepTimerMinutes : CUSTOM_DEFAULT_MINUTES,
      );
      if (isCustomSelected) {
        setIsCustomOpen(true);
      }
    }
  }, [isSleepTimerModalOpen, isCustomSelected, sleepTimerMinutes]);

  // Human hint for long durations (e.g. 90 → "שעה וחצי", 125 → "שעתיים ו־5 דקות")
  const customHint =
    customDraft >= 60
      ? `(${Math.floor(customDraft / 60)} שע׳${customDraft % 60 > 0 ? ` ו־${customDraft % 60} דק׳` : ''})`
      : null;

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
                <div className="flex flex-col gap-2.5 pt-1">
                  {/* Stepper: −1 / value / +1 — tap for single minutes,
                      press-and-hold for fast repeat. Clamped 1–480. */}
                  <div
                    className="flex items-center justify-between p-3 rounded-xl border border-white/[0.04] bg-white/[0.04] text-[14px]"
                    dir="rtl"
                  >
                    <motion.button
                      whileTap={reduced ? undefined : { scale: 0.88 }}
                      onPointerDown={() => {
                        stepCustom(-1);
                        startRepeat(-1);
                      }}
                      onPointerUp={stopRepeat}
                      onPointerLeave={stopRepeat}
                      onPointerCancel={stopRepeat}
                      onClick={(e) => {
                        if (e.detail === 0) stepCustom(-1);
                      }}
                      disabled={customDraft <= 1}
                      aria-label="הפחת דקה"
                      className="w-11 h-11 rounded-full bg-white/[0.07] hover:bg-[#ffb86b]/20 text-white/85 hover:text-[#ffb86b] active:bg-[#ffb86b]/25 flex items-center justify-center transition-colors cursor-pointer select-none touch-none disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <span className="material-symbols-outlined text-[22px]">remove</span>
                    </motion.button>

                    <div className="flex flex-col items-center min-w-[5rem]">
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                          key={customDraft}
                          initial={reduced ? false : { scale: 0.8, opacity: 0.4 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={tx(reduced, springFast)}
                          className="text-[32px] leading-none font-bold font-mono tabular-nums text-white"
                          aria-live="polite"
                          aria-label={`${customDraft} דקות`}
                        >
                          {customDraft}
                        </motion.span>
                      </AnimatePresence>
                      <span className="text-[12px] text-white/50 mt-1">
                        דקות{customHint ? ` ${customHint}` : ''}
                      </span>
                    </div>

                    <motion.button
                      whileTap={reduced ? undefined : { scale: 0.88 }}
                      onPointerDown={() => {
                        stepCustom(1);
                        startRepeat(1);
                      }}
                      onPointerUp={stopRepeat}
                      onPointerLeave={stopRepeat}
                      onPointerCancel={stopRepeat}
                      onClick={(e) => {
                        if (e.detail === 0) stepCustom(1);
                      }}
                      disabled={customDraft >= MAX_CUSTOM_MINUTES}
                      aria-label="הוסף דקה"
                      className="w-11 h-11 rounded-full bg-white/[0.07] hover:bg-[#ffb86b]/20 text-white/85 hover:text-[#ffb86b] active:bg-[#ffb86b]/25 flex items-center justify-center transition-colors cursor-pointer select-none touch-none disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <span className="material-symbols-outlined text-[22px]">add</span>
                    </motion.button>
                  </div>
                  <button
                    onClick={applyCustomMinutes}
                    className="w-full py-2.5 rounded-xl text-[14px] font-semibold bg-[#ffb86b] hover:bg-[#ffc685] text-[#2c1700] active:scale-[0.98] transition-all cursor-pointer shadow-[0_8px_24px_-8px_rgb(255_184_107/0.5)]"
                  >
                    הגדר טיימר ל־{customDraft} דקות
                  </button>
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
