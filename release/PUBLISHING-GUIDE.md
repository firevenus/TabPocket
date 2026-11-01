# TabPocket 上架指南（Chrome 网上应用店 + Edge 加载项）

> 适用版本：v0.6.1（已做中英双语）
> 本文所有文案可直接复制粘贴。素材、文案、权限理由都在这里，不用再翻别处。

---

## 0. 上架前必须先有的东西

| 项目 | 状态 | 说明 |
|---|---|---|
| 打包好的 zip | ✅ 已校验 | `release/TabPocket-v0.6.1.zip`（296 KB / 24 个文件，`manifest.json` 在根部，无源码无 map） |
| **可直接粘贴的文案** | ✅ 已有 | `release/store/listing-en.txt`、`release/store/listing-zh_CN.txt` —— 按后台字段顺序编号，逐块复制 |
| 128×128 图标 | ✅ 已有 | `public/icon/128.png`，商店里要单独再传一次 |
| 截图 ≥1 张（1280×800 或 640×400） | ⚠️ 要自己截 | 见 §5，PNG 或 24 位 JPG，**不能带透明通道** |
| 商店短描述 ≤132 字符 | ✅ 已有 | `listing-en.txt` `[02]` / `listing-zh_CN.txt` `[02]` |
| 详细描述 | ✅ 已有 | 同上文件 `[03]`，中英各一份 |
| 单一用途说明（Single purpose） | ✅ 已有 | `listing-en.txt` `[07]`，本文 §1.5 有同样内容 |
| 每个权限的理由 | ✅ 已有 | `listing-en.txt` `[08]`（8 条），本文 §1.5 有表格版 |
| 隐私政策 URL | ✅ 已上线 | https://firevenus.github.io/TabPocket/privacy.html （见 §4） |
| Google 账号 + 两步验证 + $5 | ⚠️ 要准备 | 一次性，账号级，不是每个扩展收 |
| Microsoft 账号（Outlook/Hotmail） | ⚠️ 要准备 | Edge 免费 |

> 两份 txt 是**粘贴源**（按后台字段顺序编号，标了每处的字符数与限制），本指南是**理解用**（讲清为什么这么填、哪里容易被打回）。两边内容应当一致 —— 改文案时先改 txt，再同步本文。

⚠️ **重要提醒**：上架后扩展 ID 会变（商店签名 ≠ 本地加载的 ID），**本地试用版里的会话/收藏/统计带不过去**。上架前先让试用用户导出备份。你自己的数据也一样。

---

## 1. Chrome 网上应用店

**开发者后台**：https://chrome.google.com/webstore/devconsole
**政策文档**：https://developer.chrome.com/docs/webstore/program-policies
**费用**：一次性 5 美元（账号级，之后发多少个扩展都不再收）

### 1.0 后台逐字段填写顺序（照这个顺序走一趟，不用来回翻）

后台左侧是四个页签 + 提交页。**括号里的 `[NN]` 是 `release/store/listing-en.txt` 里的块号**，去那里整块复制。

| # | 页签 → 字段 | 填什么 | 取自 |
|---|---|---|---|
| 1 | **Package**（上传后只读） | 核对版本号是否为 `0.6.1` | — |
| 2 | **Store listing → Name** | `TabPocket — Tab & Bookmark Manager` | `[01]` |
| 3 | **Store listing → Summary** | 130 字符那句（上限 132） | `[02]` |
| 4 | **Store listing → Description** | 长文，1,818 字符（上限 16,000） | `[03]` |
| 5 | **Store listing → Category** | `Productivity` | `[04]` |
| 6 | **Store listing → Language** | `English`（主语言，另有中文页另填） | `[05]` |
| 7 | **Store listing → 图片** | 图标 128×128、截图 1–5 张、宣传图可选 | `[12]` |
| 8 | **Privacy practices → Single purpose** | 一句话 | `[07]` |
| 9 | **Privacy practices → Permission justification** | **8 个权限各一个输入框**，逐个粘贴 | `[08]` |
| 10 | **Privacy practices → Remote code** | `No, I am not using remote code` | `[14]` |
| 11 | **Privacy practices → Data usage 分类** | 勾 **Web history** + **User activity**，其余全不勾 | `[09]` |
| 12 | **Privacy practices → Data usage 说明** | 两段英文 | `[10]` |
| 13 | **Privacy practices → 三项认证** | 全部勾选 | `[11]` |
| 14 | **Privacy practices → Privacy policy URL** | `https://firevenus.github.io/TabPocket/privacy.html` | `[06]` |
| 15 | **Distribution** | Visibility `Public` · Regions `All` · Pricing `Free` · Trader `Non-trader` | `[13]` |
| 16 | **Test instructions**（可选） | 审核员操作指引 | `[17]` |
| 17 | **Submit for review** | 确认弹窗里可勾「审核通过后先暂存，手动发布」 | — |

