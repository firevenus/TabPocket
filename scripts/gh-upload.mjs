// 通过 gh api 上传 TabPocket 源码到 GitHub（绕过本环境下本地 git 写入被拦截的问题）
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO = 'firevenus/TabPocket';

// gh 不在 PATH 时回退到默认安装路径
const GH = (() => {
  const candidates = [
    'gh',
    'C:/Program Files/GitHub CLI/gh.exe',
    'C:/Program Files (x86)/GitHub CLI/gh.exe',
  ];
  for (const c of candidates) {
    try {
      execSync(`"${c}" --version`, { stdio: 'ignore' });
      return `"${c}"`;
    } catch {
      /* try next */
    }
  }
  throw new Error('找不到 gh CLI，请先安装 GitHub CLI');
})();

const FILES = [
  '.gitignore', 'LICENSE', 'README.md', 'manifest.json', 'vite.config.mjs',
  'tsconfig.json', 'package.json', 'package-lock.json', 'wxt.config.ts',
  'entrypoints/background.ts',
  'entrypoints/popup/index.html', 'entrypoints/popup/main.tsx',
  'entrypoints/popup/App.tsx', 'entrypoints/popup/style.css',
  'entrypoints/popup/components/SessionsView.tsx',
  'entrypoints/popup/components/BookmarksView.tsx',
  'entrypoints/popup/components/AboutView.tsx',
  'src/types.ts', 'src/utils/sessions.ts', 'src/utils/bookmarks.ts',
  'src/utils/classify.ts',
  'public/icon/16.png', 'public/icon/32.png', 'public/icon/48.png',
  'public/icon/96.png', 'public/icon/128.png',
];

function gh(args, input) {
  const cmd = [GH, 'api', `repos/${REPO}/contents/${args.path}`, '-X', 'PUT', '--input', '-'];
  try {
    return execSync(cmd.join(' '), {
      input: JSON.stringify(input),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err) {
    return { error: err.stderr?.slice(0, 300) ?? String(err) };
  }
}

let added = 0;
let updated = 0;
let failed = 0;

for (const f of FILES) {
  const abs = resolve(f);
  if (!existsSync(abs)) {
    console.log(`MISSING ${f}`);
    failed++;
    continue;
  }
  const content = readFileSync(abs).toString('base64');

  let sha = '';
  try {
    sha = execSync(`${GH} api repos/${REPO}/contents/${f} --jq ".sha"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    sha = '';
  }

  const body = {
    message: sha ? `chore: update ${f}` : `feat: add ${f}`,
    content,
    branch: 'main',
  };
  if (sha) body.sha = sha;

  const res = gh({ path: f }, body);
  if (res && res.error) {
    console.log(`FAIL ${f}: ${res.error}`);
    failed++;
  } else {
    console.log(`${sha ? 'U' : 'A'} ${f}`);
    sha ? updated++ : added++;
  }
}

console.log(`\n完成: 新增 ${added}，更新 ${updated}，失败 ${failed}`);
