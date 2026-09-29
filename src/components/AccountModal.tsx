import React from 'react';
import { useAudio } from '../context/AudioContext';

export default function AccountModal() {
  const { isAccountModalOpen, setIsAccountModalOpen, books } = useAudio();

  if (!isAccountModalOpen) return null;

  const totalHours = Math.round(
    books.reduce((acc, b) => acc + (b.currentTimeSeconds / 3600), 0) * 10
  ) / 10;
  const completedCount = books.filter((b) => b.category === 'completed').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div
        className="glass relative overflow-hidden w-full max-w-sm max-h-[90dvh] overflow-y-auto rounded-2xl p-5 flex flex-col gap-4 text-right"
        dir="rtl"
      >
        <div className="glass-glint" />
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ffb86b] text-[22px]">account_circle</span>
            <h3 className="text-[17px] font-semibold text-white">החשבון שלי</h3>
          </div>
          <button
            onClick={() => setIsAccountModalOpen(false)}
            className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-white/70 flex items-center justify-center cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* User Card */}
        <div className="flex items-center gap-3 bg-white/[0.03] p-3 rounded-xl border border-white/[0.04]">
          <div className="w-12 h-12 rounded-full bg-[#ffb86b] text-[#2c1700] flex items-center justify-center font-bold text-[18px]">
            מ
          </div>
          <div className="flex flex-col">
            <span className="text-[15px] font-semibold text-white">משתמש אודיולוק</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-white/[0.02] p-3 rounded-xl border border-white/[0.04]">
            <span className="text-[20px] font-bold text-white block">{totalHours}</span>
            <span className="text-[11px] text-[#9a9da6]">שעות האזנה</span>
          </div>
          <div className="bg-white/[0.02] p-3 rounded-xl border border-white/[0.04]">
            <span className="text-[20px] font-bold text-[#ffb86b] block">{completedCount}</span>
            <span className="text-[11px] text-[#9a9da6]">ספרים שהושלמו</span>
          </div>
        </div>

        <button
          onClick={() => setIsAccountModalOpen(false)}
          className="w-full py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-white text-[13px] font-medium transition-colors cursor-pointer mt-1"
        >
          סגור
        </button>
      </div>
    </div>
  );
}