> ⚠️ 两个最容易卡住的地方：**第 9 步是 8 个独立输入框**（少填一个就会被打回），**第 11 步的分类勾选**比说明文字更重要 —— 说明写"本地处理"不能替代勾选。

### 1.1 注册开发者账号

1. 打开上面的开发者后台，用 Google 账号登录
2. 同意开发者协议 → 支付 5 美元（需要信用卡/借记卡）
3. 账号层面必须补的三件事，否则后面发不出去：
   - **开启两步验证**（Google 账号 → 安全性），不开会被拦
   - **验证联系邮箱**
   - **设置发布者显示名称**（用户看到的「开发者」，建议填 `Enki Yan` 或品牌名，别用邮箱前缀）
4. 声明 **trader / non-trader**（欧盟 DSA 要求）。个人免费扩展一般选 non-trader；选 trader 会公开联系信息
5. 可选：验证你的网站域名，能拿到「已验证发布者」标记

### 1.2 上传包

1. 后台右上角 **New item**（新项目）
2. 拖入 `release/TabPocket-v0.6.1.zip`（两个店用**同一个包**，不需要分别打包）
3. 上传后会出现 Store listing / Privacy / Distribution 三个页签

### 1.3 名称

> **TabPocket — Tab & Bookmark Manager**（35 字符，上限 45）

### 1.4 描述

> 可粘贴版在 `release/store/listing-en.txt`（`[02]` 摘要、`[03]` 详细描述）和 `listing-zh_CN.txt`。**本节文本与 txt 保持一致**；改文案时两边都要改，别只改一处。

**Summary（≤132 字符，本句 130 字符）**

⚠️ 这句与 `_locales/en/messages.json` 的 `extDesc` **必须相同** —— Edge 的短描述直接读 manifest，两处不一致会出现「Chrome 商店说的和 Edge 装完看到的不一样」。

```
Collapse tabs into sessions, clean up and audit bookmarks, save pages for later, and track browsing stats. 100% local, no account.
```

**Detailed description（英文）**

```
TabPocket is a local-first browser extension that keeps your tabs, bookmarks and browsing stats in one small pocket.

■ Collapse tabs into sessions
Close 30 open tabs in one click and get a tidy session card back. Expand the card to see every tab, open any single one, restore the whole session when you need it again. Sessions survive browser restarts.

■ Bookmarks, organised
Bookmark the current page or right-click any page. Tag bookmarks, search across title / URL / tag, and keep a "Read Later" list for the pages you don't have time for right now.

■ Organize what your browser already has
Read your existing browser bookmarks, import them, auto-tag them by site category (dev, finance, video, social, shopping, news, tools, office, gaming, learning, music, writing, travel) and mark the sites you visit most as "Frequent".

■ Bookmark audit
See which of your bookmarks you actually use. TabPocket ranks every bookmarked page by how many times you opened it in the last 30 days, 90 days or a year — by page or by site — and shows how many you haven't touched at all. Export the result to CSV and clean up the dead weight.

■ Browsing stats
A quiet timer records how long you spend on each site and turns it into a calendar heatmap, a top-12 site ranking and a 24-hour distribution. Every minute is settled by a heartbeat, tab switches settle instantly, and the timer stops when you are idle or locked.

■ Private by design
No account. No server. No analytics, no ads, no remote code. Sessions, bookmarks and statistics never leave your device — they live in your browser profile and disappear when you uninstall. Exclude any domain from tracking, and clear statistics whenever you want.

Manifest V3. Open source (MIT) at github.com/firevenus/TabPocket. Suggestions and bug reports are welcome in GitHub Issues.
```

**Detailed description（中文，供以后做中文商店页或介绍用）**

