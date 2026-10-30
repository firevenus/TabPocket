import { useState } from 'react';
import { useI18n, type MsgKey } from '../../src/i18n';
import SessionsView from './components/SessionsView';
import BookmarksView from './components/BookmarksView';
import StatsView from './components/StatsView';
import AboutView from './components/AboutView';

type TabKey = 'sessions' | 'bookmarks' | 'stats' | 'about';

const TABS: { key: TabKey; labelKey: MsgKey }[] = [
  { key: 'sessions', labelKey: 'tab.sessions' },
  { key: 'bookmarks', labelKey: 'tab.bookmarks' },
  { key: 'stats', labelKey: 'tab.stats' },
  { key: 'about', labelKey: 'tab.about' },
];

function App() {
  const [tab, setTab] = useState<TabKey>('sessions');
  const { t } = useI18n();

  return (
    <div className="app">
      <nav className="tabs">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={tab === item.key ? 'tab active' : 'tab'}
            onClick={() => setTab(item.key)}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </nav>
      <main className="content">
        {tab === 'sessions' && <SessionsView />}
        {tab === 'bookmarks' && <BookmarksView />}
        {tab === 'stats' && <StatsView />}
        {tab === 'about' && <AboutView />}
      </main>
    </div>
  );
}

export default App;
