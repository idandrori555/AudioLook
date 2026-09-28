import React from 'react';
import { AudioProvider, useAudio } from './context/AudioContext';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import MiniPlayer from './components/MiniPlayer';
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

  return (
    <div className="min-h-screen bg-[#121316] text-[#edeef2] flex flex-col font-sans select-none" dir="rtl">
      {/* Show header for library, bookmarks, settings tabs */}
      {activeTab !== 'player' && <Header />}

      {/* Main Tab Screen */}
      {activeTab === 'library' && <LibraryView />}
      {activeTab === 'player' && <PlayerView />}
      {activeTab === 'bookmarks' && <BookmarksView />}
      {activeTab === 'settings' && <SettingsView />}

      {/* Mini Player docked above navigation */}
      <MiniPlayer />

      {/* Bottom Navigation */}
      <BottomNav />

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