```
TabPocket（页袋）是一个纯本地的浏览器扩展，把标签、收藏和浏览统计收进一只小口袋。

■ 标签收拢
一键关掉几十个标签，变成一个会话卡片；展开能看到每个标签、单独打开任意一个，需要时整组恢复。重启浏览器也不会丢。

■ 收藏整理
收藏当前页，或右键任意网页收藏。支持标签、搜索（标题/网址/标签）、以及「待看」清单。

■ 整理浏览器已有收藏
读取原生书签、去重导入，按站点类别自动打标签（开发、金融、视频、社交、购物、新闻、工具、办公、游戏、学习、音乐、写作、旅行），常访问的站点标记为「常用」。

■ 收藏体检
看清哪些收藏你真的在用：按最近 30 天 / 90 天 / 一年的打开次数给每个收藏页面排名，可按页面或按网站两个视角查看，还能看到一年没碰过的有多少。结果可导出 CSV，方便清理。

■ 浏览统计
后台静默计时，生成日历热力图、Top 12 站点排行和 24 小时分布。每分钟心跳结算，切标签立即结算，离开键盘或锁屏自动停表。

■ 隐私优先
不用登录、没有服务器、没有统计埋点、没有广告、没有远程代码。会话、收藏、统计全部留在你自己的浏览器里，卸载即删。可以排除任意域名，也可以随时清空统计。

Manifest V3，MIT 开源：github.com/firevenus/TabPocket
```

### 1.5 隐私页（这里最容易被打回，逐字照填）

**Single purpose（单一用途，一句话）**

```
TabPocket manages your browser tabs and bookmarks, and shows you statistics about your own browsing, all stored locally on your device.
```

**Permission justification（每个权限一个框，照抄）**

| 权限 | 理由（英文，直接粘贴） |
|---|---|
| `tabs` | Reads the title and URL of open tabs so the user can collapse the current window into a saved session and restore it later, and so the timer knows which page is currently active. |
| `storage` | Saves sessions, bookmarks, settings and the language preference locally with chrome.storage.local. |
| `unlimitedStorage` | Long-term browsing statistics are stored in IndexedDB; unlimited quota prevents the default storage limit from being hit after months of use. |
| `alarms` | A once-per-minute alarm settles how long the current page stayed in the foreground. This is the only periodic task in the extension. |
| `idle` | Stops the timer when the user is away from the keyboard or the screen is locked, so idle time is not counted as browsing time. |
| `bookmarks` | Used only by the "Organize bookmarks" and "Bookmark audit" features: reads the user's existing browser bookmarks to import/categorise them and to rank them by visit count, and lets the user delete a bookmark from the audit list. |
| `history` | Used only by the "Bookmark audit" feature: counts how many times a bookmarked page was opened within the selected period (30/90/365 days). History is read-only and never modified. |
| `contextMenus` | Adds the right-click menu item "Add this page to TabPocket". |

**Data usage disclosure（数据使用声明）——这里必须如实勾选**

扩展确实会读取浏览历史，所以要勾 **Web history**。**同时必须勾 User activity** —— 因为 `idle` 权限属于这一分类（我们要判断用户是否在场，决定停不停表）。漏勾这一项属于数据使用申报不实，是审核驳回与下架的常见原因，别图省事。然后在说明里写清楚「只在本地用、不上传」：

```
Web history is read locally only, for the Bookmark audit ranking. It is processed inside the user's browser, never transmitted to any server, never sold, and never shared with third parties. TabPocket has no backend.

The idle state is used exclusively to pause the local timer when the user steps away or locks the screen, so idle time is not counted as browsing time. The idle state is never stored, logged, or transmitted.
```

下面的三项认证（不出售数据 / 不用于无关用途 / 不用于信用评估）**全部勾选**——这是真的。

**Privacy policy URL**：`https://firevenus.github.io/TabPocket/privacy.html`（**带文件名**，不要只填域名根路径）

### 1.6 分发设置

- **Visibility**：Public（要给别人用；Unlisted 只有拿到链接的人能装）
- **Regions**：All regions
- **Pricing**：Free

### 1.7 提交与审核

点 **Submit for review**。审核时长：

- 权限少、无远程代码的新扩展，常见 **几小时到 1–3 个工作日**
- 首次发布 + 用到 `history` / `bookmarks` 这类敏感权限，可能被转人工，**最长几周**

