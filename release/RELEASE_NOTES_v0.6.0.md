# TabPocket v0.6.0 · 中英双语

> 本地测试版，未推送 GitHub。

## 新增：完整英文界面

扩展现在有中文 / English 两套完整文案，**默认跟随浏览器界面语言**（浏览器是英文就用英文），也可以在「关于」页手动锁定语言。切换后所有页面立刻重绘，不用重启。

覆盖范围：

| 模块 | 是否已翻译 |
|---|---|
| 弹窗四个页签、按钮、空状态、提示语 | ✅ |
| 收拢页（会话卡片、展开列表、默认会话名） | ✅ |
| 收藏页（含待看、整理、备份、排序控件） | ✅ |
| 统计页（KPI、Top5、后台失联提示） | ✅ |
| 报表页（图例、诊断卡片、排除域名、确认弹窗） | ✅ |
| 收藏体检页（表格、诊断、CSV 表头、删除确认） | ✅ |
| 右键菜单「收藏此页面」 | ✅ 跟随语言设置，切换后自动重建 |
| 日期 / 时长 / 「3 小时前」等相对时间 | ✅ 按语言用 `zh-CN` / `en-US` |
| 扩展名称与简介（浏览器扩展列表里显示的） | ✅ 走 `_locales`，中英各一套 |

## 几个实现取舍

- **没有被翻译的是「数据」**：收藏标签的存储值仍是 `待看` / `常用` / `开发` 这类中文，因为你的历史数据里就是这些字符串。改存储值等于把老数据全废掉。所以改的是**显示层**：`displayTag()` 在渲染时翻译，英文界面看到的是 Read Later / Frequent / Dev / Finance…
- **英文单复数**：词典里用 `单数|复数` 写在一起，`t()` 按数量挑，所以是 "Collapsed 3 tabs" / "Collapsed 1 tab"，不是 "1 tabs"。
- **i18n 内核与 React 解耦**：`src/i18n/core.ts` 不引 React，Service Worker（background）也能安全用；`src/i18n/index.ts` 才提供 `useI18n()` 钩子。否则后台包会白白塞进 React。
- **manifest 走 `_locales`**：`name` / `description` 用 `__MSG_extName__` 占位，`default_locale: en`，中文浏览器自动读 `zh_CN`。这既是浏览器里显示名的本地化，也是两个商店列表语言回退的依据。

## 顺带修掉/补上的

- 收藏列表「按访问频次」排序的显示（v0.5.2 的收尾）
- 报表页图表在切换语言后会按新语言重绘（图表选项依赖语言）

## 验证

- `npm run compile` ✓
- `npm run build` ✓ —— 弹窗 15.2 kB / 体检页 9.3 kB / 报表页 557 kB（ECharts 未变） / 后台 5.6 kB
- `scripts/selftest-audit.mjs` 23 项 ✓、`scripts/selftest-background.mjs` 20 项 ✓（自测的 mock 补了 `storage.onChanged`）
- 产物 24 个文件，`_locales/en` + `_locales/zh_CN` 已打入，`manifest.json` 在 zip 根部（商店要求）

## 怎么更新

1. 「收藏 → 导出备份」存一份 JSON（习惯性保险）
2. 把 `release\TabPocket-v0.6.0\` 里的文件**覆盖**到你当前加载的目录
3. `edge://extensions` → TabPocket → **重新加载**

想看英文：关于页 → Language → English。

## 上架

配套写了 `release/PUBLISHING-GUIDE.md`：两个商店的账号注册、逐字段文案（可直接粘贴）、权限理由、数据使用声明、隐私政策部署、截图要求、更新流程。
