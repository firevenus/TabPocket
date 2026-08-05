// ============================================================
// TabPocket 手动 Vite 构建配置（绕开 WXT build 的环境兼容问题）
// 输出：dist/chrome-mv3（popup.html + background.js + chunks + icons + manifest.json）
// ============================================================
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {
  copyFileSync,
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
      // 图标
      mkdirSync(resolve(outDir, 'icon'), { recursive: true });
      for (const f of ['16.png', '32.png', '48.png', '96.png', '128.png']) {
        copyFileSync(resolve(__dirname, 'public/icon', f), resolve(outDir, 'icon', f));
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
