import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import type { BookmarkItem } from '../../../src/types';
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

export default function BookmarksView() {
  const [items, setItems] = useState<BookmarkItem[]>([]);
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTags, setEditTags] = useState('');
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
    return [TAG_READ_LATER, ...all.filter((t) => t !== TAG_READ_LATER)];
  }, [items]);
  const filtered = useMemo(
    () => searchBookmarks(items, query, activeTag),
    [items, query, activeTag],
  );

  // 收藏当前活动标签页
  const bookmarkCurrentTab = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url || !/^https?:/.test(tab.url)) {
        flash('当前页面无法收藏');
        return;
      }
      await addBookmark(tab.url, tab.title ?? '');
      flash('已收藏');
      void refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : '收藏失败');
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
        flash('当前页面无法添加');
        return;
      }
      await addToReadLater(tab.url, tab.title ?? '');
      flash('已加入「待看」');
      void refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : '添加失败');
    } finally {
      setBusy(false);
    }
  };

  // 整理浏览器收藏：导入原生书签 + 自动分类 + 高频域名标记「常用」
  const organize = async () => {
    if (busy) return;
    const ok = window.confirm(
      '将读取浏览器全部收藏，导入到 TabPocket 并自动分类归纳（重复的会跳过）。\n' +
        '访问频率最高的网站会标记为「常用」。确定继续？',
    );
    if (!ok) return;
    setBusy(true);
    try {
      const r = await organizeBrowserBookmarks(10);
      flash(
        `导入 ${r.imported} 条（跳过 ${r.skipped} 重复），` +
          `自动分类 ${r.categorized} 条，标记常用 ${r.frequent} 条`,
      );
      void refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : '整理失败');
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
        editTags.split(/[,，]/).map((t) => t.trim()),
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
    a.download = `tabnest-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash('备份已导出');
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
      flash(`导入 ${count} 条，去重后合并`);
      void refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : '导入失败');
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
            {busy ? '处理中…' : '收藏当前页'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={addCurrentToReadLater}
            disabled={busy}
          >
            加入待看
          </button>
        </div>
        <div className="bm-sub-actions">
          <button type="button" className="btn-mini" onClick={organize} disabled={busy}>
            整理浏览器收藏
          </button>
          <button type="button" className="btn-mini" onClick={doExport}>
            导出备份
          </button>
          <button
            type="button"
            className="btn-mini"
            onClick={() => fileRef.current?.click()}
          >
            导入备份
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
        placeholder="搜索标题 / 网址 / 标签…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {tags.length > 0 && (
        <div className="bm-tags">
          <button
            type="button"
            className={activeTag === null ? 'tag-chip active' : 'tag-chip'}
            onClick={() => setActiveTag(null)}
          >
            全部
          </button>
          {tags.map((t) => (
            <button
              key={t}
              type="button"
              className={activeTag === t ? 'tag-chip active' : 'tag-chip'}
              onClick={() => setActiveTag(activeTag === t ? null : t)}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="empty">
          {items.length === 0
            ? '还没有收藏。点上方按钮收藏当前页，或右键任意网页选「收藏此页面」。'
            : '没有匹配的收藏。'}
        </p>
      ) : (
        <ul className="bm-list">
          {filtered.map((b) => (
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
                  {new Date(b.createdAt).toLocaleDateString('zh-CN')}
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
                      placeholder="逗号分隔多个标签"
                      autoFocus
                    />
                    <button type="button" className="btn-mini" onClick={commitTags}>
                      保存
                    </button>
                  </div>
                ) : (
                  <div className="bm-tag-row">
                    {b.tags.length > 0 ? (
                      b.tags.map((t) => (
                        <span key={t} className="bm-tag">
                          {t}
                        </span>
                      ))
                    ) : (
                      <span className="bm-tag-none">无标签</span>
                    )}
                    {b.tags.includes(TAG_READ_LATER) && (
                      <button
                        type="button"
                        className="bm-done"
                        onClick={() => {
                          void toggleReadLater(b.id).then(() => refresh());
                        }}
                      >
                        看完
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
                      编辑标签
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="bm-del"
                title="删除收藏"
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
