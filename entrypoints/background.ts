// ============================================================
// TabNest 后台（MV3 Service Worker，module 类型）
// 心跳计时（M3）+ 右键菜单收藏（M2）+ 消息路由（M1/M2/M3）
// ============================================================
import { browser } from 'wxt/browser';
import type { TabNestMessage } from '../src/types';
import { addBookmark } from '../src/utils/bookmarks';
import {
  collapseCurrentWindow,
  deleteSession,
  loadSessions,
  renameSession,
  restoreSession,
} from '../src/utils/sessions';

// --- M3: 心跳计时，每分钟累加当前活动标签的停留时长 ---
browser.alarms.create('heartbeat', { periodInMinutes: 1 });
browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'heartbeat') {
    // TODO(M3): 累计当前活动标签停留时长 → IndexedDB visits 表
  }
});

// --- M2: 右键菜单收藏 ---
browser.contextMenus.create({
  id: 'tabnest-add-bookmark',
  title: '收藏此页面到 TabNest',
  contexts: ['page'],
});
browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'tabnest-add-bookmark' && tab?.url) {
    void addBookmark(tab.url, tab.title ?? '').catch((err) =>
      console.warn('[TabNest] 右键收藏失败:', err),
    );
  }
});

// --- 消息路由 ---
browser.runtime.onMessage.addListener(
  (message: TabNestMessage, _sender, sendResponse) => {
    void handleMessage(message)
      .then((result) => sendResponse({ success: true, ...result }))
      .catch((err) =>
        sendResponse({ success: false, error: String(err?.message ?? err) }),
      );
    return true; // 异步响应
  },
);

console.log('[TabNest] background ready');

async function handleMessage(
  message: TabNestMessage,
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
    default:
      return {};
  }
}
