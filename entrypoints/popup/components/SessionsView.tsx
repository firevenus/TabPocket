import { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import type { Session } from '../../../src/types';

interface ListResponse {
  success: boolean;
  sessions?: Session[];
  error?: string;
}

export default function SessionsView() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

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
        flash(`已收拢 ${res.closedCount} 个标签`);
        void refresh();
      } else {
        flash(res.error ?? '收拢失败');
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
    if (res.success) flash(`已恢复 ${res.opened} 个标签`);
    else flash(res.error ?? '恢复失败');
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

  return (
    <div className="sessions-view">
      <button type="button" className="btn-primary" onClick={collapse} disabled={busy}>
        {busy ? '收拢中…' : '收拢全部标签'}
      </button>

      {toast && <p className="toast">{toast}</p>}

      {sessions.length === 0 ? (
        <p className="empty">还没有会话。点上方按钮把当前标签收拢成会话。</p>
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
                    保存
                  </button>
                </div>
              ) : (
                <div className="session-head" onDoubleClick={() => { setEditingId(s.id); setEditName(s.name); }} title="双击重命名">
                  <span className="session-name">{s.name}</span>
                  <span className="session-count">{s.tabCount} 标签</span>
                </div>
              )}
              <div className="session-meta">
                {new Date(s.createdAt).toLocaleString('zh-CN', {
                  month: 'numeric',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
              <div className="session-actions">
                <button type="button" className="btn-mini" onClick={() => void restore(s.id)}>
                  恢复
                </button>
                <button
                  type="button"
                  className="btn-mini btn-danger"
                  onClick={() => void remove(s.id)}
                >
                  删除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
