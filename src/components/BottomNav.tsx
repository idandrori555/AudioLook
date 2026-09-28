import React from 'react';
import { useAudio } from '../context/AudioContext';
import { TabType } from '../types';

export default function BottomNav() {
  const { activeTab, setActiveTab } = useAudio();

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'library', label: 'ספרייה', icon: 'local_library' },
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
              className={`flex flex-col items-center justify-center gap-1 w-14 transition-colors cursor-pointer ${
                isActive ? 'text-[#ffb86b]' : 'text-white/45 hover:text-white'
              }`}
            >
              <span
                className={`material-symbols-outlined text-[22px] transition-transform ${
                  isActive ? 'scale-110 font-bold' : ''
                }`}
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {tab.icon}
              </span>
              <span className="text-[11px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
