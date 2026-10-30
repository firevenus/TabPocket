# TabPocket · 页袋

[![Release](https://img.shields.io/github/v/release/firevenus/TabPocket?label=release)](https://github.com/firevenus/TabPocket/releases)
[![License](https://img.shields.io/github/license/firevenus/TabPocket)](LICENSE)
[![Manifest](https://img.shields.io/badge/manifest-v3-blue)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![Local-first](https://img.shields.io/badge/data-100%25%20local-brightgreen)](#)

> 把网页**收进口袋**，需要时再掏出来。
> 标签收拢 · 收藏整理 · 待看 · 浏览统计 —— 一个浏览器扩展搞定。
> Manifest V3 · 数据 100% 本地 · 无需账号 · 开源免费

---

## 它能做什么

### 🗂️ 标签收拢（OneTab 式）
- 一键把当前窗口所有标签收拢成会话，还你一个干净的浏览器
- 会话自动命名（时间 + 标签数），随时单条/批量恢复
- **展开会话看清单个标签，点一下就单独打开**，不用整批恢复
- 双击即可重命名，重启浏览器数据不丢

### ⭐ 收藏 + 一键整理（Raindrop 式）
- 一键收藏当前页 / 右键菜单收藏
- 标题、网址、标签实时搜索，标签筛选
- **整理浏览器收藏**：一键导入浏览器原生收藏 → 自动分类（开发 / 金融财经 / 视频 / 购物 / 新闻…）→ 访问频率最高的网站自动标记「常用」
- 导出 / 导入 JSON 备份，防清理工具误删

### 📌 待看（稍后阅读）
- 遇到想看的先「加入待看」丢进口袋，不打断当前节奏
- 无聊 / 没方向时，点一下「待看」分类慢慢翻
- 看完一键移出，收藏本身保留

### 📊 浏览统计（时间追踪式）
- 后台自动记录每个网站的停留时长（计划中，见 Roadmap）
- 日历热力图 + 域名排行 + 时段分析（计划中）

**数据 100% 存在本地**（chrome.storage / IndexedDB），不上传任何服务器，没有账号，没有广告。

## 安装

### 直接下载（最快，无需 Node.js）
1. 到 [Releases](https://github.com/firevenus/TabPocket/releases) 下载最新的 `TabPocket-v*-edge.zip` 并解压
2. Edge / Chrome 打开 `edge://extensions`（或 `chrome://extensions`）
3. 开启左下角「开发人员模式」
4. 点「加载解压缩的扩展」，选择解压出来的 `chrome-mv3` 文件夹
5. 点工具栏 TabPocket 图标开始使用

### 从源码构建
```bash
npm install
npm run build     # 构建 → dist/chrome-mv3
```
然后在扩展管理页加载 `dist/chrome-mv3` 目录。

> 正式上架 Edge/Chrome 商店后可直接一键安装（见 Roadmap）。

## 开发

```bash
npm install        # 安装依赖
npm run build      # 构建 → dist/chrome-mv3
npm run compile    # TypeScript 类型检查
```

### 技术栈
React 19 · TypeScript · Vite 8 · WXT（浏览器 API 封装）· chrome.storage · IndexedDB（规划中）· ECharts（规划中）

### 项目结构
```
manifest.json                     # MV3 清单（手写维护）
vite.config.mjs                   # 手动 Vite 构建（双入口 popup + background）
src/
  types.ts                        # 核心类型与消息协议
  utils/
    sessions.ts                   # 会话收拢 / 恢复 / 管理
    bookmarks.ts                  # 收藏 CRUD / 搜索 / 备份 / 一键整理 / 待看
    classify.ts                   # 域名自动分类规则
entrypoints/
  background.ts                   # Service Worker：心跳计时 + 右键菜单 + 消息路由
  popup/                          # 弹出面板（收拢 / 收藏 / 统计 / 关于 四页签）
    App.tsx                       # 页签外壳
    components/
      SessionsView.tsx            # 收拢页（含会话展开、单标签打开）
      BookmarksView.tsx           # 收藏页（含待看、整理浏览器收藏、备份）
      AboutView.tsx               # 关于页（版本 / 开源地址 / 反馈入口）
```

## Roadmap

- [x] M0 项目骨架
- [x] M1 标签收拢（含会话展开、单标签打开）
- [x] M2 收藏 + 一键整理 + 备份 + 待看
- [x] 关于页（版本号 / GitHub 仓库 / 反馈入口）
- [ ] M3 浏览统计（停留时长 + 日历热力图 + 域名排行 + 时段分析）
- [ ] M4 打磨：设置页（含每日自动收拢）、会话数据纳入备份、Edge/Chrome 商店上架
- [ ] M5 整理增强：URL 层级分组、死链检测、按时间线分组
- [ ] M6 可选：Google Drive 同步（本地优先 + 可选云同步，无自家服务器）

> M5/M6 的功能思路借鉴自社区同类项目（jmu/tabnest、nayanswami/tabnest、OffBy1-tech/TabNest）。

## License

[MIT](LICENSE) © 2026 Enki Yan (firevenus)
