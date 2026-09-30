import React from 'react';
import { motion } from 'motion/react';
import { useAudio } from '../context/AudioContext';
import { springGentle, tx, useAppReducedMotion } from './motion';

export default function Header() {
  const { setIsSearchModalOpen, setIsAccountModalOpen } = useAudio();
  const reduced = useAppReducedMotion();

  return (
    <header className="sticky top-[calc(0.5rem+env(safe-area-inset-top,0px))] z-40 px-4 pt-safe">
      <motion.div
        initial={{ opacity: 0, y: reduced ? 0 : -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={tx(reduced, springGentle)}
        className="glass relative overflow-hidden rounded-2xl h-14 px-4 flex items-center justify-between max-w-xl mx-auto"
      >
        <div className="glass-glint" />
        <div className="flex items-center gap-2.5">
          <span className="relative flex items-center justify-center w-7 h-7">
            <span className="absolute inset-0 rounded-full bg-[#ffb86b]/25 blur-md" aria-hidden="true" />
            <span className="absolute inset-0 rounded-full bg-[#ffb86b]/15 text-[#ffb86b] flex items-center justify-center" aria-hidden="true">
              <span className="material-symbols-outlined text-[18px]">auto_stories</span>
            </span>
            <img
              alt="AudioLook"
              className="relative h-6 w-auto object-contain opacity-95"
              src="https://lh3.googleusercontent.com/aida/AEtjO1WF04JPjabB9vbETTT6bJ5EOI4B36YGJdR0qMqoh5Zmd1_x58yLaQNsrB6HD0cQcCsecpp0XhNwx01y9NjhO6x0UelCXPUCD7J2NuIYhBQUFNLpE_m_-t8_YiNUMSGdfRmdbYIRBIdxGcilGCeJkvBiK9tuDOuD26562Nq5CBFqnTpcWXPkSHAawSpZ9w9vuBqcjxwSxt7Or50lWB0-QfA-nyueCVk-RzmWXp2zO_ia0y2g5vSSBIHIeKty"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </span>
          <span className="text-[17px] font-semibold tracking-tight text-white/90">אודיולוק</span>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={reduced ? undefined : { scale: 0.88 }}
            onClick={() => setIsSearchModalOpen(true)}
            aria-label="חיפוש"
            className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-[#ffb86b]/15 hover:text-[#ffb86b] active:scale-95 text-white/80 flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">search</span>
          </motion.button>
          <motion.button
            whileTap={reduced ? undefined : { scale: 0.88 }}
            onClick={() => setIsAccountModalOpen(true)}
            aria-label="חשבון והגדרות"
            className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-[#ffb86b]/15 hover:text-[#ffb86b] active:scale-95 text-white/80 flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">account_circle</span>
          </motion.button>
        </div>
      </motion.div>
    </header>
  );
}