**本项目最可能被问到的三点，提前准备好说辞（都在 §1.5 里了）**：

1. `history` 权限是否必要 → 收藏体检的「区间访问次数」只能靠它，且只读
2. 是否上传数据 → 没有后端，代码里没有任何 fetch/XHR 到外部域名（可让审核方自查）
3. 单一用途 → 一句话已写明

被拒也别慌：拒信里会写明违反哪条政策，改完用同一个 version+1 重传即可。**版本号不能复用**。

---

## 2. Microsoft Edge 加载项

**开发者后台（Partner Center）**：https://partner.microsoft.com/dashboard/microsoftedge/overview
**官方文档**：https://learn.microsoft.com/microsoft-edge/extensions/publish/publish-extension
**费用**：**免费**

### 2.0 后台逐字段填写顺序

Partner Center 的顺序和 Chrome 不同：先 Availability，再 Properties、Privacy，最后才是 Store listings。同样，`[NN]` 指 `listing-en.txt` 的块号。

| # | 页面 | 字段 | 填什么 | 取自 |
|---|---|---|---|---|
| 1 | **Create new extension** | 上传包 | `release/TabPocket-v0.6.1.zip` | — |
| 2 | **Availability** | Visibility | `Public` | `[13]` |
| 3 | Availability | Markets | 默认全部市场（含未来新增） | `[13]` |
| 4 | **Properties** | Category | `Productivity` | `[04]` |
| 5 | Properties | Website | `https://github.com/firevenus/TabPocket` | `[15]` |
| 6 | Properties | Support contact | `https://github.com/firevenus/TabPocket/issues` | `[15]` |
| 7 | Properties | Mature content | 不勾 | `[15]` |
| 8 | **Privacy** | Single purpose | 一句话 | `[07]` |
| 9 | Privacy | Permission justification | **8 个权限逐个填** | `[08]` |
| 10 | Privacy | Remote code | `No` | `[14]` |
| 11 | Privacy | Data usage 分类 | 勾 **Web history** + **User activity** | `[09]` |
| 12 | Privacy | Data usage 说明 | 两段英文 | `[10]` |
| 13 | Privacy | Privacy policy URL | `https://firevenus.github.io/TabPocket/privacy.html` | `[06]` |
| 14 | **Store listings** | 语言行 `English` → Edit details | 进入详情页 | — |
| 15 | 详情页 | **Extension name / short description** | **只读**，取自 manifest，不用填 | — |
| 16 | 详情页 | Description | 250–10,000 字符，1,818 字符 | `[03]` |
| 17 | 详情页 | Extension logo | 300×300，1:1 | `[12]` |
| 18 | 详情页 | Small / Large promotional tile | 可选：440×280 / 1400×560 | `[12]` |
| 19 | 详情页 | Screenshots | 1280×800，1–10 张 | `[12]` |
| 20 | 详情页 | YouTube video URL | 留空 | — |
| 21 | 详情页 | **Search terms** | 见 §2.6，中英各一套 | `[16]` |
| 22 | Store listings | 语言行 `Chinese (Simplified)` → Edit details | 填中文文案 | `listing-zh_CN.txt` |
| 23 | **Submit** | Notes for certification | 审核员操作指引 | `[17]` |
| 24 | **Publish** | — | 审核最多 7 个工作日 | — |

> ⚠️ 第 15 步是最容易懵的地方：Edge 的扩展名称和短描述**没有输入框**，直接读包里的 manifest。想改名只能改 `_locales` 并升版本号重传。我们已经是 `__MSG_extName__` 写法，所以中英两个语言页都会自动出现在 Store listings 里。

### 2.1 注册

1. 用 **Microsoft 账号**（Outlook / Hotmail / Live）登录 Partner Center；也支持用 GitHub 登录（会给你创建一个 MSA）
   - ⚠️ **不支持**用公司/学校账号（work or school account）注册
2. Edge 卡片 → 加入 Edge 计划
3. 三个不可逆的选择，选前想清楚：
   - **国家/地区**：注册后只读，不能改
   - **账号类型**：Individual 还是 Company，之后不能互转。个人做就选 Individual（验证快，几分钟到几天）
   - **发布者显示名称**：≤50 字符
