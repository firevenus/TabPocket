// ============================================================
// 统计链路自诊断：后台是否活着 / 心跳是否存在 / 有没有写进库
// 目的：统计页空白时能直接看出卡在哪一环，不用猜
// ============================================================
import { browser } from 'wxt/browser';
import { t } from '../i18n/core';
import { countBuckets, getBucketsByDateRange } from './idb';
import { localDateKey } from './stats';

export interface TrackStateLite {
  tabId: number;
  windowId: number;
  url: string;
  domain: string;
  since: number;
}

export interface TrackStatus {
  /** 后台有没有响应（false = Service Worker 没起来/已失联） */
  backgroundAlive: boolean;
  /** 心跳 alarm 是否注册（false = 每分钟结算不会发生） */
  alarmExists: boolean;
  alarmPeriod: number | null;
  /** 当前正在计时的那一页（null = 没在计时） */
  state: TrackStateLite | null;
  /** IndexedDB 里的聚合记录条数 */
  recordCount: number;
  /** 最近一次写入时间戳 */
  lastWriteTs: number | null;
}

interface StatusResponse {
  success?: boolean;
  alarmExists?: boolean;
  alarmPeriod?: number | null;
  state?: TrackStateLite | null;
}

/** 向后台要一次计时状态；顺带验证后台是否还活着 */
export async function collectStatus(): Promise<TrackStatus> {
  let backgroundAlive = false;
  let alarmExists = false;
  let alarmPeriod: number | null = null;
  let state: TrackStateLite | null = null;

  try {
    const res = (await browser.runtime.sendMessage({
      type: 'TRACK_STATUS',
    })) as StatusResponse | undefined;
    if (res && res.success !== false) {
      backgroundAlive = true;
      alarmExists = !!res.alarmExists;
      alarmPeriod = res.alarmPeriod ?? null;
      state = res.state ?? null;
    }
  } catch {
    backgroundAlive = false;
  }

  let recordCount = 0;
  let lastWriteTs: number | null = null;
  try {
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2);
    const [count, rows] = await Promise.all([
      countBuckets(),
      getBucketsByDateRange(localDateKey(from), localDateKey(today)),
    ]);
    recordCount = count;
    lastWriteTs = rows.reduce((m, r) => Math.max(m, r.lastTs || 0), 0) || null;
  } catch {
    /* IndexedDB 不可用 */
  }

  return {
    backgroundAlive,
    alarmExists,
    alarmPeriod,
    state,
    recordCount,
    lastWriteTs,
  };
}

/** 让后台立刻结算当前这一段（不用等 60 秒心跳） */
export async function settleNow(): Promise<boolean> {
  try {
    const res = (await browser.runtime.sendMessage({ type: 'SETTLE_NOW' })) as
      | { success?: boolean }
      | undefined;
    return !!res && res.success !== false;
  } catch {
    return false;
  }
}

export function formatSince(ts: number | null | undefined): string {
  if (!ts) return '—';
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return t('since.seconds', { n: s });
  if (s < 3600) return t('since.minutes', { m: Math.floor(s / 60), s: s % 60 });
  return t('since.hours', { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60) });
}
