import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  outDir: 'extension-dist',
  manifest: {
    name: 'TabPocket',
    description: '标签收拢 · 收藏整理 · 待看 · 浏览统计',
    permissions: ['tabs', 'storage', 'alarms', 'contextMenus', 'unlimitedStorage'],
  },
});
