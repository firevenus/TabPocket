// ============================================================
// 收藏体检（M4.5）：读取浏览器原生书签 → 统计区间内访问频次 → 排行榜
// 数据源：chrome.bookmarks（书签树）+ chrome.history.getVisits（按 URL 精确计数）
// ============================================================
import { browser } from 'wxt/browser';
import { locale, t } from '../i18n/core';

export interface AuditRow {
  url: string;
  title: string;
  /** 所在收藏文件夹路径，如「书签栏 / 工具」 */
  folder: string;
  domain: string;
  /** 区间内访问次数 */
  visits: number;
  /** 区间内最后访问时间；0 表示区间内没访问过 */
  lastVisit: number;
  /** 浏览器书签节点 id，用于删除/移动 */
  bookmarkId: string;
  /** 收藏时间 */
  dateAdded: number;
}

export interface AuditDomainRow {
  domain: string;
  visits: number;
  /** 该域名下收藏的页面数 */
  pages: number;
  lastVisit: number;
}

export interface AuditResult {
  /** 结果结构版本，改动统计口径时递增，用于作废旧缓存 */
  schema: number;
  scannedAt: number;
  /** 统计区间（天） */
  days: number;
  totalBookmarks: number;
  visitedCount: number;
  deadCount: number;
  totalVisits: number;
  rows: AuditRow[];
  domains: AuditDomainRow[];
  /** 历史记录可用性探针，用于解释「为什么全是 0 次」 */
  probe?: HistoryProbe;
  /** 统计过程中收集到的历史 API 报错 */
  visitError?: string;
}

const CACHE_KEY = 'auditCache';
/** v2：修正 getVisits 参数错误后，旧的全 0 缓存必须作废 */
const AUDIT_SCHEMA = 2;

// ---------- 书签树 ----------

interface BookmarkTreeNodeLite {
  id: string;
  title?: string;
  url?: string;
  dateAdded?: number;
  children?: BookmarkTreeNodeLite[];
}

const ROOT_NAMES = new Set(['书签栏', '其他书签', 'Bookmarks bar', 'Other bookmarks', '']);

