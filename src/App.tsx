import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AudioProvider, useAudio } from './context/AudioContext';
import { durFast, easeApple, tx, useAppReducedMotion } from './components/motion';
import Header from './components/Header';
import DockIsland from './components/DockIsland';
import LibraryView from './components/LibraryView';
import PlayerView from './components/PlayerView';
import BookmarksView from './components/BookmarksView';
import SettingsView from './components/SettingsView';
import ChaptersDrawer from './components/ChaptersDrawer';
import SleepTimerModal from './components/SleepTimerModal';
import SearchModal from './components/SearchModal';
import AccountModal from './components/AccountModal';
import Toast from './components/Toast';
import YouTubeHost from './components/YouTubeHost';

function AppContent() {
  const { activeTab } = useAudio();
  const reduced = useAppReducedMotion();

  return (
    <div className="min-h-dvh bg-[#121316] text-[#edeef2] flex flex-col font-sans select-none isolate" dir="rtl">
      {/* Ambient aurora backdrop — pure decoration */}
      <div className="ambient-stage" aria-hidden="true">
        <div className="ambient-orb ambient-orb-a" />
        <div className="ambient-orb ambient-orb-b" />
        <div className="ambient-grain" />
      </div>

      {/* Show header for library, bookmarks, settings tabs */}
      {activeTab !== 'player' && <Header />}

      {/* Main Tab Screen — crossfade + subtle rise */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: reduced ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduced ? 0 : -6 }}
          transition={tx(reduced, { type: 'tween', duration: durFast, ease: easeApple })}
          className="flex-1 flex flex-col min-w-0 relative z-10"
        >
          {activeTab === 'library' && <LibraryView />}
          {activeTab === 'player' && <PlayerView />}
          {activeTab === 'bookmarks' && <BookmarksView />}
          {activeTab === 'settings' && <SettingsView />}
        </motion.div>
      </AnimatePresence>

      {/* United floating island: mini-player + bottom nav */}
      <DockIsland />

      {/* Global Modals & Drawers */}
      <ChaptersDrawer />
      <SleepTimerModal />
      <SearchModal />
      <AccountModal />
      <Toast />

      {/* Persistent YouTube Player Host */}
      <YouTubeHost />
    </div>
  );
}

export default function App() {
  return (
    <AudioProvider>
      <AppContent />
    </AudioProvider>
  );
}