4. 提交验证。个人账号主要是查名字是否可用；公司账号可能几天到几周，需要营业执照/水电单等

### 2.2 创建扩展

1. Partner Center → **Edge** 工作区 → **Create new extension**
2. 拖入同一个 zip（`release/TabPocket-v0.6.1.zip`），系统会立即校验
3. ⚠️ **Edge 的名称和短描述直接取自 manifest，且在后台是只读的**。我们的 manifest 用的是 `__MSG_extName__` + `default_locale: en`，所以 Edge 上会显示 **TabPocket — Tab & Bookmark Manager** 和英文短描述。想改名字只能改 manifest、升版本号、重新上传

### 2.3 Availability（上架范围）

- **Visibility**：Public
- **Markets**：默认全部市场。注意：以后从某个市场移除，那里的老用户保留扩展但收不到更新

### 2.4 Properties（属性）

| 字段 | 填什么 |
|---|---|
| Category | **Productivity**（生产力） |
| Website | `https://github.com/firevenus/TabPocket` |
| Support contact | `https://github.com/firevenus/TabPocket/issues` |
| Mature content | 不勾（无成人内容） |

### 2.5 Privacy（和 Chrome 那套一致）

- **Single purpose**：同 §1.5 第一段
- **Permission justification**：逐条粘贴 §1.5 表格里的英文
- **Remote code**：选 **"No, I am not using remote code"**（确实没有）
- **Data usage**：**Web history 和 User activity 两项都勾**（`idle` 属后者，漏勾＝申报不实），说明填 §1.5 那两段英文
- **Privacy policy URL**：`https://firevenus.github.io/TabPocket/privacy.html`（同 §4）

### 2.6 Store listing（每个语言一页）

- **Description**：250–10,000 字符。粘贴 `listing-en.txt` `[03]`（1,818 字符，两家都够）。中英各一页，中文页贴 `listing-zh_CN.txt` `[03]`
- **Extension logo**：1:1，推荐 300×300（最低 128×128）——用 `release/store/icon-512.png` 缩到 300，别用透明的 128
- **截图**：1280×800 或 640×400，1–10 张（比 Chrome 宽松）
- **Search terms**：见下

#### 搜索词的真实限制（三条，缺一不可）

官方文档原文的三条约束：

| 限制 | 值 |
|---|---|
| 条数 | **最多 7 条**（单词或短语都算一条） |
| 总词数 | **最多 21 个单词**（不管怎么拆，加起来不能超） |
| 单条长度 | **每条最多 30 字符** |

> 旧版这份指南在这里列了 9 个词，**超过 7 条上限，照填会被后台拦下**。下面两套是按真实限制做过验算的。

**英文（7 条 / 15 词 / 最长 21 字符）**

```
tab manager
session manager
bookmark manager
bookmark audit
read later
browsing time tracker
tab session
```

单行版（后台若只有一个输入框，用逗号隔开）：

```
tab manager, session manager, bookmark manager, bookmark audit, read later, browsing time tracker, tab session
```

**中文（7 条 / 7 词 / 最长 5 字）**

```
标签页管理
标签收拢
标签页整理
书签管理
收藏夹整理
书签体检
浏览统计
```

单行版：

```
标签页管理, 标签收拢, 标签页整理, 书签管理, 收藏夹整理, 书签体检, 浏览统计
```

**为什么中文不能直接译英文那组**：中文用户的断词和输入习惯跟英文不同。「tab manager」直译成「标签管理器」不如「标签页管理」贴近真实输入；「bookmark audit」直译「书签审计」几乎没人搜，中文用户说的是「收藏夹整理」「书签体检」。这组是按中文常见说法写的，不是英文列表的译文。

**Chrome 没有这个字段**：Chrome 的搜索权重来自标题、摘要和描述里的自然用词，所以 `[01][02][03]` 三处的措辞本身就在做 SEO —— 别为了塞词把它们写坏（关键词堆砌是明确的封禁理由）。

### 2.7 提交

**Certification testing notes** 里写一段给审核员看的操作指引（提高过审效率）：