function flatten(
  nodes: BookmarkTreeNodeLite[],
  folder = '',
  out: AuditRow[] = [],
): AuditRow[] {
  for (const node of nodes) {
    if (node.url) {
      out.push({
        url: node.url,
        title: node.title || node.url,
        folder,
        domain: domainOf(node.url),
        visits: 0,
        lastVisit: 0,
        bookmarkId: node.id,
        dateAdded: node.dateAdded ?? 0,
      });
      continue;
    }
    if (node.children?.length) {
      const name = (node.title ?? '').trim();
      const next = ROOT_NAMES.has(name) ? folder : folder ? `${folder} / ${name}` : name;
      flatten(node.children, next, out);
    }
  }
  return out;
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** 只统计可打开的真实网页 */
function isWebUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/** 读取浏览器全部书签（扁平化），已按 URL 去重 */
export async function readNativeBookmarks(): Promise<AuditRow[]> {
  const tree = (await browser.bookmarks.getTree()) as unknown as BookmarkTreeNodeLite[];
  const rows = flatten(tree);
  const seen = new Set<string>();
  return rows.filter((r) => {
    if (!isWebUrl(r.url)) return false;
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}

// ---------- 访问频次 ----------

/** 历史记录里 URL 通常不带 hash，且可能相差一个结尾斜杠，逐一尝试 */
function urlVariants(url: string): string[] {
  const base = url.split('#')[0] ?? url;
  const set = new Set<string>([base]);
  if (base.endsWith('/')) set.add(base.slice(0, -1));
  else set.add(`${base}/`);
  return [...set];
}

/**
 * 注意：chrome.history.getVisits() 的 details **只接受 url 一个字段**。
 * 传 startTime / endTime 会被 Chrome 的参数校验判为「Unexpected property」直接抛错，
 * 所以时间区间必须在拿到全部访问记录后自己过滤（VisitItem 带 visitTime）。
 */
interface VisitItemLite {
  visitTime?: number;
}

interface HistoryItemLite {
  url?: string;
  title?: string;
  visitCount?: number;
  lastVisitTime?: number;
}

const historyApi = browser.history as unknown as {
  getVisits: (details: { url: string }) => Promise<VisitItemLite[]>;
  search: (query: {
    text: string;
    startTime?: number;
    endTime?: number;
    maxResults?: number;
  }) => Promise<HistoryItemLite[]>;
};

/** 最近一次 getVisits 报的错，用于体检页诊断 */
let lastVisitError = '';
export function getLastVisitError(): string {
  return lastVisitError;
}

async function visitsInRange(
  url: string,
  startTime: number,
  endTime: number,
): Promise<{ visits: number; lastVisit: number }> {
  let visits = 0;
  let lastVisit = 0;
  for (const v of urlVariants(url)) {
    try {
      const items = await historyApi.getVisits({ url: v });
      for (const it of items ?? []) {
        const t = it.visitTime ?? 0;
        if (t >= startTime && t <= endTime) {
          visits += 1;
          if (t > lastVisit) lastVisit = t;
        }
      }
    } catch (err) {
      // 常见原因：URL 非法 / 该网址从未进过历史（部分 Chromium 会抛错）
      lastVisitError = err instanceof Error ? err.message : String(err);
    }
  }
  return { visits, lastVisit };
}

/** 单条 URL 在近 days 天内的访问次数（体检页用） */
export async function countVisits(
  url: string,
  days = 365,
): Promise<{ visits: number; lastVisit: number }> {
  const end = Date.now();
  return visitsInRange(url, end - days * 24 * 60 * 60 * 1000, end);
}

// ---------- 全量访问索引（收藏页排序用） ----------

/**
 * URL 归一化：去掉 #hash、去掉结尾斜杠、统一小写。
 * 收藏里存的 URL 与历史里的记录常差一个结尾斜杠，必须归一后才能对上。
 */
export function normalizeUrl(url: string): string {
  let u = (url || '').trim().split('#')[0] ?? '';
  if (u.endsWith('/')) u = u.slice(0, -1);
  return u.toLowerCase();
}

export interface VisitIndex {
  /** search 是否成功；失败时 counts 为空，调用方要提示而不是当成「全是 0 次」 */
  ok: boolean;
  error?: string;
  /** 归一化 URL → 历史累计访问次数 */
  counts: Map<string, number>;
  /** 归一化 URL → 最后访问时间 */
  lastVisit: Map<string, number>;
  /** 索引里的 URL 条数 */
  size: number;
  builtAt: number;
}

/**
 * 一次性把浏览器历史全部读进内存建索引（**一次 IPC**）。
 *
 * 为什么不逐条 getVisits：收藏动辄几百条，每条还要试两种 URL 变体，
 * 就是几百上千次 IPC，在 popup 里根本等不到结果（popup 一失焦就销毁），
 * 表现就是「点了按访问频次，列表纹丝不动」。
 *
 * 口径：`visitCount` 是历史库里的**累计**次数，不按区间切分。
 * 收藏页要回答的是「我常去哪些站」，累计值比近一年更贴切，文案也如实写「累计」。
 */
let indexCache: { idx: VisitIndex; at: number } | null = null;
const INDEX_TTL = 5 * 60 * 1000;

export async function buildVisitIndex(force = false): Promise<VisitIndex> {
  if (!force && indexCache && Date.now() - indexCache.at < INDEX_TTL) return indexCache.idx;

  const idx: VisitIndex = {
    ok: false,
    counts: new Map(),
    lastVisit: new Map(),
    size: 0,
    builtAt: Date.now(),
  };

  try {
    // 先试全量；个别版本对 maxResults 有上限，失败就缩小再试一次
    let items: HistoryItemLite[] = [];
    try {
      items = await historyApi.search({ text: '', startTime: 0, maxResults: 100000 });
    } catch {
      items = await historyApi.search({ text: '', startTime: 0, maxResults: 5000 });
    }
    for (const it of items ?? []) {
      if (!it.url) continue;
      const key = normalizeUrl(it.url);
      if (!key) continue;
      idx.counts.set(key, (idx.counts.get(key) ?? 0) + (it.visitCount ?? 1));
      const t = it.lastVisitTime ?? 0;
      if (t > (idx.lastVisit.get(key) ?? 0)) idx.lastVisit.set(key, t);
    }
    idx.size = idx.counts.size;
    idx.ok = true;
  } catch (err) {
    idx.error = err instanceof Error ? err.message : String(err);
    lastVisitError = idx.error;
  }

  indexCache = { idx, at: Date.now() };
  return idx;
}


export interface HistoryProbe {
  /** 历史记录 API 是否可用 */
  ok: boolean;
  error?: string;
  /** 历史里最新一条记录的访问时间 */
  latest?: number;
  /** 历史记录总条数（抽样上限 5）是否非空 */
  hasHistory: boolean;
}

/** 快速探一下浏览器历史记录到底有没有数据，用于体检页解释「为什么全是 0」 */
export async function probeHistory(): Promise<HistoryProbe> {
  try {
    const items = await historyApi.search({ text: '', maxResults: 5 });
    const times = items
      .map((i) => i.lastVisitTime ?? 0)
      .filter((t) => t > 0);
    // 顺带验证 getVisits 本身能不能调通
    const first = items.find((i) => i.url);
    if (first?.url) {
      try {
        await historyApi.getVisits({ url: first.url });
      } catch (err) {
        return {
          ok: false,
          hasHistory: items.length > 0,
          latest: times.length ? Math.max(...times) : undefined,
          error: `getVisits 调用失败：${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }
    return {
      ok: true,
      hasHistory: items.length > 0,
      latest: times.length ? Math.max(...times) : undefined,
    };
  } catch (err) {
    return {
      ok: false,
      hasHistory: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** 限制并发的 map */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  let done = 0;
  let lastEmit = 0;

  async function worker() {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      const item = items[i];
      if (item === undefined) continue;
      results[i] = await fn(item, i);
      done++;
      // 每 10 条或结束时汇报一次，避免高频 setState
      if (onProgress && (done - lastEmit >= 10 || done === items.length)) {
        lastEmit = done;
        onProgress(done, items.length);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

export interface AuditOptions {
  days?: number;
  onProgress?: (done: number, total: number) => void;
}

/**
 * 扫描书签的访问频次。
 * 对每个书签 URL 用 history.getVisits 精确统计区间内访问次数
 * （history.search 的 visitCount 是全量累计值，分不出区间，故不用）。
 */
export async function auditBookmarks(opts: AuditOptions = {}): Promise<AuditResult> {
  const days = opts.days ?? 365;
  const endTime = Date.now();
  const startTime = endTime - days * 24 * 60 * 60 * 1000;

  lastVisitError = '';

  const base = await readNativeBookmarks();
  opts.onProgress?.(0, base.length);

  const enriched = await mapLimit(
    base,
    12,
    async (row) => {
      const { visits, lastVisit } = await visitsInRange(row.url, startTime, endTime);
      return { ...row, visits, lastVisit };
    },
    opts.onProgress,
  );

  enriched.sort((a, b) => b.visits - a.visits || b.lastVisit - a.lastVisit);

  // 域名聚合
  const byDomain = new Map<string, AuditDomainRow>();
  for (const r of enriched) {
    const d = byDomain.get(r.domain) ?? {
      domain: r.domain,
      visits: 0,
      pages: 0,
      lastVisit: 0,
    };
    d.visits += r.visits;
    d.pages += 1;
    d.lastVisit = Math.max(d.lastVisit, r.lastVisit);
    byDomain.set(r.domain, d);
  }
  const domains = [...byDomain.values()].sort(
    (a, b) => b.visits - a.visits || b.lastVisit - a.lastVisit,
  );

  const probe = await probeHistory();

  const result: AuditResult = {
    schema: AUDIT_SCHEMA,
    scannedAt: endTime,
    days,
    totalBookmarks: enriched.length,
    visitedCount: enriched.filter((r) => r.visits > 0).length,
    deadCount: enriched.filter((r) => r.visits === 0).length,
    totalVisits: enriched.reduce((sum, r) => sum + r.visits, 0),
    rows: enriched,
    domains,
    probe,
    visitError: lastVisitError || undefined,
  };

  await saveAuditCache(result);
  return result;
}

// ---------- 缓存 ----------

export async function saveAuditCache(result: AuditResult): Promise<void> {
  try {
    await browser.storage.local.set({ [CACHE_KEY]: result });
  } catch (err) {
    // 书签特别多时可能超过单键配额，缓存失败不影响主流程
    console.warn('[TabPocket] 体检结果缓存失败:', err);
  }
}

export async function loadAuditCache(): Promise<AuditResult | null> {
  const data = await browser.storage.local.get(CACHE_KEY);
  const cached = data[CACHE_KEY] as AuditResult | undefined;
  if (!cached || !Array.isArray(cached.rows)) return null;
  // 旧版本缓存（统计口径有 bug）直接丢弃，触发重新扫描
  if (cached.schema !== AUDIT_SCHEMA) return null;
  return cached;
}

// ---------- 整理动作 ----------

/** 从浏览器书签里移除一条（不可逆，调用方需自己确认） */
export async function removeNativeBookmark(bookmarkId: string): Promise<void> {
  await browser.bookmarks.remove(bookmarkId);
}

/** 打开页面（新标签页） */
export async function openUrl(url: string): Promise<void> {
  await browser.tabs.create({ url });
}

// ---------- 导出 ----------

export function toCsv(rows: AuditRow[], days: number): string {
  const head = [
    t('csv.rank'),
    t('csv.visits'),
    t('csv.lastVisit', { days }),
    t('csv.title'),
    t('csv.url'),
    t('csv.domain'),
    t('csv.folder'),
  ];
  const lines = rows.map((r, i) => [
    i + 1,
    r.visits,
    r.lastVisit ? new Date(r.lastVisit).toLocaleString(locale()) : t('when.never'),
    r.title,
    r.url,
    r.domain,
    r.folder,
  ]);
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM：让 Excel 正确识别 UTF-8 中文
  return `\ufeff${[head, ...lines].map((cols) => cols.map(esc).join(',')).join('\r\n')}`;
}

export function formatWhen(ts: number): string {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  const day = 24 * 60 * 60 * 1000;
  if (diff < 60 * 60 * 1000) return t('when.justNow');
  if (diff < day) return t('when.hoursAgo', { n: Math.floor(diff / (60 * 60 * 1000)) });
  if (diff < 2 * day) return t('when.yesterday');
  if (diff < 30 * day) return t('when.daysAgo', { n: Math.floor(diff / day) });
  return new Date(ts).toLocaleDateString(locale());
}
