import React from 'react';
import { useAudio } from '../context/AudioContext';

export default function Header() {
  const { setIsSearchModalOpen, setIsAccountModalOpen } = useAudio();

  return (
    <header className="sticky top-0 z-40 bg-[#121316]/90 backdrop-blur-xl border-b border-white/[0.04]">
      <div className="pt-safe" />
      <div className="h-14 px-5 flex items-center justify-between max-w-xl mx-auto">
        <div className="flex items-center gap-2.5">
          <img
            alt="AudioLook"
            className="h-6 w-auto object-contain opacity-95"
            src="https://lh3.googleusercontent.com/aida/AEtjO1WF04JPjabB9vbETTT6bJ5EOI4B36YGJdR0qMqoh5Zmd1_x58yLaQNsrB6HD0cQcCsecpp0XhNwx01y9NjhO6x0UelCXPUCD7J2NuIYhBQUFNLpE_m_-t8_YiNUMSGdfRmdbYIRBIdxGcilGCeJkvBiK9tuDOuD26562Nq5CBFqnTpcWXPkSHAawSpZ9w9vuBqcjxwSxt7Or50lWB0-QfA-nyueCVk-RzmWXp2zO_ia0y2g5vSSBIHIeKty"
          />
          <span className="text-[17px] font-semibold tracking-tight text-white/90">אודיולוק</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSearchModalOpen(true)}
            aria-label="חיפוש"
            className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.1] active:scale-95 text-white/80 flex items-center justify-center transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">search</span>
          </button>
          <button
            onClick={() => setIsAccountModalOpen(true)}
            aria-label="חשבון והגדרות"
            className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.1] active:scale-95 text-white/80 flex items-center justify-center transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">account_circle</span>
          </button>
        </div>
      </div>
    </header>
  );
}
