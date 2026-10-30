// ============================================================
// 后台计时引擎自测：mock 浏览器 API + 假 IndexedDB，跑真实 background.ts
// 运行：node scripts/selftest-background.mjs
// ============================================================
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// ---------- 假 IndexedDB（只实现 idb.ts 用到的子集） ----------
const tables = new Map(); // storeName -> Map(key -> value)

function makeRequest(exec) {
  const req = { onsuccess: null, onerror: null, result: undefined };
  setTimeout(() => {
    try {
      req.result = exec();
      req.onsuccess?.();
    } catch (e) {
      req.error = e;
      req.onerror?.();
    }
  }, 0);
  return req;
}

function fakeIndexedDB() {
  return {
    open() {
      const req = { onupgradeneeded: null, onsuccess: null, onerror: null, result: null };
      setTimeout(() => {
        const db = {
          objectStoreNames: { contains: (n) => tables.has(n) },
          createObjectStore(name) {
            tables.set(name, new Map());
            return { createIndex: () => ({}) };
          },
          transaction(name) {
            if (!tables.has(name)) tables.set(name, new Map());
            const data = tables.get(name);
            const tx = { oncomplete: null, onerror: null, onabort: null };
            let pending = 0;
            const done = () => {
              pending--;
              if (pending <= 0) setTimeout(() => tx.oncomplete?.(), 0);
            };
            const wrap = (fn) => {
              pending++;
              return makeRequest(fn);
            };
            tx.objectStore = () => ({
              get: (k) => wrap(() => data.get(k)),
              put: (v) => {
                pending++;
                data.set(v.key, structuredClone(v));
                setTimeout(() => done(), 0);
                return makeRequest(() => undefined);
              },
              count: () => wrap(() => data.size),
              clear: () => {
                pending++;
                data.clear();
                setTimeout(() => done(), 0);
                return makeRequest(() => undefined);
              },
              index: () => ({
                getAll: (range) =>
                  wrap(() =>
                    [...data.values()].filter(
                      (v) =>
                        !range ||
                        (v.date >= range.lower && v.date <= range.upper),
                    ),
                  ),
              }),
            });
            return tx;
          },
        };
        req.result = db;
        req.onupgradeneeded?.();
        req.onsuccess?.();
      }, 0);
      return req;
    },
  };
}

globalThis.indexedDB = fakeIndexedDB();
globalThis.IDBKeyRange = {
  bound: (lower, upper) => ({ lower, upper }),
};

// ---------- 假 chrome ----------
const event = () => {
  const hs = [];
  return {
    addListener: (f) => hs.push(f),
    _fire: (...args) => hs.forEach((f) => f(...args)),
    _count: () => hs.length,
  };
};

const localBag = {};
const sessionBag = {};
const mkStore = (bag) => ({
  get: async (k) => (typeof k === 'string' ? (k in bag ? { [k]: bag[k] } : {}) : { ...bag }),
  set: async (o) => Object.assign(bag, o),
  remove: async (k) => {
    delete bag[k];
  },
});

const tabs = new Map([
  [1, { id: 1, windowId: 1, url: 'https://github.com/a', title: 'GitHub' }],
  [2, { id: 2, windowId: 1, url: 'https://www.bilibili.com/v', title: 'Bilibili' }],
]);

const alarmsBag = new Map();
let activeTabId = 1;

globalThis.chrome = {
  storage: {
    local: mkStore(localBag),
    session: mkStore(sessionBag),
    onChanged: event(),
  },
  runtime: {
    onInstalled: event(),
    onStartup: event(),
    onMessage: event(),
    getURL: (p) => `chrome-extension://test/${p}`,
  },
  tabs: {
    onActivated: event(),
    onUpdated: event(),
    onRemoved: event(),
    get: async (id) => {
      const t = tabs.get(id);
      if (!t) throw new Error('no tab');
      return t;
    },
    query: async () => [tabs.get(activeTabId)],
    create: async () => ({}),
  },
  windows: { onFocusChanged: event(), WINDOW_ID_NONE: -1 },
  idle: { queryState: async () => 'active', onStateChanged: event() },
  alarms: {
    onAlarm: event(),
    create: async (name, info) => {
      alarmsBag.set(name, info);
    },
    get: async (name) => alarmsBag.get(name),
  },
  contextMenus: { create: () => {}, onClicked: event() },
  bookmarks: { getTree: async () => [], remove: async () => {} },
  history: { getVisits: async () => [] },
};

