import type { ComponentType } from 'react';
import { AppProvider, useApp, type Tab } from './app/store';
import HomePage from './pages/HomePage';
import GamePage from './pages/GamePage';
import AIPage from './pages/AIPage';
import MeetingPage from './pages/MeetingPage';
import ChartsPage from './pages/ChartsPage';
import ReviewPage from './pages/ReviewPage';
import ShortsPage from './pages/ShortsPage';
import SettingsPage from './pages/SettingsPage';
import {
  Bot, ChartLine, Clapperboard, ClipboardList, Dices, Home, Settings as SettingsIcon, Users,
} from 'lucide-react';

const TABS: { id: Tab; label: string; icon: ComponentType<{ size?: number | string; className?: string }> }[] = [
  { id: 'home', label: 'HOME', icon: Home },
  { id: 'game', label: 'GAME', icon: Dices },
  { id: 'ai', label: 'AI', icon: Bot },
  { id: 'meeting', label: 'MEETING', icon: Users },
  { id: 'charts', label: 'CHARTS', icon: ChartLine },
  { id: 'review', label: 'REVIEW', icon: ClipboardList },
  { id: 'shorts', label: 'SHORTS', icon: Clapperboard },
  { id: 'settings', label: 'SETTINGS', icon: SettingsIcon },
];

const PAGES: Record<Tab, ComponentType> = {
  home: HomePage,
  game: GamePage,
  ai: AIPage,
  meeting: MeetingPage,
  charts: ChartsPage,
  review: ReviewPage,
  shorts: ShortsPage,
  settings: SettingsPage,
};

function Shell() {
  const { ready, tab, setTab, toast, project, session } = useApp();

  if (!ready) {
    return (
      <div className="app-shell flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#f0c04a]/20 border-t-[#f0c04a]" />
          <p className="mt-3 text-xs font-bold text-slate-500">데이터를 불러오는 중…</p>
        </div>
      </div>
    );
  }

  const Page = PAGES[tab];

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#070a11]/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[480px] items-center justify-between">
          <button onClick={() => setTab('home')} className="flex items-center gap-2.5 text-left active:opacity-70">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-b from-[#ffd97a] to-[#d99a2b] text-[#241a05] shadow-[0_2px_10px_rgba(240,192,74,0.4)]">
              <Dices size={17} />
            </span>
            <span>
              <span className="block text-[13px] font-black leading-tight text-slate-100">카지노 생존일지</span>
              <span className="block text-[9px] font-bold tracking-[0.2em] text-[#f0c04a]/60">
                {project ? project.name.toUpperCase() : 'LOCAL · INDEXEDDB'}
              </span>
            </span>
          </button>
          {session && (
            <span className={`h-2 w-2 rounded-full ${session.status === 'PLAYING' ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : session.status === 'PAUSED' ? 'bg-amber-400' : 'bg-slate-600'}`} aria-label={session.status} />
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-[480px] px-3.5 pb-32 pt-4" key={tab}>
        <Page />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.07] bg-[#070a11]/95 backdrop-blur pb-safe">
        <div className="mx-auto flex max-w-[480px] gap-1 overflow-x-auto px-2 py-2 no-scrollbar">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex min-w-[62px] flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[8.5px] font-black tracking-wider transition active:scale-95 ${
                  active ? 'bg-[#f0c04a]/15 text-[#ffd97a]' : 'text-slate-500'
                }`}
              >
                <Icon size={19} />
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>

      {toast && (
        <div key={toast.id} className="toast" role="status">
          {toast.msg}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
