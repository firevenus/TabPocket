# TabNest · 标签收拢 / 收藏整理 / 浏览统计 三合一

> 一个把**乱掉的标签页收起来**、把**收藏自动整理好**、还能**看清自己每天时间去哪了**的浏览器扩展。
> Manifest V3 · 数据 100% 本地 · 无需账号 · 开源免费

---

## 它能做什么

### 🗂️ 会话收拢（OneTab 式）
- 一键把当前窗口所有标签收拢成会话，还你一个干净的浏览器
- 会话自动命名（时间 + 标签数），随时单条/批量恢复
- 双击即可重命名，重启浏览器数据不丢

### ⭐ 书签收藏 + 一键整理（Raindrop 式）
- 一键收藏当前页 / 右键菜单收藏
- 标题、网址、标签实时搜索，标签筛选
- **整理浏览器收藏**：一键导入浏览器原生收藏 → 自动分类（开发 / 金融财经 / 视频 / 购物 / 新闻…）→ 访问频率最高的网站自动标记「常用」
- 导出 / 导入 JSON 备份，防清理工具误删

### 📊 浏览统计（时间追踪式）
- 后台自动记录每个网站的停留时长（计划中，Roadmap）
- 日历热力图 + 域名排行 + 时段分析（计划中）

**数据 100% 存在本地**（chrome.storage / IndexedDB），不上传任何服务器，没有账号，没有广告。

## 安装

### Edge（推荐）
1. 打开 `edge://extensions`
2. 开启左下角「开发人员模式」
3. 点「加载解压缩的扩展」，选择构建产物目录：
   ```
   dist/chrome-mv3
   ```
4. 点工具栏 TabNest 图标开始使用

### Chrome
同样方式：`chrome://extensions` → 开发者模式 → 加载已解压 → 选择 `dist/chrome-mv3`

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
    bookmarks.ts                  # 收藏 CRUD / 搜索 / 备份 / 一键整理
    classify.ts                   # 域名自动分类规则
entrypoints/
  background.ts                   # Service Worker：心跳计时 + 右键菜单 + 消息路由
  popup/                          # 弹出面板（收拢 / 收藏 / 统计 三页签）
```

## Roadmap

- [x] M0 项目骨架
- [x] M1 会话收拢
- [x] M2 书签收藏 + 一键整理 + 备份
- [ ] M3 浏览统计（停留时长 + 热力图 + 排行榜）
- [ ] M4 打磨：设置页、Edge/Chrome 商店上架
- [ ] 会话数据纳入备份范围

## License

[MIT](LICENSE) © 2026 Enki Yan (firevenus)
