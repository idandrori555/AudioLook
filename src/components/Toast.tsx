import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useAudio } from '../context/AudioContext';
import { springSnappy, tx, useAppReducedMotion } from './motion';

export default function Toast() {
  const { toastMessage } = useAudio();
  const reduced = useAppReducedMotion();

  return (
    <div className="fixed top-18 inset-x-0 z-50 flex justify-center pointer-events-none px-4">
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            key={toastMessage}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -18, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.96 }}
            transition={tx(reduced, springSnappy)}
            className="glass relative overflow-hidden text-white !border-[#ffb86b]/30 rounded-2xl px-4 py-2 text-[13px] font-medium flex items-center gap-2"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#ffb86b]" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
