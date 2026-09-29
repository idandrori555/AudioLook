import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useAudio } from '../context/AudioContext';
import { springSnappy, tx, useAppReducedMotion } from './motion';
import { TabType } from '../types';

export default function BottomNav() {
  const { activeTab, setActiveTab, bookmarks, isPlaying } = useAudio();
  const reduced = useAppReducedMotion();

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'library', label: 'ספרייה', icon: 'auto_stories' },
    { id: 'player', label: 'נגן', icon: 'headphones' },
    { id: 'bookmarks', label: 'סימניות', icon: 'bookmark' },
    { id: 'settings', label: 'הגדרות', icon: 'tune' },
  ];

  const handleSelect = (tab: TabType) => {
    if (tab === activeTab) return;
    // Light haptic tick on Android when switching tabs
    try {
      navigator.vibrate?.(8);
    } catch {}
    setActiveTab(tab);
  };

  return (
    <nav className="fixed inset-x-0 bottom-[calc(0.75rem+var(--sab,env(safe-area-inset-bottom,0px)))] z-50 flex justify-center px-4 pointer-events-none">
      {/* Floating liquid-glass pill */}
      <div className="glass pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-[26px]">
        {/* Specular top light + soft sheen */}
        <div className="glass-glint" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.07] to-transparent" />
      <div className="relative flex justify-around items-center h-12 px-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const showBadge = tab.id === 'bookmarks' && bookmarks.length > 0;
          const showPlayingDot = tab.id === 'player' && isPlaying;
          return (
            <motion.button
              key={tab.id}
              onClick={() => handleSelect(tab.id)}
              whileTap={reduced ? undefined : { scale: 0.88 }}
              aria-current={isActive ? 'page' : undefined}
              aria-label={tab.label}
              className={`relative flex flex-col items-center justify-center gap-0.5 w-14 py-0.5 cursor-pointer ${
                isActive ? 'text-[#ffb86b]' : 'text-white/45 hover:text-white'
              }`}
            >
              <span className="relative flex items-center justify-center w-11 h-7">
                {isActive && (
                  <motion.span
                    layoutId="nav-active-pill"
                    transition={tx(reduced, springSnappy)}
                    className="absolute inset-0 rounded-full bg-[#ffb86b]/15 ring-1 ring-[#ffb86b]/20"
                  />
                )}
                <motion.span
                  animate={reduced ? undefined : { scale: isActive ? 1.1 : 1 }}
                  transition={tx(reduced, springSnappy)}
                  className="material-symbols-outlined text-[22px] relative"
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {tab.icon}
                </motion.span>
                {/* Saved-bookmarks count */}
                <AnimatePresence>
                  {showBadge && (
                    <motion.span
                      key={bookmarks.length}
                      initial={reduced ? false : { scale: 0.4, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.4, opacity: 0 }}
                      transition={tx(reduced, springSnappy)}
                      className="absolute -top-1 -left-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ffb86b] text-[#2c1700] text-[10px] font-bold flex items-center justify-center shadow-md shadow-black/40"
                    >
                      {bookmarks.length > 99 ? '99+' : bookmarks.length}
                    </motion.span>
                  )}
                </AnimatePresence>
                {/* Now-playing indicator */}
                {showPlayingDot && !isActive && (
                  <span className="absolute top-0 right-2 w-1.5 h-1.5 rounded-full bg-[#ffb86b] animate-pulse" />
                )}
              </span>

            </motion.button>
          );
        })}
      </div>
      </div>
    </nav>
  );
}
