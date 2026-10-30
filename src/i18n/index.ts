// ============================================================
// React 侧 i18n：useI18n() 返回 t 并订阅语言变化
// 内核在 core.ts（无 React 依赖），工具函数与 Service Worker 用 core
// ============================================================
import { useEffect, useState } from 'react';
import {
  getLang,
  getLangPref,
  setLangPref,
  subscribe,
  t,
  type Lang,
  type LangPref,
} from './core';

export * from './core';

export function useI18n(): {
  t: typeof t;
  lang: Lang;
  pref: LangPref;
  setPref: (p: LangPref) => Promise<void>;
} {
  const [, force] = useState(0);
  useEffect(() => subscribe(() => force((n) => n + 1)), []);
  return { t, lang: getLang(), pref: getLangPref(), setPref: setLangPref };
}