```
No account or credentials are needed. Everything runs locally.

How to test:
1. Install. Click the toolbar icon to open the popup (4 tabs: Sessions / Bookmarks / Stats / About).
2. Open a few pages, click "Collapse all tabs" on the Sessions tab, then "Restore".
3. On Bookmarks, click "Bookmark this page", then "Organize bookmarks" (this reads existing browser bookmarks; permission "bookmarks").
4. Click "Bookmark audit" to open the full-page report. It ranks bookmarks by visit count over 30/90/365 days using the read-only history permission.
5. On Stats, click "Open full report" for charts and the background-status panel.

No network requests are made by the extension. No remote code.
```

点 **Publish / Submit**。审核通常 **1–7 个工作日**。

---

## 3. 两个商店的差异

| | Chrome 网上应用店 | Edge 加载项 |
|---|---|---|
| 后台 | chrome.google.com/webstore/devconsole | partner.microsoft.com/dashboard/microsoftedge |
| 费用 | 一次性 $5 | 免费 |
| 账号 | Google 账号 + **必须开两步验证** | Microsoft 账号（不支持公司/学校账号） |
| 名称/简介来源 | 商店页可单独填 | **读 manifest，后台只读** |
| 详细描述上限 | 16,000 字符 | 250–10,000 字符 |
| 搜索词字段 | **无**，靠标题/描述里的自然用词 | **有**，每语言独立：≤7 条 / ≤21 词 / 单条 ≤30 字符 |
| 语言页 | 每个语言一套 listing，可只发英文 | 由包内 `_locales` 决定出现哪几个语言页 |
| 审核时长 | 数小时 ~ 数天（敏感权限可能数周） | 1–7 个工作日 |
| 更新 | 版本号必须严格递增，不能回退 | 同上 |
| 数据声明 | Privacy practices（更细：分类勾选 + 三项认证） | Privacy 页（单用途/权限/远程代码/数据使用） |

> ⚠️ 两家的数据分类都**必须同时勾 Web history 和 User activity** —— `idle` 权限归在 User activity 下，只在说明文字里写"本地处理"不算数，分类勾漏了就是申报不实。

---

## 4. 隐私政策怎么上线（两个店都要 URL）

已经写好 `docs/privacy.html`（中英对照，单文件、无依赖）。三种做法任选：

**A. 用现有 GitHub 仓库开 Pages（推荐，免费）—— ✅ 已就绪**

`docs/` 下三个文件，Pages 源已设为 `main` / `docs`：

| 文件 | 线上地址 |
|---|---|
| `index.html`（项目落地页） | https://firevenus.github.io/TabPocket/ |
| `privacy.html`（隐私政策，中英对照） | https://firevenus.github.io/TabPocket/privacy.html |
| `icon-128.png`（落地页图标） | — |
| `.nojekyll`（关掉 Jekyll 处理，避免下划线文件被吞） | — |

**商店后台的「Privacy policy URL」必须填带 `privacy.html` 的完整地址。** 只填根路径 `https://firevenus.github.io/TabPocket/` 打开的是落地页而不是政策正文，审核员找不到内容会打回。

验收命令（应分别返回 `200`）：

```bash
curl -sSo /dev/null -w "%{http_code}\n" https://firevenus.github.io/TabPocket/
curl -sSo /dev/null -w "%{http_code}\n" https://firevenus.github.io/TabPocket/privacy.html
```

> 注意 Pages 只会找 `index.html` / `index.htm` / `README.md` 当首页；目录里只有 `privacy.html` 时根路径会 404，但政策页本身是正常的。

**B. 挂到你已有的站点**：`enki-yan.pages.dev` 或 `firevenus.github.io` 下开个子路径，把 HTML 传上去即可。

**C. 先临时用仓库直链**（能过审但不推荐）：`https://github.com/firevenus/TabPocket/blob/main/docs/privacy.html` —— 部分审核员会要求 HTML 页面而不是文件预览页。

---

## 5. 截图怎么拍

要求：**1280×800** 或 640×400，PNG 或 24 位 JPG，**不能有透明通道**，最多 5 张。

### 5.1 拍这四张

| 序号 | 画面 | 从哪里进 | 为什么要它 |
|---|---|---|---|
| 1 | 统计报表页 | 弹窗 → 统计 → 打开报表 | 热力图 + 域名排行 + 24 小时分布同框，这是与同类产品拉开差距的地方。**商店列表首图就是它** |
| 2 | 收藏体检页 | 弹窗 → 收藏 → 收藏体检 | 按访问次数排序的榜单，功能一眼能懂 |
| 3 | 弹窗 · 收藏页 | 点扩展图标 | 收藏卡片、标签、待看、收藏体检按钮 |
| 4 | 弹窗 · 收拢页 | 点扩展图标后切页签 | 先展开一个会话，露出里面的标签列表，否则看不出「收拢」做了什么 |

