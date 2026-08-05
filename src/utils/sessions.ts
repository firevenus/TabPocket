// ============================================================
// 会话收拢模块（M1）：一键收拢标签 → 保存会话 → 恢复/删除/重命名
// 存储：chrome.storage.local，key = 'sessions'
// ============================================================
import { browser } from 'wxt/browser';
import type { Session, SessionTab } from '../types';

const KEY = 'sessions';

// ---------- 存储 ----------
export async function loadSessions(): Promise<Session[]> {
  const data = await browser.storage.local.get(KEY);
  return (data[KEY] as Session[] | undefined) ?? [];
}

async function saveSessions(sessions: Session[]): Promise<void> {
  await browser.storage.local.set({ [KEY]: sessions });
}

// ---------- 工具 ----------
function isValidTabUrl(url: string | undefined): url is string {
  if (!url) return false;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
  if (url.startsWith('chrome://') || url.startsWith('edge://')) return false;
  if (url.startsWith('devtools://') || url.startsWith('about:')) return false;
  return true;
}

function defaultName(count: number): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())} · ${count} 个标签`;
}

// ---------- 收拢 ----------
export interface CollapseResult {
  session: Session;
  closedCount: number;
}

/**
 * 收拢当前窗口所有可收拢标签（跳过固定页/内部页），
 * 保留一个活动标签防止窗口被关闭，其余存入新会话并关闭。
 */
export async function collapseCurrentWindow(): Promise<CollapseResult> {
  const tabs = await browser.tabs.query({ currentWindow: true });
  const collapsible = tabs.filter(
    (t) => t.id != null && !t.pinned && isValidTabUrl(t.url),
  );

  if (collapsible.length === 0) {
    throw new Error('当前窗口没有可收拢的标签');
  }

  // 保留一个标签，避免窗口全关：优先保留当前活动标签
  const activeTab = tabs.find((t) => t.active && t.id != null);
  const keepId =
    activeTab && !activeTab.pinned && activeTab.id != null && isValidTabUrl(activeTab.url)
      ? activeTab.id
      : collapsible[0]!.id!;

  const toClose = collapsible.filter((t) => t.id !== keepId);

  const session: Session = {
    id: crypto.randomUUID(),
    name: defaultName(toClose.length),
    tabs: toClose.map(
      (t): SessionTab => ({ title: t.title ?? '', url: t.url ?? '' }),
    ),
    tabCount: toClose.length,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  if (session.tabs.length === 0) {
    throw new Error('没有可收拢的标签');
  }

  const sessions = await loadSessions();
  sessions.unshift(session); // 最新的放最前
  await saveSessions(sessions);

  const ids = toClose.map((t) => t.id!);
  await browser.tabs.remove(ids);

  return { session, closedCount: session.tabs.length };
}

// ---------- 会话 CRUD ----------
export async function deleteSession(id: string): Promise<void> {
  const sessions = await loadSessions();
  await saveSessions(sessions.filter((s) => s.id !== id));
}

export async function renameSession(id: string, name: string): Promise<void> {
  const sessions = await loadSessions();
  const target = sessions.find((s) => s.id === id);
  if (target) {
    const trimmed = name.trim();
    if (trimmed) {
      target.name = trimmed;
      target.updatedAt = Date.now();
      await saveSessions(sessions);
    }
  }
}

export async function restoreSession(id: string): Promise<number> {
  const sessions = await loadSessions();
  const target = sessions.find((s) => s.id === id);
  if (!target) throw new Error('会话不存在');

  let opened = 0;
  for (const t of target.tabs) {
    if (isValidTabUrl(t.url)) {
      await browser.tabs.create({ url: t.url, active: false });
      opened++;
    }
  }
  return opened;
}