// ---------- 打包 background.ts ----------
const mockPath = join(mkdtempSync(join(tmpdir(), 'tp-')), 'browser.mjs');
writeFileSync(mockPath, 'export const browser = globalThis.chrome;\n');
const outFile = join(mkdtempSync(join(tmpdir(), 'tp-')), 'bg.mjs');
await build({
  entryPoints: [resolve(root, 'entrypoints/background.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: outFile,
  alias: { 'wxt/browser': mockPath },
  logLevel: 'error',
});

// 可控时钟：让 Date.now 跟着虚拟时间走
const clock = { now: Date.now() };
const realNow = Date.now;
Date.now = () => clock.now;

await import(pathToFileURL(outFile).href);
const tick = () => new Promise((r) => setTimeout(r, 80));

// ---------- 断言 ----------
let failed = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${label}${ok ? '' : `  期望 ${JSON.stringify(expected)} 实际 ${JSON.stringify(actual)}`}`);
};

await tick();

check('心跳 alarm 已创建', alarmsBag.has('tabpocket-heartbeat'), true);
check('计时事件监听已注册', chrome.tabs.onActivated._count(), 1);

// 1) 切到标签 1
chrome.tabs.onActivated._fire({ tabId: 1, windowId: 1 });
await tick();
check('切换标签后写入计时状态', !!sessionBag.trackState, true);
check('记录了一次访问', [...(tables.get('visits')?.values() ?? [])].reduce((s, b) => s + b.visits, 0), 1);

// 2) 61 秒后心跳结算
clock.now += 61_000;
chrome.alarms.onAlarm._fire({ name: 'tabpocket-heartbeat' });
await tick();
const buckets = [...(tables.get('visits')?.values() ?? [])];
const gh = buckets.find((b) => b.domain === 'github.com');
check('心跳结算写入停留时长', gh?.durationMs > 0, true);
check('时长接近 61 秒', Math.abs((gh?.durationMs ?? 0) - 61_000) < 2000, true);

// 3) 切换到标签 2：结算上一个 + 记录新域名
clock.now += 30_000;
activeTabId = 2;
chrome.tabs.onActivated._fire({ tabId: 2, windowId: 1 });
await tick();
const after = [...(tables.get('visits')?.values() ?? [])];
check('切换标签会结算上一个站点', after.find((b) => b.domain === 'github.com').durationMs > 61_000, true);
check('新站点也建了记录', after.some((b) => b.domain === 'bilibili.com'), true);

// 4) 窗口失焦：结算并清状态
clock.now += 20_000;
chrome.windows.onFocusChanged._fire(-1);
await tick();
check('失焦后清空计时状态', sessionBag.trackState, undefined);

// 5) SW 睡过（超长切片）应丢弃，不灌水
clock.now += 1_000;
activeTabId = 1;
chrome.tabs.onActivated._fire({ tabId: 1, windowId: 1 });
await tick();
const beforeSleep = [...(tables.get('visits')?.values() ?? [])].reduce((s, b) => s + b.durationMs, 0);
clock.now += 600_000; // 10 分钟
chrome.alarms.onAlarm._fire({ name: 'tabpocket-heartbeat' });
await tick();
const afterSleep = [...(tables.get('visits')?.values() ?? [])].reduce((s, b) => s + b.durationMs, 0);
check('超长切片被丢弃（挂机不灌水）', afterSleep - beforeSleep, 0);

// 6) 空闲状态不记账
clock.now += 1_000;
chrome.tabs.onActivated._fire({ tabId: 2, windowId: 1 });
await tick();
chrome.idle.queryState = async () => 'idle';
const beforeIdle = [...(tables.get('visits')?.values() ?? [])].reduce((s, b) => s + b.durationMs, 0);
clock.now += 60_000;
chrome.alarms.onAlarm._fire({ name: 'tabpocket-heartbeat' });
await tick();
const afterIdle = [...(tables.get('visits')?.values() ?? [])].reduce((s, b) => s + b.durationMs, 0);
check('空闲状态不计时长', afterIdle - beforeIdle, 0);

// 7) 同一标签重复通知不重复计访问
chrome.idle.queryState = async () => 'active';
const visitsBefore = [...(tables.get('visits')?.values() ?? [])].reduce((s, b) => s + b.visits, 0);
chrome.tabs.onActivated._fire({ tabId: 2, windowId: 1 }); // 同 tab 同 url
await tick();
const visitsAfter = [...(tables.get('visits')?.values() ?? [])].reduce((s, b) => s + b.visits, 0);
check('重复激活不重复计访问', visitsAfter, visitsBefore);

// ---------- 诊断消息 ----------
const sendMsg = (msg) =>
  new Promise((resolve) => {
    chrome.runtime.onMessage._fire(msg, {}, resolve);
  });

const statusRes = await sendMsg({ type: 'TRACK_STATUS' });
check('TRACK_STATUS 报告后台存活', statusRes.success, true);
check('TRACK_STATUS 报告心跳已注册', statusRes.alarmExists, true);
check('TRACK_STATUS 带出当前计时域名', statusRes.state?.domain, 'bilibili.com');

clock.now += 45_000;
const settleRes = await sendMsg({ type: 'SETTLE_NOW' });
await tick();
check('SETTLE_NOW 成功', settleRes.success, true);
const settled = [...(tables.get('visits')?.values() ?? [])]
  .filter((b) => b.domain === 'bilibili.com')
  .reduce((s, b) => s + b.durationMs, 0);
check('手动结算真的写入了时长', settled >= 45_000, true);

// ---------- 汇总查询（统计页面读的那条路） ----------
const statsOut = join(mkdtempSync(join(tmpdir(), 'tp-')), 'stats.mjs');
await build({
  entryPoints: [resolve(root, 'src/utils/stats.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: statsOut,
  alias: { 'wxt/browser': mockPath },
  logLevel: 'error',
});
const statsMod = await import(pathToFileURL(statsOut).href);

const summary = await statsMod.querySummary(7);
check('汇总能读回写入的数据', summary.totalMs > 0, true);
check('域名排行首位是 github.com', summary.byDomain[0]?.domain, 'github.com');
check('访问次数汇总 > 0', summary.byDomain.reduce((s, d) => s + d.visits, 0) > 0, true);

Date.now = realNow;
console.log(failed === 0 ? '\n全部通过 ✅' : `\n${failed} 项失败 ❌`);
process.exit(failed === 0 ? 0 : 1);
