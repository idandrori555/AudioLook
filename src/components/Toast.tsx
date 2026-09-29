import React from 'react';
import { useAudio } from '../context/AudioContext';

export default function Toast() {
  const { toastMessage } = useAudio();

  if (!toastMessage) return null;

  return (
    <div className="fixed top-18 inset-x-0 z-50 flex justify-center pointer-events-none px-4">
      <div className="glass relative overflow-hidden text-white !border-[#ffb86b]/30 rounded-2xl px-4 py-2 text-[13px] font-medium flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[#ffb86b]" />
        <span>{toastMessage}</span>
      </div>
    </div>
  );
}
