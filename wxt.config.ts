import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  outDir: 'extension-dist',
  manifest: {
    name: 'TabNest',
    description: '会话收拢 · 书签收藏 · 浏览统计 三合一',
    permissions: ['tabs', 'storage', 'alarms', 'contextMenus', 'unlimitedStorage'],
  },
});
