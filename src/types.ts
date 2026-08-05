// ============================================================
// TabNest 核心类型定义
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
/** 一次访问的停留记录（IndexedDB visits 表） */
export interface VisitRecord {
  id?: number;
  url: string;
  title: string;
  domain: string;
  /** 记录写入时间戳（ms） */
  ts: number;
  /** 本次记录的停留时长（ms） */
  durationMs: number;
}

// ---------- 设置 ----------
export interface Settings {
  /** 心跳间隔（分钟），默认 1 */
  heartbeatMin: number;
  /** 统计时排除的域名列表 */
  excludedDomains: string[];
  /** 是否启用每日自动收拢 */
  autoCollapse: boolean;
  /** 自动收拢时间 HH:mm */
  autoCollapseTime: string;
}

export const DEFAULT_SETTINGS: Settings = {
  heartbeatMin: 1,
  excludedDomains: [],
  autoCollapse: false,
  autoCollapseTime: '23:00',
};

// ---------- 消息协议（popup/页面 ↔ background） ----------
export type TabNestMessage =
  | { type: 'SYNC_HISTORY' }
  | { type: 'OPEN_URL'; url: string }
  | { type: 'COLLAPSE_TABS' }
  | { type: 'RESTORE_SESSION'; sessionId: string }
  | { type: 'DELETE_SESSION'; sessionId: string }
  | { type: 'RENAME_SESSION'; sessionId: string; name: string }
  | { type: 'LIST_SESSIONS' }
  | { type: 'ADD_BOOKMARK'; url: string; title: string; tags: string[] }
  | { type: 'EXCLUDE_DOMAIN'; domain: string };
