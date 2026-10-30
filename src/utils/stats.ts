// ============================================================
// 浏览统计：写入（background 心跳）+ 查询汇总（popup / 报表页）
// 存储：IndexedDB visits 表（按 日期+小时+域名 聚合）
// ============================================================
import { browser } from 'wxt/browser';
import { t } from '../i18n/core';
import {
  DEFAULT_SETTINGS,
  type Settings,
  type StatsSummary,
  type VisitBucket,
} from '../types';
import { domainOf } from './bookmarks';
import { clearAllBuckets, getBucket, getBucketsByDateRange, putBucket } from './idb';

const SETTINGS_KEY = 'settings';

// ---------- 设置 ----------

export async function loadSettings(): Promise<Settings> {
  const raw = await browser.storage.local.get(SETTINGS_KEY);
  const saved = raw?.[SETTINGS_KEY] as Partial<Settings> | undefined;
  return { ...DEFAULT_SETTINGS, ...(saved ?? {}) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await loadSettings()), ...patch };
  await browser.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

// ---------- 时间工具 ----------

/** 本地日期 YYYY-MM-DD（不能用 toISOString，那是 UTC） */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 本地小时 0-23 */
export function hourOf(d: Date = new Date()): number {
  return d.getHours();
}

/** 只统计 http/https 页面 */
export function isTrackableUrl(url?: string): boolean {
  return !!url && /^https?:/i.test(url);
}

/** 域名是否在排除列表中（支持子域后缀匹配） */
export function isExcluded(domain: string, excluded: string[]): boolean {
  if (!domain) return true;
  const d = domain.toLowerCase();
  return excluded.some((raw) => {
    const e = raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!e) return false;
    return d === e || d.endsWith(`.${e}`);
  });
}

// ---------- 写入 ----------

/**
 * 累加一段停留时长 / 打开次数。
 * @param domain 域名
 * @param durationMs 停留时长（ms），仅计打开次数时可传 0
 * @param ts 归属时间戳，默认当前
 * @param newVisit 是否计入一次「打开」
 */
export async function accumulate(params: {
  domain: string;
  durationMs: number;
  ts?: number;
  newVisit?: boolean;
}): Promise<void> {
  const { domain, durationMs, ts = Date.now(), newVisit = false } = params;
  if (!domain) return;
  if (durationMs <= 0 && !newVisit) return;

  const at = new Date(ts);
  const date = localDateKey(at);
  const hour = hourOf(at);
  const key = `${date}|${hour}|${domain}`;

  const existing = await getBucket(key);
  const bucket: VisitBucket = existing
    ? {
        ...existing,
        durationMs: existing.durationMs + Math.max(0, durationMs),
        visits: existing.visits + (newVisit ? 1 : 0),
        lastTs: Math.max(existing.lastTs, ts),
      }
    : {
        key,
        date,
        hour,
        domain,
        durationMs: Math.max(0, durationMs),
        visits: newVisit ? 1 : 0,
        lastTs: ts,
      };

  await putBucket(bucket);
}

export async function clearStats(): Promise<void> {
  await clearAllBuckets();
}

// ---------- 查询与汇总 ----------

export function summarize(rows: VisitBucket[], days: number): StatsSummary {
  const dayMap = new Map<string, number>();
  const domainMap = new Map<string, { durationMs: number; visits: number }>();
  const byHour = new Array<number>(24).fill(0);
  let totalMs = 0;

  for (const r of rows) {
    totalMs += r.durationMs;
    dayMap.set(r.date, (dayMap.get(r.date) ?? 0) + r.durationMs);
    const d = domainMap.get(r.domain) ?? { durationMs: 0, visits: 0 };
    d.durationMs += r.durationMs;
    d.visits += r.visits;
    domainMap.set(r.domain, d);
    byHour[r.hour] = (byHour[r.hour] ?? 0) + r.durationMs;
  }

  // 区间内每一天都补上（含 0），日历热力图才不会缺格
  const today = new Date();
  const byDay: { date: string; durationMs: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = localDateKey(d);
    byDay.push({ date: key, durationMs: dayMap.get(key) ?? 0 });
  }

  const byDomain = [...domainMap.entries()]
    .map(([domain, v]) => ({ domain, ...v }))
    .sort((a, b) => b.durationMs - a.durationMs || b.visits - a.visits);

  const activeDays = byDay.filter((d) => d.durationMs > 0).length;

  return {
    totalMs,
    activeDays,
    domainCount: domainMap.size,
    avgMs: activeDays > 0 ? totalMs / activeDays : 0,
    topDomain: byDomain[0]?.domain ?? '',
    byDay,
    byDomain,
    byHour,
  };
}

/** 查询最近 N 天（含今天）的汇总 */
export async function querySummary(days: number): Promise<StatsSummary> {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1));
  const rows = await getBucketsByDateRange(localDateKey(from), localDateKey(today));
  return summarize(rows, days);
}

// ---------- 展示格式化 ----------

/** 毫秒 → 「2 小时 15 分」/「45 分」/「不足 1 分」 */
export function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return t('dur.zero');
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 1) return t('dur.lessThanMin');
  if (totalMin < 60) return t('dur.min', { n: totalMin });
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? t('dur.hour', { n: h }) : t('dur.hourMin', { h, m });
}

/** 毫秒 → 小时数（保留 1 位小数），用于图表 */
export function toHours(ms: number): number {
  return Math.round((ms / 3600000) * 10) / 10;
}

/** 从 URL 取域名（复用收藏模块的实现） */
export { domainOf };
