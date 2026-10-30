// ============================================================
// TabPocket 后台（MV3 Service Worker，module 类型）
// M1 会话收拢 · M2 右键收藏 · M3 停留时长统计
// ============================================================
import { browser } from 'wxt/browser';
import { initI18n, t } from '../src/i18n/core';
import type { TabPocketMessage } from '../src/types';
import { addBookmark } from '../src/utils/bookmarks';
import {
  collapseCurrentWindow,
  deleteSession,
  loadSessions,
  renameSession,
  restoreSession,
} from '../src/utils/sessions';
import {
  accumulate,
  domainOf,
  isExcluded,
  isTrackableUrl,
  loadSettings,
} from '../src/utils/stats';

// ============================================================
// M3 统计：心跳计时
// ------------------------------------------------------------
// MV3 的 SW 会休眠，setInterval 不可靠 → alarms 每分钟唤醒一次结算；
// 标签切换/窗口失焦时立即结算，减少归属误差；
// 状态存 storage.session，SW 重启不丢。
// ============================================================

const HEARTBEAT = 'tabpocket-heartbeat';
const STATE_KEY = 'trackState';
/** 单次结算上限：超过说明 SW 睡过、时间不可信，直接丢弃 */
const MAX_SLICE_MS = 120_000;
/** 空闲判定阈值（秒）：连续这么久没有键鼠输入才算离开 */
const IDLE_THRESHOLD_S = 300;

interface TrackState {
  tabId: number;
  windowId: number;
  url: string;
  domain: string;
  /** 本轮计时起点 */
  since: number;
}

/** storage.session 优先（不清空到磁盘），不支持则退回 local */
function stateStore() {
  const s = browser.storage as unknown as {
    session?: typeof browser.storage.local;
    local: typeof browser.storage.local;
  };
  return s.session ?? s.local;
}

async function readState(): Promise<TrackState | null> {
  try {
    const raw = (await stateStore().get(STATE_KEY)) as Record<string, unknown>;
    return (raw?.[STATE_KEY] as TrackState) ?? null;
  } catch {
    return null;
  }
}

async function writeState(state: TrackState | null): Promise<void> {
  try {
    if (state) await stateStore().set({ [STATE_KEY]: state });
    else await stateStore().remove(STATE_KEY);
  } catch (err) {
    console.warn('[TabPocket] 写入计时状态失败:', err);
  }
}

/** 把当前累积的时长结算进 IndexedDB */
async function flush(): Promise<void> {
  const state = await readState();
  if (!state) return;

  const now = Date.now();
  const elapsed = now - state.since;

  // 时间不可信（SW 长时间休眠后唤醒）→ 丢弃，只重置起点
  if (elapsed > MAX_SLICE_MS) {
    await writeState({ ...state, since: now });
    return;
  }
  if (elapsed < 1000) return;

  const settings = await loadSettings();
  if (!settings.trackEnabled) {
    await writeState({ ...state, since: now });
    return;
  }

  // 用户离开电脑（空闲/锁屏）不计时，避免挂机把时长刷爆。
  // 阈值放宽到 5 分钟：看长文/看视频时鼠标不动很常见，60 秒太容易误判成离开。
  let idleState = 'active';
  try {
    idleState = await browser.idle.queryState(IDLE_THRESHOLD_S);
  } catch {
    /* 未授予 idle 权限时忽略，按活跃处理 */
  }
  if (idleState !== 'active') {
    await writeState({ ...state, since: now });
    return;
  }

  try {
    await accumulate({ domain: state.domain, durationMs: elapsed, ts: now });
  } catch (err) {
    console.warn('[TabPocket] 统计写入失败:', err);
  }
  await writeState({ ...state, since: now });
}

/** 切换到某个标签并开始新计时 */
async function focusTab(
  tab: { id?: number; windowId?: number; url?: string } | undefined,
  countVisit: boolean,
): Promise<void> {
  await flush();

  if (!tab?.url || tab.id == null || !isTrackableUrl(tab.url)) {
    await writeState(null);
    return;
  }

  const settings = await loadSettings();
  const domain = domainOf(tab.url);
  if (!settings.trackEnabled || isExcluded(domain, settings.excludedDomains)) {
    await writeState(null);
    return;
  }

  // 同一标签同一 URL 的重复通知（onActivated + onUpdated 会一起触发）不重复计访问次数
  const prev = await readState();
  const isSameTarget = prev?.tabId === tab.id && prev?.url === tab.url;
  const shouldCount = countVisit && !isSameTarget;

  const now = Date.now();
  await writeState({
    tabId: tab.id,
    windowId: tab.windowId ?? -1,
    url: tab.url,
    domain,
    since: now,
  });

  if (shouldCount) {
    try {
      await accumulate({ domain, durationMs: 0, ts: now, newVisit: true });
    } catch (err) {
      console.warn('[TabPocket] 记录访问次数失败:', err);
    }
  }
}

async function focusActiveTabIn(windowId: number, countVisit: boolean): Promise<void> {
  try {
    const [tab] = await browser.tabs.query({ active: true, windowId });
    await focusTab(tab, countVisit);
  } catch {
    await writeState(null);
  }
}

// --- 心跳 ---
browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === HEARTBEAT) void flush();
});

