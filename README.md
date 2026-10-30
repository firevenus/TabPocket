# TabPocket · 页袋

[![Release](https://img.shields.io/github/v/release/firevenus/TabPocket?label=release)](https://github.com/firevenus/TabPocket/releases)
[![License](https://img.shields.io/github/license/firevenus/TabPocket)](LICENSE)
[![Manifest](https://img.shields.io/badge/manifest-v3-blue)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![Local-first](https://img.shields.io/badge/data-100%25%20local-brightgreen)](#)

> 把网页**收进口袋**，需要时再掏出来。
> 标签收拢 · 收藏整理 · 待看 · 浏览统计 —— 一个浏览器扩展搞定。
> Manifest V3 · 数据 100% 本地 · 无需账号 · 开源免费 · 中英双语

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

### 🔍 收藏体检（新增）
- 一键扫描浏览器**全部原生书签**，对照历史记录统计每个收藏页在**近 30 天 / 90 天 / 1 年**内被打开了多少次
- 按访问频次排行，直接看出「收藏了但一年没碰过」的有哪些
- **按页面 / 按网站**两种视角，可按访问次数、最近访问、收藏时间排序，支持搜索和「有访问 / 没访问」筛选
- 每条可单独打开或从浏览器书签里删除（会二次确认），支持导出 CSV 清单
- 扫描结果本地缓存，重开页面秒出，不必每次重扫

### 📊 浏览统计（时间追踪式）
- 后台每 60 秒结算一次停留时长，切换标签 / 窗口时**即时结算**，切到别的应用自动停表
- 空闲超过 60 秒、锁屏、非 http(s) 页面**不计入**，不会把挂机时间刷进去
- 弹窗概览：累计 / 日均 / 活跃站点 / 常去站点 Top 5
- 完整报表页：**日历热力图** + **域名排行 Top 12** + **24 小时分布**
- 排除域名名单：不想被统计的站点（支持子域匹配）一键排除
- 数据存 IndexedDB，按「日期 + 小时 + 域名」聚合，不会随使用时间膨胀失控

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
React 19 · TypeScript · Vite 8 · WXT（浏览器 API 封装）· chrome.storage · IndexedDB · ECharts 6

### 项目结构
```
manifest.json                     # MV3 清单（手写维护）
vite.config.mjs                   # 手动 Vite 构建（四个入口：popup / stats / audit / background）
src/
  types.ts                        # 核心类型与消息协议
  utils/
    sessions.ts                   # 会话收拢 / 恢复 / 管理
    bookmarks.ts                  # 收藏 CRUD / 搜索 / 备份 / 一键整理 / 待看
    bookmarkAudit.ts              # 收藏体检：书签扁平化 + 历史访问计数 + 域名聚合 + CSV
    classify.ts                   # 域名自动分类规则
    stats.ts                      # 统计：写入聚合 / 区间汇总 / 设置 / 格式化
    idb.ts                        # IndexedDB 极简封装（零依赖）
  i18n/
    messages.ts                 # zh / en 文案词典（英文单复数用 `单数|复数`）
    core.ts                     # 无 React 的 i18n 内核：t / locale / 语言持久化
    index.ts                    # useI18n() 钩子（订阅语言变化）
    tags.ts                     # 存储标签（待看/常用/分类）→ 当前语言显示名
entrypoints/
  background.ts                   # Service Worker：心跳计时 + 右键菜单 + 消息路由
  popup/                          # 弹出面板（收拢 / 收藏 / 统计 / 关于 四页签）
    App.tsx                       # 页签外壳
    components/
      SessionsView.tsx            # 收拢页（含会话展开、单标签打开）
      BookmarksView.tsx           # 收藏页（含待看、整理浏览器收藏、收藏体检入口、备份）
      StatsView.tsx               # 统计概览页（KPI + Top 5 + 打开报表）
      AboutView.tsx               # 关于页（版本 / 开源地址 / 反馈入口）
  stats/                          # 独立报表页（新标签打开，ECharts 只在此加载）
    StatsApp.tsx                  # 日历热力图 / 域名排行 / 24 小时分布 / 排除域名
  audit/                          # 独立收藏体检页（新标签打开）
    AuditApp.tsx                  # 区间访问频次排行 / 按页面或按网站 / 筛选排序 / CSV
_locales/                         # 扩展名称/简介的多语言（manifest 用 __MSG_*__）
assets/icon.svg                   # 图标源文件（128×128 画布，改图标只改这一个文件）
public/icon/                      # 图标产物：16/32/48/96/128.png（由脚本生成，勿手改）
docs/privacy.html                 # 隐私政策页（商店提交需要 URL）
scripts/
  build-icons.py                  # 从 assets/icon.svg 生成各尺寸 PNG（Edge 无头渲染）
  selftest-audit.mjs              # 收藏体检逻辑自测（mock 浏览器 API，node 直接跑）
  selftest-background.mjs         # 计时引擎自测（mock chrome + 假 IndexedDB + 可控时钟）
```

## Roadmap

- [x] M0 项目骨架
- [x] M1 标签收拢（含会话展开、单标签打开）
- [x] M2 收藏 + 一键整理 + 备份 + 待看
- [x] 关于页（版本号 / GitHub 仓库 / 反馈入口）
- [x] M3 浏览统计（停留时长心跳 + 日历热力图 + 域名排行 + 24 小时分布 + 排除域名）
- [x] M3.5 收藏体检（书签访问频次排行 · 按页面/网站 · CSV 导出）
- [x] 中英双语（跟随浏览器语言，可在关于页切换）
- [ ] M4 打磨：设置页（含每日自动收拢、统计开关）、会话数据纳入备份、Edge/Chrome 商店上架
- [ ] M5 整理增强：URL 层级分组、死链检测、按时间线分组
- [ ] M6 可选：Google Drive 同步（本地优先 + 可选云同步，无自家服务器）

> M5/M6 的功能思路借鉴自社区同类项目（jmu/tabnest、nayanswami/tabnest、OffBy1-tech/TabNest）。

## License

[MIT](LICENSE) © 2026 Enki Yan (firevenus)
