import React from 'react';
import { motion } from 'motion/react';
import { useAudio } from '../context/AudioContext';
import { springSnappy, tx, useAppReducedMotion } from './motion';
import { TabType } from '../types';

export default function BottomNav() {
  const { activeTab, setActiveTab } = useAudio();
  const reduced = useAppReducedMotion();

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'library', label: 'ספרייה', icon: 'auto_stories' },
    { id: 'player', label: 'נגן', icon: 'headphones' },
    { id: 'bookmarks', label: 'סימניות', icon: 'bookmark' },
    { id: 'settings', label: 'הגדרות', icon: 'tune' },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 pb-safe bg-[#121316]/95 backdrop-blur-xl border-t border-white/[0.05]">
      <div className="flex justify-around items-center h-16 max-w-xl mx-auto px-4">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-1 w-14 py-1 transition-colors cursor-pointer ${
                isActive ? 'text-[#ffb86b]' : 'text-white/45 hover:text-white'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="nav-active-pill"
                  transition={tx(reduced, springSnappy)}
                  className="absolute inset-0 rounded-xl bg-[#ffb86b]/10"
                />
              )}
              <motion.span
                animate={reduced ? undefined : { scale: isActive ? 1.12 : 1 }}
                transition={tx(reduced, springSnappy)}
                className="material-symbols-outlined text-[22px] relative"
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {tab.icon}
              </motion.span>
              <span className="text-[11px] font-medium relative">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
