import { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { locale, useI18n } from '../../../src/i18n';
import type { Session } from '../../../src/types';

interface ListResponse {
  success: boolean;
  sessions?: Session[];
  error?: string;
}

export default function SessionsView() {
  const { t } = useI18n();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = (await browser.runtime.sendMessage({ type: 'LIST_SESSIONS' })) as ListResponse;
    if (res.success) setSessions(res.sessions ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const flash = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(''), 2000);
  };

  const collapse = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = (await browser.runtime.sendMessage({ type: 'COLLAPSE_TABS' })) as {
        success: boolean;
        closedCount?: number;
        error?: string;
      };
      if (res.success) {
        const n = res.closedCount ?? 0;
        flash(t('sessions.collapsed', { n }, n));
        void refresh();
      } else {
        flash(res.error ?? t('sessions.collapseFailed'));
      }
    } finally {
      setBusy(false);
    }
  };

  const restore = async (id: string) => {
    const res = (await browser.runtime.sendMessage({
      type: 'RESTORE_SESSION',
      sessionId: id,
    })) as { success: boolean; opened?: number; error?: string };
    if (res.success) {
      const n = res.opened ?? 0;
      flash(t('sessions.restored', { n }, n));
    } else {
      flash(res.error ?? t('sessions.restoreFailed'));
    }
  };

  const remove = async (id: string) => {
    await browser.runtime.sendMessage({ type: 'DELETE_SESSION', sessionId: id });
    void refresh();
  };

  const commitRename = async () => {
    if (editingId) {
      await browser.runtime.sendMessage({
        type: 'RENAME_SESSION',
        sessionId: editingId,
        name: editName,
      });
    }
    setEditingId(null);
    void refresh();
  };

  // 单独打开会话中的某个标签（新标签页激活）
  const openTab = async (url: string) => {
    if (!url || !/^https?:/.test(url)) return;
    await browser.tabs.create({ url, active: true });
  };

  const hostOf = (url: string): string => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  };

  return (
    <div className="sessions-view">
      <button type="button" className="btn-primary" onClick={collapse} disabled={busy}>
        {busy ? t('sessions.collapsing') : t('sessions.collapseAll')}
      </button>

      {toast && <p className="toast">{toast}</p>}

      {sessions.length === 0 ? (
        <p className="empty">{t('sessions.empty')}</p>
      ) : (
        <ul className="session-list">
          {sessions.map((s) => (
            <li key={s.id} className="session-card">
              {editingId === s.id ? (
                <div className="session-edit">
                  <input
                    className="name-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void commitRename();
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    autoFocus
                  />
                  <button type="button" className="btn-mini" onClick={commitRename}>
                    {t('sessions.save')}
                  </button>
                </div>
              ) : (
                <div
                  className="session-head"
                  onDoubleClick={() => {
                    setEditingId(s.id);
                    setEditName(s.name);
                  }}
                  title={t('sessions.renameHint')}
                >
                  <span className="session-name">{s.name}</span>
                  <span className="session-count">
                    {t('sessions.tabCount', { n: s.tabCount }, s.tabCount)}
                  </span>
                  <button
                    type="button"
                    className="st-expand"
                    title={
                      expandedId === s.id ? t('sessions.collapseList') : t('sessions.expand')
                    }
                    onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                  >
                    {expandedId === s.id ? '▾' : '▸'}
                  </button>
                </div>
              )}
              <div className="session-meta">
                {new Date(s.createdAt).toLocaleString(locale(), {
                  month: 'numeric',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
              {expandedId === s.id && s.tabs.length > 0 && (
                <ul className="st-tabs">
                  {s.tabs.map((tab, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        className="st-tab"
                        title={tab.url}
                        onClick={() => void openTab(tab.url)}
                      >
                        <span className="st-tab-fav">
                          {(hostOf(tab.url) || '?').slice(0, 1).toUpperCase()}
                        </span>
                        <span className="st-tab-title">{tab.title || tab.url}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="session-actions">
                <button type="button" className="btn-mini" onClick={() => void restore(s.id)}>
                  {t('sessions.restore')}
                </button>
                <button
                  type="button"
                  className="btn-mini btn-danger"
                  onClick={() => void remove(s.id)}
                >
                  {t('sessions.delete')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
