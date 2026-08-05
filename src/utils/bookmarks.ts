// ============================================================
// 书签收藏模块（M2）：收藏当前页 / 标签管理 / 搜索筛选 / 导出备份
// 存储：chrome.storage.local，key = 'bookmarks'
// ============================================================
import { browser } from 'wxt/browser';
import type { BookmarkItem } from '../types';
import { classifyDomain, isFrequentDomain } from './classify';

const KEY = 'bookmarks';

// ---------- 存储 ----------
export async function loadBookmarks(): Promise<BookmarkItem[]> {
  const data = await browser.storage.local.get(KEY);
  return (data[KEY] as BookmarkItem[] | undefined) ?? [];
}

async function saveBookmarks(items: BookmarkItem[]): Promise<void> {
  await browser.storage.local.set({ [KEY]: items });
}

// ---------- CRUD ----------
export async function addBookmark(
  url: string,
  title: string,
  tags: string[] = [],
): Promise<BookmarkItem> {
  const items = await loadBookmarks();
  if (items.some((b) => b.url === url)) {
    throw new Error('这个页面已经在收藏里了');
  }
  const item: BookmarkItem = {
    id: crypto.randomUUID(),
    url,
    title: title || url,
    tags: [...new Set(tags.map((t) => t.trim()).filter(Boolean))],
    createdAt: Date.now(),
  };
  items.unshift(item);
  await saveBookmarks(items);
  return item;
}

export async function deleteBookmark(id: string): Promise<void> {
  const items = await loadBookmarks();
  await saveBookmarks(items.filter((b) => b.id !== id));
}

export async function updateBookmarkTags(id: string, tags: string[]): Promise<void> {
  const items = await loadBookmarks();
  const target = items.find((b) => b.id === id);
  if (target) {
    target.tags = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
    await saveBookmarks(items);
  }
}

// ---------- 搜索 / 聚合 ----------
export function searchBookmarks(
  items: BookmarkItem[],
  query: string,
  tag: string | null,
): BookmarkItem[] {
  const q = query.trim().toLowerCase();
  return items.filter((b) => {
    if (tag && !b.tags.includes(tag)) return false;
    if (!q) return true;
    return (
      b.title.toLowerCase().includes(q) ||
      b.url.toLowerCase().includes(q) ||
      b.tags.some((t) => t.toLowerCase().includes(q))
    );
  });
}

export function collectTags(items: BookmarkItem[]): string[] {
  const set = new Set<string>();
  items.forEach((b) => b.tags.forEach((t) => set.add(t)));
  return Array.from(set);
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// ---------- 导出 / 导入（防数据丢失备份） ----------
export interface BackupPayload {
  app: 'tabnest';
  version: 1;
  exportedAt: number;
  bookmarks: BookmarkItem[];
}

export function exportBookmarksJson(items: BookmarkItem[]): string {
  const payload: BackupPayload = {
    app: 'tabnest',
    version: 1,
    exportedAt: Date.now(),
    bookmarks: items,
  };
  return JSON.stringify(payload, null, 2);
}

export function importBookmarksJson(text: string): number {
  const parsed = JSON.parse(text) as Partial<BackupPayload>;
  if (parsed.app !== 'tabnest' || !Array.isArray(parsed.bookmarks)) {
    throw new Error('不是有效的 TabNest 备份文件');
  }
  // 校验每条记录结构
  const valid = parsed.bookmarks.filter(
    (b) => b && typeof b.url === 'string' && typeof b.title === 'string',
  );
  if (valid.length === 0) throw new Error('备份文件里没有有效书签');
  return valid.length;
}

// ---------- 整理浏览器收藏（导入 + 自动分类 + 常用标记） ----------

interface RawBookmark {
  url: string;
  title: string;
  folder: string;
}

/** chrome.bookmarks 树节点的最小结构（避免依赖 polyfill 类型命名空间） */
interface BookmarkTreeNodeLite {
  title?: string;
  url?: string;
  children?: BookmarkTreeNodeLite[];
}

async function flattenBookmarkTree(
  nodes: BookmarkTreeNodeLite[],
  folder = '',
): Promise<RawBookmark[]> {
  const out: RawBookmark[] = [];
  for (const node of nodes) {
    if (node.url) {
      out.push({ url: node.url, title: node.title || node.url, folder });
    }
    if (node.children && node.children.length > 0) {
      const childFolder = node.title && node.title !== '书签栏' && node.title !== '其他书签'
        ? (folder ? `${folder} / ${node.title}` : node.title)
        : folder;
      out.push(...(await flattenBookmarkTree(node.children, childFolder)));
    }
  }
  return out;
}

/** 统计最近 days 天内访问频率最高的 topN 个域名 */
export async function getFrequentDomains(
  days = 90,
  topN = 10,
): Promise<Set<string>> {
  const items = await browser.history.search({
    text: '',
    startTime: Date.now() - days * 24 * 60 * 60 * 1000,
    maxResults: 10000,
  });
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!item.url) continue;
    try {
      const host = new URL(item.url).hostname.replace(/^www\./, '');
      counts.set(host, (counts.get(host) ?? 0) + (item.visitCount ?? 1));
    } catch {
      /* 忽略无效 URL */
    }
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return new Set(sorted.slice(0, topN).map(([host]) => host));
}

export interface OrganizeResult {
  total: number;
  imported: number;
  skipped: number;
  categorized: number;
  frequent: number;
}

/**
 * 整理浏览器收藏：读取原生书签 → 去重导入 → 自动分类 → 高频域名标记「常用」
 * 文件夹名与分类名一并作为标签。
 */
export async function organizeBrowserBookmarks(topN = 10): Promise<OrganizeResult> {
  const tree = await browser.bookmarks.getTree();
  const raws = await flattenBookmarkTree(tree);

  const existing = await loadBookmarks();
  const existingUrls = new Set(existing.map((b) => b.url));
  const frequentDomains = await getFrequentDomains(90, topN);

  const now = Date.now();
  let imported = 0;
  let skipped = 0;
  let categorized = 0;
  let frequent = 0;
  const additions: BookmarkItem[] = [];

  for (const raw of raws) {
    if (existingUrls.has(raw.url)) {
      skipped++;
      continue;
    }
    const tags = new Set<string>();
    const category = classifyDomain(raw.url);
    if (category !== '其他') {
      tags.add(category);
      categorized++;
    }
    if (raw.folder) tags.add(raw.folder);
    if (isFrequentDomain(raw.url, frequentDomains)) {
      tags.add('常用');
      frequent++;
    }
    additions.push({
      id: crypto.randomUUID(),
      url: raw.url,
      title: raw.title,
      tags: [...tags],
      createdAt: now,
    });
    existingUrls.add(raw.url);
    imported++;
  }

  if (additions.length > 0) {
    await browser.storage.local.set({ bookmarks: [...additions, ...existing] });
  }
  return { total: raws.length, imported, skipped, categorized, frequent };
}
