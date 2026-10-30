import { useState } from 'react';
import SessionsView from './components/SessionsView';
import BookmarksView from './components/BookmarksView';
import AboutView from './components/AboutView';

type TabKey = 'sessions' | 'bookmarks' | 'stats' | 'about';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'sessions', label: '收拢' },
  { key: 'bookmarks', label: '收藏' },
  { key: 'stats', label: '统计' },
  { key: 'about', label: '关于' },
];

function App() {
  const [tab, setTab] = useState<TabKey>('sessions');

  return (
    <div className="app">
      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={tab === t.key ? 'tab active' : 'tab'}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <main className="content">
        {tab === 'sessions' && <SessionsView />}
        {tab === 'bookmarks' && <BookmarksView />}
        {tab === 'stats' && <div className="placeholder">浏览统计 · M3</div>}
        {tab === 'about' && <AboutView />}
      </main>
    </div>
  );
}

export default App;
