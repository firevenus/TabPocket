// ============================================================
// 收藏体检逻辑自测（不依赖浏览器）
// 用 esbuild 把 src/utils/bookmarkAudit.ts 打包，把 wxt/browser 换成 mock
// 运行：node scripts/selftest-audit.mjs
// ============================================================
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// ---------- 假数据 ----------
const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const AGO = (d) => now - d * DAY;

/** url -> [{visitTime}] */
const visitsMock = {
  'https://github.com/firevenus/TabPocket': [
    { visitTime: AGO(2) },
    { visitTime: AGO(9) },
    { visitTime: AGO(40) },
    { visitTime: AGO(400) }, // 一年外，不该计入
  ],
  // 书签写 ..com，历史记录写 ..com/ → 应能匹配上
  'https://news.ycombinator.com/': [{ visitTime: AGO(1) }, { visitTime: AGO(5) }],
  'https://www.bilibili.com/video/BV1xx': [
    { visitTime: AGO(3) },
    { visitTime: AGO(3) },
    { visitTime: AGO(3) },
    { visitTime: AGO(3) },
    { visitTime: AGO(3) },
  ],
  // 带 hash 的书签 → 应去掉 hash 后匹配
  'https://developer.mozilla.org/en-US/docs/Web': [{ visitTime: AGO(7) }],
  'https://example.com/never': [],
};

const treeMock = [
  {
    id: '0',
    title: '',
    children: [
      {
        id: '1',
        title: '书签栏',
        children: [
          {
            id: '10',
            title: 'GitHub',
            url: 'https://github.com/firevenus/TabPocket',
            dateAdded: AGO(300),
          },
          {
            id: '11',
            title: '工具',
            children: [
              {
                id: '110',
                title: 'Hacker News',
                url: 'https://news.ycombinator.com', // 无结尾斜杠
                dateAdded: AGO(200),
              },
              {
                id: '111',
                title: 'MDN',
                url: 'https://developer.mozilla.org/en-US/docs/Web#intro', // 带 hash
                dateAdded: AGO(100),
              },
            ],
          },
        ],
      },
      {
        id: '2',
        title: '其他书签',
        children: [
          {
            id: '20',
            title: 'Bilibili',
            url: 'https://www.bilibili.com/video/BV1xx',
            dateAdded: AGO(50),
          },
          { id: '21', title: '从未打开', url: 'https://example.com/never', dateAdded: AGO(10) },
          { id: '22', title: '内部页', url: 'chrome://extensions', dateAdded: AGO(10) }, // 非 http，应剔除
          { id: '23', title: '重复项', url: 'https://github.com/firevenus/TabPocket' }, // 重复，应去掉
        ],
      },
    ],
  },
];

const storageMock = {};
globalThis.chrome = {
  bookmarks: {
    getTree: async () => treeMock,
    remove: async () => {},
  },
  history: {
    // 严格模仿 Chrome 的参数校验：getVisits 的 details 只接受 url，
    // 多传任何字段（如 startTime）都会抛 "Unexpected property"。
    getVisits: async (details) => {
      const keys = Object.keys(details ?? {});
      const extra = keys.find((k) => k !== 'url');
      if (extra) {
        throw new Error(
          `Error at parameter 'details': Unexpected property: '${extra}'.`,
        );
      }
      return visitsMock[details.url] ?? [];
    },
    search: async ({ startTime, endTime, maxResults } = {}) => {
      const items = Object.entries(visitsMock)
        .map(([url, list]) => {
          const times = list.map((v) => v.visitTime);
          return { url, visitCount: list.length, lastVisitTime: times.length ? Math.max(...times) : 0 };
        })
        .filter((it) => it.lastVisitTime > 0)
        .filter(
          (it) =>
            (startTime === undefined || it.lastVisitTime >= startTime) &&
            (endTime === undefined || it.lastVisitTime <= endTime),
        )
        .sort((a, b) => b.lastVisitTime - a.lastVisitTime);
      return items.slice(0, maxResults ?? 100);
    },
  },
  storage: {
    local: {
      get: async (k) => ({ [k]: storageMock[k] }),
      set: async (obj) => Object.assign(storageMock, obj),
    },
  },
  tabs: { create: async () => ({}) },
};

