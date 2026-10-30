// ============================================================
// TabPocket 核心类型定义
// ============================================================

// ---------- 会话收拢 ----------
export interface SessionTab {
  title: string;
  url: string;
}

export interface Session {
  id: string;
  name: string;
  tabs: SessionTab[];
  tabCount: number;
  createdAt: number;
  updatedAt: number;
}

// ---------- 书签收藏 ----------
export interface BookmarkItem {
  id: string;
  url: string;
  title: string;
  tags: string[];
  createdAt: number;
}

// ---------- 浏览统计 ----------
/**
 * 聚合后的停留记录（IndexedDB `visits` 表）。
 * 按「日期 + 小时 + 域名」聚合，避免每 60 秒写一行导致数据爆炸。
 */
export interface VisitBucket {
  /** 复合主键：`${date}|${hour}|${domain}` */
  key: string;
  /** 本地日期 YYYY-MM-DD */
  date: string;
  /** 0-23 */
  hour: number;
  domain: string;
  /** 累计停留时长（ms） */
  durationMs: number;
  /** 累计打开次数（标签被激活的次数） */
  visits: number;
  /** 最后更新时间戳 */
  lastTs: number;
}

/** 汇总后的统计数据，供 UI 直接渲染 */
export interface StatsSummary {
  /** 区间内总停留时长（ms） */
  totalMs: number;
  /** 有记录的天数 */
  activeDays: number;
  /** 去重域名数 */
  domainCount: number;
  /** 日均时长（ms） */
  avgMs: number;
  /** 最常去的域名（无数据为空串） */
  topDomain: string;
  /** 按天汇总，区间内每天都有条目（无数据为 0），便于日历热力图 */
  byDay: { date: string; durationMs: number }[];
  /** 按域名汇总，按时长降序 */
  byDomain: { domain: string; durationMs: number; visits: number }[];
  /** 24 小时分布，长度固定 24 */
  byHour: number[];
}

// ---------- 设置 ----------
export interface Settings {
  /** 心跳间隔（分钟），默认 1 */
  heartbeatMin: number;
  /** 统计时排除的域名列表 */
  excludedDomains: string[];
  /** 是否启用停留时长统计 */
  trackEnabled: boolean;
  /** 是否启用每日自动收拢 */
  autoCollapse: boolean;
  /** 自动收拢时间 HH:mm */
  autoCollapseTime: string;
}

export const DEFAULT_SETTINGS: Settings = {
  heartbeatMin: 1,
  excludedDomains: [],
  trackEnabled: true,
  autoCollapse: false,
  autoCollapseTime: '23:00',
};

// ---------- 消息协议（popup/页面 ↔ background） ----------
export type TabPocketMessage =
  | { type: 'SYNC_HISTORY' }
  | { type: 'OPEN_URL'; url: string }
  | { type: 'COLLAPSE_TABS' }
  | { type: 'RESTORE_SESSION'; sessionId: string }
  | { type: 'DELETE_SESSION'; sessionId: string }
  | { type: 'RENAME_SESSION'; sessionId: string; name: string }
  | { type: 'LIST_SESSIONS' }
  | { type: 'ADD_BOOKMARK'; url: string; title: string; tags: string[] }
  | { type: 'EXCLUDE_DOMAIN'; domain: string }
  | { type: 'TRACK_STATUS' }
  | { type: 'SETTLE_NOW' };
