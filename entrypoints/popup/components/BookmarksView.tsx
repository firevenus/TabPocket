import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { locale, useI18n } from '../../../src/i18n';
import { displayTag } from '../../../src/i18n/tags';
import type { BookmarkItem } from '../../../src/types';
import { countVisits } from '../../../src/utils/bookmarkAudit';
import {
  addBookmark,
  addToReadLater,
  collectTags,
  deleteBookmark,
  domainOf,
  exportBookmarksJson,
  importBookmarksJson,
  loadBookmarks,
  organizeBrowserBookmarks,
  searchBookmarks,
  TAG_READ_LATER,
  toggleReadLater,
  updateBookmarkTags,
} from '../../../src/utils/bookmarks';

type SortMode = 'added' | 'visits';

export default function BookmarksView() {
  const { t } = useI18n();
  const [items, setItems] = useState<BookmarkItem[]>([]);
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTags, setEditTags] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('added');
  /** url -> 近一年访问次数 */
  const [visits, setVisits] = useState<Record<string, number>>({});
  const [counting, setCounting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setItems(await loadBookmarks());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const flash = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(''), 2200);
  };

  const tags = useMemo(() => {
    const all = collectTags(items);
    // 「待看」置顶，方便无聊时快速点开
    return [TAG_READ_LATER, ...all.filter((x) => x !== TAG_READ_LATER)];
  }, [items]);

  const filtered = useMemo(
    () => searchBookmarks(items, query, activeTag),
    [items, query, activeTag],
  );

  // 「访问最多」模式下按需统计（近一年），结果缓存在内存，重复切换不再重算
  useEffect(() => {
    if (sortMode !== 'visits') return;
    const todo = filtered.filter((b) => visits[b.url] === undefined).slice(0, 400);
    if (todo.length === 0) return;
    let alive = true;
    setCounting(true);
    void (async () => {
      const got: Record<string, number> = {};
      for (let i = 0; i < todo.length; i += 10) {
        const batch = todo.slice(i, i + 10);
        const res = await Promise.all(
          batch.map((b) => countVisits(b.url, 365).catch(() => ({ visits: 0, lastVisit: 0 }))),
        );
        batch.forEach((b, k) => {
          got[b.url] = res[k]?.visits ?? 0;
        });
      }
      if (!alive) return;
      setVisits((prev) => ({ ...prev, ...got }));
      setCounting(false);
    })();
    return () => {
      alive = false;
    };
  }, [sortMode, filtered, visits]);

  const shown = useMemo(() => {
    const list = [...filtered];
    if (sortMode === 'added') return list.sort((a, b) => b.createdAt - a.createdAt);
    return list.sort((a, b) => {
      const av = visits[a.url] ?? -1;
      const bv = visits[b.url] ?? -1;
      return bv - av || b.createdAt - a.createdAt;
    });
  }, [filtered, sortMode, visits]);

  // 收藏当前活动标签页
  const bookmarkCurrentTab = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url || !/^https?:/.test(tab.url)) {
        flash(t('bm.cannotSave'));
        return;
      }
      await addBookmark(tab.url, tab.title ?? '');
      flash(t('bm.saved'));
      void refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : t('bm.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  // 当前标签页加入「待看」
  const addCurrentToReadLater = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url || !/^https?:/.test(tab.url)) {
        flash(t('bm.cannotSave'));
        return;
      }
      await addToReadLater(tab.url, tab.title ?? '');
      flash(t('bm.addedLater'));
      void refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : t('bm.addFailed'));
    } finally {
      setBusy(false);
    }
  };

  // 打开「收藏体检」独立页（读取浏览器书签 + 历史访问频次）
  const openAudit = () => {
    const getUrl = browser.runtime.getURL as unknown as (path: string) => string;
    void browser.tabs.create({ url: getUrl('audit.html') });
  };

  // 整理浏览器收藏：导入原生书签 + 自动分类 + 高频域名标记「常用」
  const organize = async () => {
    if (busy) return;
    if (!window.confirm(t('bm.organizeConfirm'))) return;
    setBusy(true);
    try {
      const r = await organizeBrowserBookmarks(10);
      flash(
        t('bm.organizeResult', {
          imported: r.imported,
          skipped: r.skipped,
          categorized: r.categorized,
          frequent: r.frequent,
        }),
      );
      void refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : t('bm.organizeFailed'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    await deleteBookmark(id);
    void refresh();
  };

  const commitTags = async () => {
    if (editingId) {
      await updateBookmarkTags(
        editingId,
        editTags.split(/[,，]/).map((x) => x.trim()),
      );
    }
    setEditingId(null);
    void refresh();
  };

  // 导出备份（下载 JSON）
  const doExport = () => {
    const json = exportBookmarksJson(items);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tabpocket-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash(t('bm.backupExported'));
  };

  // 导入备份
  const doImport = async (file: File) => {
    try {
      const text = await file.text();
      const count = importBookmarksJson(text); // 校验
      const incoming = JSON.parse(text).bookmarks as BookmarkItem[];
      const existing = await loadBookmarks();
      const existingUrls = new Set(existing.map((b) => b.url));
      const merged = [
        ...incoming.filter((b) => !existingUrls.has(b.url)),
        ...existing,
      ];
      await browser.storage.local.set({ bookmarks: merged });
      flash(t('bm.imported', { n: count }));
      void refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : t('bm.importFailed'));
    }
  };

  return (
    <div className="bookmarks-view">
      <div className="bm-toolbar">
        <div className="bm-main-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={bookmarkCurrentTab}
            disabled={busy}
          >
            {busy ? t('bm.busy') : t('bm.add')}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={addCurrentToReadLater}
            disabled={busy}
          >
            {t('bm.addReadLater')}
          </button>
        </div>
        <div className="bm-sub-actions">
          <button type="button" className="btn-mini btn-mini-strong" onClick={openAudit}>
            {t('bm.audit')}
          </button>
          <button type="button" className="btn-mini" onClick={organize} disabled={busy}>
            {t('bm.organize')}
          </button>
          <button type="button" className="btn-mini" onClick={doExport}>
            {t('bm.export')}
          </button>
          <button
            type="button"
            className="btn-mini"
            onClick={() => fileRef.current?.click()}
          >
            {t('bm.import')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void doImport(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {toast && <p className="toast">{toast}</p>}

      <input
        className="bm-search"
        placeholder={t('bm.search')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="bm-sort-row">
        <span className="bm-sort-label">{t('bm.sortLabel')}</span>
        <button
          type="button"
          className={sortMode === 'added' ? 'tag-chip active' : 'tag-chip'}
          onClick={() => setSortMode('added')}
        >
          {t('bm.sortAdded')}
        </button>
        <button
          type="button"
          className={sortMode === 'visits' ? 'tag-chip active' : 'tag-chip'}
          onClick={() => setSortMode('visits')}
        >
          {t('bm.sortVisits')}
        </button>
        {sortMode === 'visits' && (
          <span className="bm-sort-hint">
            {counting ? t('bm.counting') : t('bm.lastYear')}
          </span>
        )}
      </div>

      {tags.length > 0 && (
        <div className="bm-tags">
          <button
            type="button"
            className={activeTag === null ? 'tag-chip active' : 'tag-chip'}
            onClick={() => setActiveTag(null)}
          >
            {t('audit.filter.all')}
          </button>
          {tags.map((tagName) => (
            <button
              key={tagName}
              type="button"
              className={activeTag === tagName ? 'tag-chip active' : 'tag-chip'}
              onClick={() => setActiveTag(activeTag === tagName ? null : tagName)}
            >
              {displayTag(tagName)}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="empty">{items.length === 0 ? t('bm.empty') : t('bm.noMatch')}</p>
      ) : (
        <ul className="bm-list">
          {shown.map((b) => (
            <li key={b.id} className="bm-card">
              <div className="bm-favicon">{domainOf(b.url).slice(0, 1).toUpperCase()}</div>
              <div className="bm-body">
                <a
                  className="bm-title"
                  href={b.url}
                  title={b.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {b.title}
                </a>
                <div className="bm-domain">
                  {domainOf(b.url)} ·{' '}
                  {new Date(b.createdAt).toLocaleDateString(locale())}
                  {sortMode === 'visits' && visits[b.url] !== undefined && (
                    <span className="bm-visits">
                      {' · '}
                      {t('bm.visitsInYear', { n: visits[b.url] ?? 0 })}
                    </span>
                  )}
                </div>
                {editingId === b.id ? (
                  <div className="bm-tag-edit">
                    <input
                      className="name-input"
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void commitTags();
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      placeholder={t('bm.tagsPlaceholder')}
                      autoFocus
                    />
                    <button type="button" className="btn-mini" onClick={commitTags}>
                      {t('sessions.save')}
                    </button>
                  </div>
                ) : (
                  <div className="bm-tag-row">
                    {b.tags.length > 0 ? (
                      b.tags.map((tagName) => (
                        <span key={tagName} className="bm-tag">
                          {displayTag(tagName)}
                        </span>
                      ))
                    ) : (
                      <span className="bm-tag-none">{t('bm.tagNone')}</span>
                    )}
                    {b.tags.includes(TAG_READ_LATER) && (
                      <button
                        type="button"
                        className="bm-done"
                        onClick={() => {
                          void toggleReadLater(b.id).then(() => refresh());
                        }}
                      >
                        {t('bm.done')}
                      </button>
                    )}
                    <button
                      type="button"
                      className="bm-tag-add"
                      onClick={() => {
                        setEditingId(b.id);
                        setEditTags(b.tags.join('，'));
                      }}
                    >
                      {t('bm.editTags')}
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="bm-del"
                title={t('bm.deleteTitle')}
                onClick={() => void remove(b.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
