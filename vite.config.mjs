// ============================================================
// TabPocket 手动 Vite 构建配置（绕开 WXT build 的环境兼容问题）
// 输出：dist/chrome-mv3（popup.html + background.js + chunks + icons + manifest.json）
// ============================================================
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, 'dist/chrome-mv3');

// 输出目录若存在（可能有被锁文件导致删除失败），先重命名避开
function clearOutDir() {
  return {
    name: 'clear-out-dir',
    buildStart() {
      if (existsSync(outDir)) {
        const backup = `${outDir}-old-${Date.now()}`;
        try {
          renameSync(outDir, backup);
          console.log(`[build] 旧输出目录已移走: ${backup}`);
        } catch (err) {
          console.warn('[build] 无法移走旧输出目录:', err.message);
        }
      }
    },
  };
}

function copyStaticAndManifest() {
  return {
    name: 'copy-static-and-manifest',
    closeBundle() {
      // popup HTML：从 entrypoints/popup/index.html 移到根目录 popup.html
      const srcHtml = resolve(outDir, 'entrypoints/popup/index.html');
      const destHtml = resolve(outDir, 'popup.html');
      if (existsSync(srcHtml)) {
        renameSync(srcHtml, destHtml);
      }
      // 统计报表页：从 entrypoints/stats/index.html 移到根目录 stats.html
      const srcStats = resolve(outDir, 'entrypoints/stats/index.html');
      const destStats = resolve(outDir, 'stats.html');
      if (existsSync(srcStats)) {
        renameSync(srcStats, destStats);
      }
      // 收藏体检页：从 entrypoints/audit/index.html 移到根目录 audit.html
      const srcAudit = resolve(outDir, 'entrypoints/audit/index.html');
      const destAudit = resolve(outDir, 'audit.html');
      if (existsSync(srcAudit)) {
        renameSync(srcAudit, destAudit);
      }
      // 图标
      mkdirSync(resolve(outDir, 'icon'), { recursive: true });
      for (const f of ['16.png', '32.png', '48.png', '96.png', '128.png']) {
        copyFileSync(resolve(__dirname, 'public/icon', f), resolve(outDir, 'icon', f));
      }
      // 多语言资源（manifest 的 __MSG_*__ 与商店列表语言回退靠它）
      const srcLocales = resolve(__dirname, '_locales');
      if (existsSync(srcLocales)) {
        cpSync(srcLocales, resolve(outDir, '_locales'), { recursive: true });
      }
      // manifest
      const manifest = JSON.parse(readFileSync(resolve(__dirname, 'manifest.json'), 'utf8'));
      writeFileSync(resolve(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    },
  };
}

export default defineConfig({
  plugins: [clearOutDir(), react(), copyStaticAndManifest()],
  build: {
    outDir,
    emptyOutDir: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'entrypoints/popup/index.html'),
        stats: resolve(__dirname, 'entrypoints/stats/index.html'),
        audit: resolve(__dirname, 'entrypoints/audit/index.html'),
        background: resolve(__dirname, 'entrypoints/background.ts'),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
