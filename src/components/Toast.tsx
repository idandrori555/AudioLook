import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useAudio } from '../context/AudioContext';
import { springSnappy, tx, useAppReducedMotion } from './motion';

export default function Toast() {
  const { toastMessage } = useAudio();
  const reduced = useAppReducedMotion();

  return (
    <div className="fixed top-[calc(4.5rem+env(safe-area-inset-top,0px))] inset-x-0 z-50 flex justify-center pointer-events-none px-4">
      {/* popLayout: the exiting toast leaves document flow instantly so the
          incoming one never sits beside it / jumps to center mid-spam */}
      <AnimatePresence mode="popLayout">
        {toastMessage && (
          <motion.div
            key={toastMessage}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
            transition={tx(reduced, springSnappy)}
            className="glass relative overflow-hidden text-white !border-[#ffb86b]/30 rounded-2xl px-4 py-2 text-[13px] font-medium flex items-center gap-2 shadow-[0_8px_32px_rgba(255,184,107,0.2)]"
          >
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inline-flex w-full h-full rounded-full bg-[#ffb86b] opacity-60 animate-ping motion-reduce:animate-none" />
              <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-[#ffb86b]" />
            </span>
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