第 5 张可选：关于页（能顺带证明中英双语）。

### 5.2 两个坑

**隐私**：真实书签标题、域名、文件夹名会随图公开。上图前确认没有工作系统、邮箱、内部链接。稳妥做法是用一个干净配置只放公共站点（GitHub / YouTube / MDN / Wikipedia）。

**弹窗很小**：弹窗实际只有 380×480，直接截占不满 1280×800 的画布——这正是下面脚本要解决的。

### 5.3 一键合成

原始截图尺寸不用管，脚本自动缩放、居中、配背景和文案，输出严格 1280×800、24 位无 alpha 的 PNG。

```bash
# 1. 原始截图按固定名字放进 raw 目录
#    release/screenshots/raw/1-stats.png
#    release/screenshots/raw/2-audit.png
#    release/screenshots/raw/3-popup-bookmarks.png
#    release/screenshots/raw/4-popup-sessions.png

# 2. 合成（默认中英两套，各 4 张）
python scripts/make-screenshots.py

# 只要英文（商店主要面向国际用户）
python scripts/make-screenshots.py --lang en

# 3. 提交前校验尺寸与通道
python scripts/make-screenshots.py --check
```

产物在 `release/screenshots/`，命名如 `1-stats-en.png`、`1-stats-zh.png`。

版式：报表页和体检页**整页铺满**（等比裁切，从顶部开始）；两个弹窗用**卡片式**——左侧标题加三条功能点，右侧弹窗截图带圆角阴影。文案在脚本顶部 `SLIDES` 里，改措辞直接编辑。

**可选加分项**：小型宣传图 440×280（商店首页/搜索结果展示）、大型 1400×560（争取首页推荐位）。

---

## 6. 上架后的更新流程

```bash
# 1. 改代码
# 2. 升版本：manifest.json 与 package.json 两处必须一致
#    Chrome 规定新版本号必须严格大于线上版本，且不能回退（审核失败的版本号也不能复用）
# 3. 构建（重建 dist/chrome-mv3）
npm run build
# 4. 打包 + 校验，一条命令
python scripts/package.py
#    产物：release/TabPocket-v<新版本>.zip
#    校验不过会打印 [FAIL] 并以退出码 1 结束，此时别上传
# 5. 后台 → 该扩展 → Upload new package → 提交审核
```

校验脚本查六项：`manifest.json` 在根部、没套目录、版本号三方一致、包里没有源码/map/杂物、必需入口与图标齐全、与 `dist` 逐字节一致。只查已有的包：`python scripts/package.py --check`。

⚠️ 本地开发时，`npm run build` 会把 `dist` 改名重建，正在运行的扩展后台会失联（表现为统计不记数）。构建后去 `edge://extensions` 点一次「重新加载」。

⚠️ **加新权限会重新触发完整审核**，能不加以不加。

⚠️ 审核通过后用户端自动更新大约需要几小时（Chrome 每隔几小时检查一次），着急可以在 `chrome://extensions` 点「更新」。

---

## 7. 现在还差什么（按顺序）

| # | 事项 | 状态 |
|---|---|---|
| 1 | 隐私政策上线（§4） | ✅ 已完成，URL 可用 |
| 2 | 打包与校验 | ✅ 已完成，`release/TabPocket-v0.6.1.zip` 六项校验通过 |
| 3 | 中英文上架文案 | ✅ 已完成，`release/store/listing-en.txt` / `listing-zh_CN.txt` |
| 4 | **注册两个开发者账号** | ⚠️ **只剩这件卡时间**：Chrome $5 + 两步验证，Edge 免费 |
| 5 | 截 4 张图（§5） | ⚠️ 待截图，丢进 `release/screenshots/raw/` 后跑合成脚本 |
| 6 | 照 §1.0 / §2.0 填表提交 | 等 4、5 完成 |

账号注册是唯一需要等外部审核的环节，其余都能在本地做完。建议先把它办掉。

---

*本文档随扩展版本维护。当前对应 v0.6.1。*
