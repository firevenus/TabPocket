// ============================================================
// 极简 i18n 内核（不依赖 React，可被 Service Worker 安全引用）
// 文案在 messages.ts，React 侧用 index.ts 的 useI18n()
// ============================================================
import { browser } from 'wxt/browser';
import { en, zh, type MsgKey } from './messages';

export type Lang = 'zh' | 'en';
/** auto = 跟随浏览器界面语言 */
export type LangPref = 'auto' | Lang;

export type { MsgKey };

const STORAGE_KEY = 'langPref';
const DICTS: Record<Lang, Record<MsgKey, string>> = { zh, en };

function browserLang(): Lang {
  let ui = '';
  try {
    ui = browser.i18n?.getUILanguage?.() ?? '';
  } catch {
    /* 某些上下文里不可用 */
  }
  if (!ui) ui = typeof navigator !== 'undefined' ? navigator.language : 'en';
  return ui.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

let pref: LangPref = 'auto';
let currentLang: Lang = browserLang();

const listeners = new Set<() => void>();

function emit(): void {
  try {
    document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';
  } catch {
    /* 非 DOM 环境（自测脚本 / SW）忽略 */
  }
  listeners.forEach((fn) => fn());
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getLang(): Lang {
  return currentLang;
}

export function getLangPref(): LangPref {
  return pref;
}

/** 当前语言对应的 BCP 47 locale，用于 toLocaleString / toLocaleDateString */
export function locale(): string {
  return currentLang === 'zh' ? 'zh-CN' : 'en-US';
}

export function t(
  key: MsgKey,
  params?: Record<string, string | number>,
  count?: number,
): string {
  const dict = DICTS[currentLang] ?? zh;
  let s = dict[key] ?? zh[key] ?? key;
  // 英文单复数：词典里用 `单数|复数` 表示
  if (s.includes('|')) {
    const parts = s.split('|');
    s = count === 1 ? (parts[0] ?? s) : (parts[parts.length - 1] ?? s);
  }
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}

export async function setLangPref(next: LangPref): Promise<void> {
  pref = next;
  currentLang = next === 'auto' ? browserLang() : next;
  emit();
  try {
    await browser.storage.local.set({ [STORAGE_KEY]: next });
  } catch {
    /* 存储失败不影响本次会话 */
  }
}

/** 每个入口（popup / 报表页 / 体检页 / 后台）启动时调用一次 */
export async function initI18n(): Promise<void> {
  let saved: LangPref = 'auto';
  try {
    const data = await browser.storage.local.get(STORAGE_KEY);
    const v = data[STORAGE_KEY];
    if (v === 'zh' || v === 'en' || v === 'auto') saved = v;
  } catch {
    /* 读不到就用自动 */
  }
  pref = saved;
  currentLang = saved === 'auto' ? browserLang() : saved;
  emit();
}

/** 不需要订阅语言变化的地方（Service Worker、工具函数）直接用 */
export { t as translate };