// --- 切换标签 ---
browser.tabs.onActivated.addListener(({ tabId, windowId }) => {
  void (async () => {
    try {
      const tab = await browser.tabs.get(tabId);
      await focusTab({ ...tab, windowId }, true);
    } catch {
      await writeState(null);
    }
  })();
});

// --- 同一标签内跳转（SPA / 导航）---
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo.url) return;
  void (async () => {
    try {
      const [active] = await browser.tabs.query({ active: true, windowId: tab.windowId });
      if (active?.id === tabId) {
        await focusTab({ ...tab, windowId: tab.windowId }, true);
      }
    } catch {
      /* ignore */
    }
  })();
});

// --- 窗口焦点变化（切到别的应用就停表）---
browser.windows.onFocusChanged.addListener((windowId) => {
  void (async () => {
    if (windowId === browser.windows.WINDOW_ID_NONE) {
      await flush();
      await writeState(null);
      return;
    }
    await focusActiveTabIn(windowId, true);
  })();
});

// --- 空闲/锁屏 ---
browser.idle.onStateChanged.addListener((newState) => {
  void (async () => {
    if (newState === 'active') {
      const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
      await focusTab(tab, false);
    } else {
      await flush();
      await writeState(null);
    }
  })();
});

// --- 关闭标签时结算 ---
browser.tabs.onRemoved.addListener((tabId) => {
  void (async () => {
    const state = await readState();
    if (state?.tabId === tabId) {
      await flush();
      await writeState(null);
    }
  })();
});

/** 确保心跳存在（浏览器重启后 alarms 会丢） */
async function ensureHeartbeat(): Promise<void> {
  try {
    const settings = await loadSettings();
    const period = Math.max(0.5, settings.heartbeatMin || 1);
    const existing = await browser.alarms.get(HEARTBEAT);
    if (!existing) {
      await browser.alarms.create(HEARTBEAT, {
        periodInMinutes: period,
        delayInMinutes: period,
      });
    }
  } catch (err) {
    console.warn('[TabPocket] 创建心跳失败:', err);
  }
}

browser.runtime.onInstalled.addListener(() => void ensureHeartbeat());
browser.runtime.onStartup.addListener(() => void ensureHeartbeat());
void ensureHeartbeat();

// 让 idle.onStateChanged 与 idle.queryState 用同一个阈值（默认 60 秒太容易误判）
try {
  (browser.idle as unknown as { setDetectionInterval?: (s: number) => void })
    .setDetectionInterval?.(IDLE_THRESHOLD_S);
} catch {
  /* 忽略 */
}

// ============================================================
// M2 右键菜单收藏
// ============================================================
// 菜单文案跟随语言设置：语言切换后重建一次
async function rebuildContextMenu(): Promise<void> {
  try {
    await browser.contextMenus.removeAll();
  } catch {
    /* 首次安装时没有可移除的菜单 */
  }
  try {
    browser.contextMenus.create({
      id: 'tabpocket-add-bookmark',
      title: t('menu.addBookmark'),
      contexts: ['page'],
    });
  } catch {
    /* 重复创建时忽略 */
  }
}

void initI18n().then(rebuildContextMenu);
browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.langPref) void initI18n().then(rebuildContextMenu);
});browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'tabpocket-add-bookmark' && tab?.url) {
    void addBookmark(tab.url, tab.title ?? '').catch((err) =>
      console.warn('[TabPocket] 右键收藏失败:', err),
    );
  }
});

// ============================================================
// 消息路由
// ============================================================
browser.runtime.onMessage.addListener(
  (message: TabPocketMessage, _sender, sendResponse) => {
    void handleMessage(message)
      .then((result) => sendResponse({ success: true, ...result }))
      .catch((err) =>
        sendResponse({ success: false, error: String(err?.message ?? err) }),
      );
    return true; // 异步响应
  },
);

console.log('[TabPocket] background ready');

async function handleMessage(
  message: TabPocketMessage,
): Promise<Record<string, unknown>> {
  switch (message.type) {
    case 'COLLAPSE_TABS': {
      const { session, closedCount } = await collapseCurrentWindow();
      return { session, closedCount };
    }
    case 'RESTORE_SESSION': {
      const opened = await restoreSession(message.sessionId);
      return { opened };
    }
    case 'DELETE_SESSION': {
      await deleteSession(message.sessionId);
      return {};
    }
    case 'RENAME_SESSION': {
      await renameSession(message.sessionId, message.name);
      return {};
    }
    case 'LIST_SESSIONS': {
      const sessions = await loadSessions();
      return { sessions };
    }
    case 'OPEN_URL': {
      await browser.tabs.create({ url: message.url });
      return {};
    }
    case 'ADD_BOOKMARK': {
      const bookmark = await addBookmark(message.url, message.title, message.tags);
      return { bookmark };
    }
    case 'TRACK_STATUS': {
      const alarm = await browser.alarms.get(HEARTBEAT);
      const state = await readState();
      return {
        alarmExists: !!alarm,
        alarmPeriod: alarm?.periodInMinutes ?? null,
        state,
      };
    }
    case 'SETTLE_NOW': {
      // 页面主动要求结算一次：不用等心跳，也能验证计时链路是否通畅
      await flush();
      return { state: await readState() };
    }
    default:
      return {};
  }
}