// ---------- 打包被测模块（wxt/browser → mock） ----------
const mockPath = join(mkdtempSync(join(tmpdir(), 'tp-')), 'browser.mjs');
writeFileSync(mockPath, 'export const browser = globalThis.chrome;\n');

const outFile = join(mkdtempSync(join(tmpdir(), 'tp-')), 'audit.mjs');
await build({
  entryPoints: [resolve(root, 'src/utils/bookmarkAudit.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: outFile,
  alias: { 'wxt/browser': mockPath },
  logLevel: 'error',
});

const mod = await import(pathToFileURL(outFile).href);

// ---------- 断言 ----------
let failed = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${label}${ok ? '' : `  期望 ${JSON.stringify(expected)} 实际 ${JSON.stringify(actual)}`}`);
};

const r = await mod.auditBookmarks({ days: 365 });

check('书签去重 + 剔除 chrome:// （5 条）', r.totalBookmarks, 5);
check('有访问 4 条 / 没访问 1 条', [r.visitedCount, r.deadCount], [4, 1]);
check('区间内总访问次数（3+2+5+1=11）', r.totalVisits, 11);
check(
  '排名自上而下',
  r.rows.map((x) => [x.domain, x.visits]),
  [
    ['bilibili.com', 5],
    ['github.com', 3],
    ['news.ycombinator.com', 2],
    ['developer.mozilla.org', 1],
    ['example.com', 0],
  ].filter(([d]) => r.rows.some((x) => x.domain === d)),
);
check('域名聚合首位', r.domains[0].domain, 'bilibili.com');
check('域名聚合访问数', r.domains.find((d) => d.domain === 'github.com').visits, 3);

const hn = r.rows.find((x) => x.domain === 'news.ycombinator.com');
check('结尾斜杠差异能匹配', hn.visits, 2);
const mdn = r.rows.find((x) => x.domain === 'developer.mozilla.org');
check('hash 锚点能匹配', mdn.visits, 1);
check('文件夹路径（嵌套）', r.rows.find((x) => x.title === 'MDN').folder, '工具');
check('一年外（400 天前）访问不计入', r.rows.find((x) => x.domain === 'github.com').visits, 3);

// 30 天区间：github 只剩 2 次（9 天、40 天前的不算，40 天前在区间外）
const r30 = await mod.auditBookmarks({ days: 30 });
check('区间切换生效（近 30 天 github=2）', r30.rows.find((x) => x.domain === 'github.com').visits, 2);
check('近 30 天没访问数', r30.deadCount, 1);

// 缓存读写
const cached = await mod.loadAuditCache();
check('缓存可读回，days 为最后一次扫描', cached?.days, 30);

// 旧版（全 0）缓存必须作废
storageMock.auditCache = { ...cached, schema: 1 };
check('旧 schema 缓存被丢弃', await mod.loadAuditCache(), null);

// 历史探针（诊断用）
check('探针：历史接口可用', r.probe?.ok, true);
check('探针：历史里有数据', r.probe?.hasHistory, true);
check('探针：无报错', r.visitError, undefined);

// 单条计数（收藏列表排序用）
const one = await mod.countVisits('https://www.bilibili.com/video/BV1xx', 365);
check('countVisits 近一年', one.visits, 5);
const oneShort = await mod.countVisits('https://github.com/firevenus/TabPocket', 30);
check('countVisits 区间切换', oneShort.visits, 2);

// CSV
const csv = mod.toCsv(r.rows.slice(0, 2), 365);
check('CSV 带 BOM', csv.charCodeAt(0), 0xfeff);
check('CSV 表头', csv.split('\r\n')[0].includes('访问次数'), true);
check('CSV 行数（表头 + 2）', csv.split('\r\n').length, 3);
const tricky = mod.toCsv(
  [{ ...r.rows[0], title: '含,逗号"引号', url: 'https://a.com/x' }],
  365,
);
check('CSV 转义', tricky.includes('"含,逗号""引号"'), true);

console.log(failed === 0 ? '\n全部通过 ✅' : `\n${failed} 项失败 ❌`);
process.exit(failed === 0 ? 0 : 1);
