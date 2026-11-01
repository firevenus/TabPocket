# TabPocket 上架指南（Chrome 网上应用店 + Edge 加载项）

> 适用版本：v0.6.1（已做中英双语）
> 本文所有文案可直接复制粘贴。素材、文案、权限理由都在这里，不用再翻别处。

---

## 0. 上架前必须先有的东西

| 项目 | 状态 | 说明 |
|---|---|---|
| 打包好的 zip | ✅ 已校验 | `release/TabPocket-v0.6.1.zip`（296 KB / 24 个文件，`manifest.json` 在根部，无源码无 map） |
| **可直接粘贴的文案** | ✅ 已有 | `release/store/paste/en/*.txt`、`paste/zh_CN/*.txt` —— **一个字段一个文件，全选复制即可**。`listing-*.txt` 是母版（含说明），**整份文件不能粘进任何输入框** |
| 128×128 图标 | ✅ 已有 | `release/store/icon-128.png` （恰好 128×128）。**别传 icon-512.png**，会被判「图片尺寸不正确」 |
| 截图 ≥1 张（1280×800） | ⚠️ 需补齐 | 成品在 `release/screenshots/*.png`，由 `scripts/make-screenshots.py` 合成；`raw/` 里的原图**尺寸不合规，不能直接传**。见 §5 |
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

后台左侧是四个页签 + 提交页。**括号里的 `[NN]` 是块号**——去 `release/store/paste/en/` 找对应的 txt（文件名前缀就是块号），**全选复制那个文件**即可。

> ⚠️ **`listing-en.txt` 本身不能粘进任何输入框。** 它是母版，约 15,000 字符里大半是给人看的说明。曾经整份粘进描述框，正文只占 2,154 字符，剩下的全是 "PASTE ORDER — CHROME …"。要用的是 `paste/` 目录下拆好的单字段文件。

| # | 页签 → 字段 | 填什么 | 取自 |
|---|---|---|---|
| 1 | **Package**（上传后只读） | 核对版本号是否为 `0.6.1` | — |
| 2 | **Store listing → Name** | `TabPocket — Tab & Bookmark Manager` | `[01]` |
| 3 | **Store listing → Summary** | 130 字符那句（上限 132） | `[02]` |
| 4 | **Store listing → Description** | 长文，2,154 字符（上限 16,000） | `[03]` |
| 5 | **Store listing → Category** | `Productivity` | `[04]` |
| 6 | **Store listing → Language** | `English`（主语言，另有中文页另填） | `[05]` |
| 7 | **Store listing → 图片** | 图标传 `release/store/icon-128.png`（必须恰好 128×128）；截图传 `release/screenshots/*-en.png` 成品；宣传图块传 `release/store/promo/tile-small-440x280.png` 与 `tile-large-1400x560.png` | `[12]` |
| 7b | **Store listing → 首页网址 / 支持信息页面网址** | 落地页 + GitHub Issues，两行分别粘（各上限 2048） | `[19]` |
| — | **保存草稿** | 上传图标后必须存一次，「缺少图标图片」才会消失 | — |
| 8 | **Privacy practices → Privacy policy URL** | `https://firevenus.github.io/TabPocket/privacy.html` | `[06]` |
| 9 | **Privacy practices → Single purpose** | 一段话，709 字符（上限 1000） | `[07]` |
| 10 | **Privacy practices → Permission justification** | **8 个权限各一个输入框**，逐个粘贴，最长那条 751 字符 | `[08]` ×8 |
| 11 | **Privacy practices → Remote code** | **先点单选框「不，我并未使用远程代码」**；理由框通常随之禁用，若仍要文字再粘 | `[14]` |
| 12 | **Privacy practices → 数据使用分类** | 只勾 **网络记录** + **用户活动**，其余七项全不勾 | `[09]` |
| 13 | ~~数据使用说明~~ | **当前表单没有这个文本框**，跳过 —— 解释由隐私政策页承担 | `[10]` |
| 14 | **Privacy practices → 三条确认** | 三条全勾。**这就是「必须确认数据使用符合政策」那条报错的答案**，全页没有第四个确认框 | `[11]` |
| 15 | **Distribution** | Visibility `Public` · Regions `All` · Pricing `Free` · Trader `Non-trader` | `[13]` |
| 16 | **Test instructions**（可选） | 审核员操作指引 | `[17]` |
| 17 | **Submit for review** | 确认弹窗里可勾「审核通过后先暂存，手动发布」 | — |

> ⚠️ 三个最容易卡住的地方：**第 10 步是 8 个独立输入框**（少填一个就会被打回，后台一次把你缺的全部列出来）、**第 12 步的分类勾选**比任何文字都重要（中文界面里「Web history」叫「**网络记录**」，按英文名找会以为漏了一整类）、**第 14 步的三条确认**就是那条「必须确认数据使用符合政策」的报错，不是另有勾选框。

> 💡 后台的「无法发布」是一次性把所有缺口列出来的：看到十几条报错不用逐条去修，按 §1.5 的对照表一次性填完再存草稿。

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

> **本节不复制英文正文。** 正文唯一真相源是 `release/store/paste/en/` 下拆好的单字段文件，母版是 `listing-en.txt` 的 `[06]`–`[14]`。指南里再抄一份，两边一定会打架 —— v0.6.1 就出过一次摘要两处不一致（106 字符 vs 130 字符）。这里只讲：**每个框填哪个文件、为什么这么写、报错怎么对**。

#### 为什么一次报十几条

Chrome 的发布闸口是「必填项全齐才放行」，所以它把**当前所有缺口一次性列出来**。看到 11 条别逐条去修，按下面的顺序填完、存一次草稿，再看还剩什么。

报错里出现频率最高的三种，其实都在同一页：单一用途（1 条）、8 个权限理由（8 条）、远程代码（1 条）；剩下「缺少图标图片」不在这一页，而「确认数据使用符合政策」就是那三条确认本身（不是另一个勾选框）。

#### 逐框对照

| 后台字段（中文界面） | 文件 | 写成什么样的 | 字符 |
|---|---|---|---|
| 单一用途说明 | `07-single-purpose.txt` | 一段话，先说「只做一件事」，再把会话/收藏/统计/体检四个功能论证成同一份本地记录的四个视图 | 709 / 1000 |
| 需请求 `tabs` 的理由 | `08-permission-tabs.txt` | 为什么收标签、存哪儿、为什么不外传、为什么 `activeTab` 不够 | 751 / 1000 |
| 需请求 `storage` 的理由 | `08-permission-storage.txt` | 存什么、为什么不申 `storage.sync`、`storage.session` 只用在哪 | 699 / 1000 |
| 需请求 `alarms` 的理由 | `08-permission-alarms.txt` | MV3 worker 30 秒就休眠，内存计时器活不下来 | 623 / 1000 |
| 需请求 `contextMenus` 的理由 | `08-permission-contextMenus.txt` | 只有一个右键项，点击只写本地收藏 | 341 / 1000 |
| 需请求 `unlimitedStorage` 的理由 | `08-permission-unlimitedStorage.txt` | 统计按天累积不自动清理，避免配额错误静默停统计 | 612 / 1000 |
| 需请求 `bookmarks` 的理由 | `08-permission-bookmarks.txt` | 只有两个用户主动点的功能用，写入只发生在点击后 | 630 / 1000 |
| 需请求 `history` 的理由 | `08-permission-history.txt` | 只读、两个视图各用一次、从不调 delete/add | 789 / 1000 |
| 需请求 `idle` 的理由 | `08-permission-idle.txt` | 人离开就停表，只读状态不读活动内容 | 511 / 1000 |
| 远程代码的理由 | `14-remote-code.txt` | **先点「不，我并未使用远程代码」**；框还要求文字才粘这段 | 383 / 1000 |
| ~~数据使用说明~~ | `10-data-usage-text.txt` | **当前表单没有这个框**，跳过；解释在隐私政策页 | — |
| 隐私权政策网址 | `06-privacy-url.txt` | 带文件名，不要只填域名根（上限 2048） | 50 |

**每个权限理由都按同一个骨架写**，这是审核员看的东西：

1. **为什么需要** —— 具体到哪个功能、用户点哪个按钮；
2. **范围有多窄** —— 只读/只写、只在点击后、不轮询、不外传；
3. **为什么没有更窄的权限** —— 明确写出替代方案为什么不行（`activeTab`、`storage.session` 等），这一句是「权限最小化」的答卷。

#### 报错原文 → 该填哪个文件

| 后台报错 | 填 |
|---|---|
| 必须提供对单一用途的说明 | `07-single-purpose.txt` |
| 必须提供需使用远程代码的理由 | `14-remote-code.txt`（**先点 No**，见下） |
| 必须提供需使用 `alarms` 权限的理由 | `08-permission-alarms.txt` |
| 必须提供需使用 `bookmarks` 权限的理由 | `08-permission-bookmarks.txt` |
| 必须提供需使用 `contextMenus` 权限的理由 | `08-permission-contextMenus.txt` |
| 必须提供需使用 `history` 权限的理由 | `08-permission-history.txt` |
| 必须提供需使用 `idle` 权限的理由 | `08-permission-idle.txt` |
| 必须提供需使用 `storage` 权限的理由 | `08-permission-storage.txt` |
| 必须提供需使用 `tabs` 权限的理由 | `08-permission-tabs.txt` |
| 必须提供需使用 `unlimitedStorage` 权限的理由 | `08-permission-unlimitedStorage.txt` |
| **缺少图标图片** | 不在本页：回 `Store listing → 图片` 传 `release/store/icon-128.png`，**然后存草稿** |
| 必须确认数据使用情况符合开发者计划政策 | `11-certifications.txt` 那**三条确认全部勾选** —— 全页没有别的确认框 |

#### 远程代码：先点单选框，再谈文字

manifest 里没有任何远程代码 —— 构建产物扫过：无 `eval(`、无 `new Function`、无远程 `import`、无远程 `<script>`，manifest 也没覆盖 CSP（走 MV3 默认 `script-src 'self'`），扩展零网络请求。

所以这一项的**正解是点「不，我并未使用远程代码」**。点完之后下面那个理由框通常就禁用了。如果后台仍然弹「必须提供需使用远程代码的理由」，那是它把空文本框当成未回答，粘 `14-remote-code.txt` 一句话交代即可（里面写的就是「没有远程代码」这件事本身）。

#### 数据使用：两个勾，一个都不能少

表单是 **9 个分类勾选框 + 3 条确认 + 隐私政策网址，没有自由文本**。所以别找「说明」框，它不存在 —— 解释的责任全在隐私政策页上，`docs/privacy.html` §1 已经专门写了一段讲浏览历史（只读、只计数、不保存访问列表）。

- 勾 **网络记录** —— 中文界面就写「网络记录」，帮助文字是「用户访问过的网页及相关数据（例如网页标题和访问时间）的列表」。**按英文名 "Web history" 去找会以为漏了一整类。** 收藏排序与体检都要数访问次数，必须勾。
- 勾 **用户活动** —— `idle` 权限属于这一分类。

**漏勾 用户活动 属于数据使用申报不实**，是驳回与后续下架的常见原因。这条没有变通空间：要么勾，要么把 `idle` 权限从 manifest 里去掉（去掉就没法判断人是否离开，统计会虚高）。

「用户活动」的帮助文字列的是「网络监控、点击、鼠标指针位置、滚屏或击键操作记录」—— 我们一样都不做，只读一个「在场 / 离开」的状态。但权限归属是客观的，勾选与解释要分开看：**勾是申报类别，不勾是申报不实**。

其余七项（个人身份信息 / 健康 / 财务和付款 / 身份验证 / 个人通讯 / 位置 / 网站内容）**全部不勾**。扩展不读页面 DOM（无 content script）、不读剪贴板、不读表单，勾了反而与事实不符。理由：manifest 里没有 `host_permissions` 也没有 `content_scripts`，这一点审核员能直接看到。

#### 三条确认：报错列表最后那一条的答案

页面原文三条，全部勾选 —— 这是真的，扩展没有后端：

```
我不会出于已获批准的用途之外的用途向第三方出售或传输用户数据
我不会为实现与我的产品的单一用途无关的目的而使用或转移用户数据
我不会为确定信用度或实现贷款而使用或转移用户数据
```

它们下面那行字写着「您必须将这 3 个复选框全都选中，才符合我们的开发者计划政策」。**这就是「若要发布产品，您必须确认您的数据使用情况符合我们的开发者计划政策」在等的那个动作**，全页没有第四个确认框 —— 之前我把它当成一个独立的勾选框，找了一圈没找到。

#### 图标为什么算在这一页的报错里

「缺少图标图片」是 `Store listing` 页的字段，但发布闸口一起报。**上传后必须存一次草稿**，否则闸口读到的还是旧状态。

传 `release/store/icon-128.png`（实测 128×128、8-bit RGBA、7.2 KB）。**不要传 `icon-512.png`** —— 商店要求恰好 128×128，512 会被判「图片尺寸不正确」，然后该字段留空，就变成「缺少图标图片」。这两个报错常常是同一个原因的两个阶段。


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
| 8 | **Privacy** | Single purpose | 一段话，709 字符 | `[07]` |
| 9 | Privacy | Permission justification | **8 个权限逐个填**，最长 751 字符 | `[08]` ×8 |
| 10 | Privacy | Remote code | 选 `No`；仍要文字再粘 | `[14]` |
| 11 | Privacy | Data usage 分类 | 勾 **Browsing history** + **User activity** | `[09]` |
| 12 | Privacy | Data usage 说明 | 两段英文 | `[10]` |
| 13 | Privacy | Privacy policy URL | `https://firevenus.github.io/TabPocket/privacy.html` | `[06]` |
| 14 | **Store listings** | 语言行 `English` → Edit details | 进入详情页 | — |
| 15 | 详情页 | **Extension name / short description** | **只读**，取自 manifest，不用填 | — |
| 16 | 详情页 | Description | 250–10,000 字符，2,154 字符 | `[03]` |
| 17 | 详情页 | Extension logo | 300×300，1:1 | `[12]` |
| 18 | 详情页 | Small / Large promotional tile | 可选：440×280 / 1400×560 | `[12]` |
| 19 | 详情页 | Screenshots | 1280×800 或 **640×480**，**最多 6 张** | `[12]` |
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

### 2.5 Privacy（和 Chrome 同源，字段名略不同）

正文一律从 `release/store/paste/en/` 取，**逐框写法与理由见 §1.5**，不要在指南里另抄一份。

- **Single purpose** → `07-single-purpose.txt`
- **Permission justification** → `08-permission-*.txt`，**8 个框一个都不能空**。Edge 的框名是 `Justification for using the <permission> permission`，按名字对，不要按位置对
- **Remote code** → 选 **"No, I am not using remote code"**；若仍要求文字，粘 `14-remote-code.txt`
- **Data usage** → 勾 **Browsing history** 与 **User activity**（Edge 把 Chrome 的「网络记录 / Web history」叫 **Browsing history**，是同一项）。`idle` 属 User activity，漏勾＝申报不实
- **Data usage 说明** → 有框就粘 `10-data-usage-text.txt`，**Chrome 与 Edge 现在的表单都没有这个框**，别为找它耗时间
- **Privacy policy URL** → `https://firevenus.github.io/TabPocket/privacy.html`（同 §4）

Edge 的发布闸口和 Chrome 一样是「一次列全部缺口」，报错文案是「必须提供使用 xxx 权限的理由」。**认证那一块两家也有**：Edge 的「I certify that the following disclosures are true」同样是三个勾，必须全选，漏勾发布按钮不亮。区别只在措辞和位置——Chrome 单独占一段、Edge 紧跟数据使用分类下面。


### 2.6 Store listing（每个语言一页）

- **Description**：250–10,000 字符。粘贴 `paste/en/03-description.txt`（2,154 字符，两家都够）。中英各一页，中文页贴 `paste/zh_CN/03-description.txt`
- **Extension logo**：1:1，推荐 300×300（最低 128×128）——直接传 `release/store/icon-300.png`（已按 300×300 生成好，不用自己缩）
- **截图**：1280×800 或 **640×480**（Edge 没有 640×400 那一档，那是 Chrome 的），**最多 6 张**。用 `release/screenshots/` 下的成品，别传 `raw/`
- **上传后点 Duplicate**：logo、两张图块、截图每个字段下面都有 Duplicate，把英文那套一键复制到中文页，不用重复传五遍
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

**Notes for certification**（在 Store listings 每行状态变成 `Complete`、点右上 **Publish** 之后打开的那个页面里填，不在这里）写一段给审核员看的操作指引：

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

**这一步别省**。扩展刚装是空的，审核员打开 popup 什么数据都没有，很可能判「功能不完整或无法使用」。一段操作指引能直接把这类误拒挡掉。

点 **Publish** 后进入认证，通常 **1–7 个工作日**。通过后状态变 `In the Store`。

#### 语言页是自动出现的，不是手加的

Partner Center 靠包内 `_locales/*/messages.json` 里的 i18n 键来判断有哪些语言。本项目的 manifest 用 `__MSG_extName__` / `__MSG_extDesc__`，两个 locale 的 messages.json 都齐（已核：`en` 和 `zh_CN` 各有 `extName` / `extDesc` 两键），所以 **Store listings 里会自动出现 English 和 Chinese (Simplified) 两行**，不需要手动 Add language。

如果只出现一个语言，官方给的排查方向是：manifest 的 name/description 写成了硬编码字符串（没用 `__MSG_*__`）、缺 `default_locale`、或某个 `_locales/*/messages.json` 缺对应的键。这三条我们都不占。

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
| 数据声明 | Privacy practices：单用途 + 权限 + 远程代码 + 分类勾选 + **三项认证** | Privacy 页：同样五项，**也有三项认证**，措辞不同（`I certify that the following disclosures are true`） |
| 截图 | 1–5 张，1280×800 或 640×400 | **最多 6 张**，1280×800 或 **640×480**（没有 640×400） |
| 宣传图块 | 440×280 / 1400×560，**可选** | 同尺寸，**可选**，且有 Duplicate 一键复制到其他语言 |

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

> ⚠️ **改完 `docs/` 里的文件必须 push，Pages 才会更新。** 审核员打开的是线上那一个 URL，不是你本地仓库里的文件 —— 本地改了没推，等于没改。改完跑上面两条 curl 确认 200，再对照线上内容看一眼。

**B. 挂到你已有的站点**：`enki-yan.pages.dev` 或 `firevenus.github.io` 下开个子路径，把 HTML 传上去即可。

**C. 先临时用仓库直链**（能过审但不推荐）：`https://github.com/firevenus/TabPocket/blob/main/docs/privacy.html` —— 部分审核员会要求 HTML 页面而不是文件预览页。

---

## 4.5 图标规范（Chrome 官方，容易漏掉的三条）

来源：`developer.chrome.com/docs/webstore/images#icons`。原文是硬要求，不是建议：

> The actual icon size should be **96x96** (for square icons); an additional **16 pixels per side** should be transparent padding, adding up to 128x128 total image size.

三条最容易做错的：

| 规则 | 含义 | 我们踩过没有 |
|---|---|---|
| 画面 96×96 + 四边 16px 透明留白 | 内容**只占画布 75%**，四周必须真空 | ❌ 踩了：v0.6.1 之前画到 120×120（94%） |
| 不要画外描边 | UI 自己会加边，你加的会重影 | ✅ 本来就没描边 |
| 不加大投影 | UI 自己会加阴影 | ✅ 本来就没阴影 |
| 明暗背景下都要好看 | 深色主题工具栏下不能糊成一团 | ❌ 踩了：暗端 `#075243` 在 `#202124` 上几乎无对比 |

还有一条容易被忽略的反向规则：

> If you upload an image that has **no alpha**, it will be placed in a frame with **rounded corners (12-pixel corner radius)**.

也就是说：**带 alpha 的图标，Chrome 不会帮你加圆角**，你自己画的圆角就是最终样子；不带 alpha 反而会被套一个 12px 圆角框。我们的图标自带 22.4px 圆角且带 alpha，所以按原样显示。

### 为什么不加「白色外发光」

官方对深色图标的建议是「consider adding a subtle white outer glow」。我试过，**会破坏 16px 透明留白**：`feGaussianBlur` 把不透明像素从 96×96 扩散到 108×108，视觉上没问题，但严格量起来 padding 只剩 10px。两条要求冲突时取「留白」——它是硬数字，发光只是建议。

深色背景改由底板配色解决：渐变暗端从 `#075243` 提到 `#108169`，在 `#202124` 上仍能看出轮廓。

### 16px 为什么要单独一套画面

`96/128 = 75%`，换算到 16px 只有 **12px 画面**。完整图标里那两张卡片各占 4px 宽，12px 下必然糊掉。所以：

- `assets/icon.svg`（完整版）→ 48 / 96 / 128 / 300 / 512
- `assets/icon-small.svg`（去掉卡片，只留底板 + 口袋 + 浅袋口）→ 16 / 32

两套共用同一个 `translate(12.8) scale(0.8)`，比例一致，放在一起是一个家族。

```bash
python scripts/build-icons.py           # 全部重出
python scripts/build-icons.py --check   # 只校验尺寸
```

⚠️ **改完图标必须 `npm run build` 再 `python scripts/package.py`**，否则包里还是旧图标——`public/icon/*.png` 是构建时才复制进 `dist` 的。

---

## 4.6 宣传图块（小图块 + 顶部横幅）

两个字段都是可选，但空着列表页会显得单薄，而且分类页位置要用小图块。规格和截图一样苛刻：

| 字段 | 尺寸 | 格式 |
|---|---|---|
| 小型宣传图块 | **440×280** | JPEG 或 24 位 PNG，无 alpha |
| 顶部宣传图块（Marquee） | **1400×560** | JPEG 或 24 位 PNG，无 alpha |

两张都不分语言，是账号级全局字段，所以文案统一用英文。产物已经出好：

```
release/store/promo/tile-small-440x280.png   →  小型图块
release/store/promo/tile-large-1400x560.png  →  顶部横幅
（同名 .jpg 是同图备份，后台挑格式时用）
```

```bash
python scripts/make-promo-tiles.py            # 重出 + 校验
python scripts/make-promo-tiles.py --check    # 只校验
```

### 内容禁区（这是图块被打回的真实原因）

- ❌ 评分、排名、奖项、"#1"、"Best"、"Most popular"
- ❌ 做成按钮样式的 **Install / Download / Add to Chrome** —— 图片里的假按钮算行动号召
- ❌ 其他浏览器或商店的 logo
- ✅ 品牌名 + 一句功能陈述，这是安全区。我们的两张图只有「TabPocket + 功能句 + 三个功能词」，没有任何按钮。

### 两处设计决策

**背景比图标更暗。** 图标自己是绿底（渐变暗端 `#108169`），背景如果也用同一档亮度的绿，图标会糊在背景里，16px 留白的边界看不出来。所以背景压到 `#071f1a → #0c5b4a`，让图标的亮端 `#3ad0a2` 跳出来。

**横幅里放真截图，但有重复风险。** 截图自带页内标题「See where your time actually goes」，如果左侧文案也写 "see where your time goes"，一眼就看出是硬凑的。所以左侧改成「Tabs, bookmarks and browsing time, organised in one place. Nothing leaves your device.」——同一件事的另一种说法。

### 技术要点

- **2 倍像素密度渲染再缩回**：`--force-device-scale-factor=2` 得到 880×560 / 2800×1120，Pillow 用 LANCZOS 缩到目标尺寸，等于 2× 超采样抗锯齿。13px 的小字在 440 宽里才不至于毛边。
- **一律 `convert('RGB')` 再存盘**：PNG 因此一定落成 `colortype=2`、无 `tRNS`，JPEG 也不会有 alpha 一说。无头截图理论上可能带 alpha 通道，转一次就一劳永逸。
- **`--default-background-color=0a4238`**：浏览器默认背景设成品牌深绿而不是透明，避免旋转元素的边缘像素跟黑色合成出暗边。
- `--check` 校验四件事：尺寸精确、PNG `depth=8 && colortype=2`、无 `tRNS`、文件 ≤3MB。

---

## 5. 截图怎么拍

后台把截图分成**两个输入区**，规则相同但用途不同：

| 输入区 | 什么时候用 | 我们给哪套 |
|---|---|---|
| 以当地语言显示的屏幕截图 | 每个语言区各一份，用户看的是本地化版本 | en 页 → `-en`，zh 页 → `-zh` |
| 全球通用的屏幕截图 | 所有语言共用一份兜底 | 复用英文那套 |

### 5.0 硬性规则（四条，少一条就报错）

1. 尺寸**必须**是 **1280×800** 或 **640×400**，差一个像素都不行
2. 格式 JPEG 或 **24 位 PNG（无 alpha 透明层）**
3. 每个语言区 **至少 1 张、最多 5 张**
4. 传的是合成后的成品，**不是** `raw/` 里的原图

第 2 条最容易踩：截图工具存出来的 PNG 常带 alpha 通道，肉眼完全看不出来，上传时直接被拒。脚本用 Pillow 转成真正的 24 位 RGB，并用 `--check` 读 PNG 的 IHDR 验证颜色类型确实是 2（真彩无 alpha）、且没有 `tRNS` 块。

### 5.1 需要这几张画面

| 序号 | 画面 | 从哪里进 | 为什么要它 |
|---|---|---|---|
| 1 | 统计报表页 | 弹窗 → 统计 → 打开报表 | 热力图 + 时长卡片同框。**商店列表首图就是它** |
| 2 | 收藏体检页 | 弹窗 → 收藏 → 收藏体检 | 按访问次数排序的榜单，功能一眼能懂 |
| 3 | 弹窗 · 收藏页 | 点扩展图标 | 收藏卡片、标签、待看 |
| 4 | 弹窗 · 收拢页 | 点扩展图标后切页签 | 会话列表，看得出「收拢」做了什么 |

**当前状态**：只有 1 和 4 的原始截图，**2、3 还缺**。缺也能出图（各语言 2 张，满足「至少 1 张」），但收藏体检是最差异化的功能，建议补上。

### 5.2 两个坑

**隐私**：真实书签标题、域名、会话名会随图公开。上图前确认没有工作系统、邮箱、内部链接。

**语言要一致**：中文区的截图最好来自中文界面的扩展。现在 `-zh` 那套是「中文标题 + 英文页面内容」——因为扩展当前界面语言是英文。要让中文区完整，在扩展**关于**页把语言切成中文，重截一遍再跑脚本。

### 5.3 一键合成

原始截图尺寸不用管，脚本会裁切、等比缩放、配背景和文案，输出严格的 1280×800 无 alpha 文件。

```bash
# 1. 原始截图按固定名字放进 raw 目录（任何尺寸都行）
#    release/screenshots/raw/1-stats.png
#    release/screenshots/raw/2-audit.png          ← 缺
#    release/screenshots/raw/3-popup-bookmarks.png ← 缺
#    release/screenshots/raw/4-popup-sessions.png

# 2. 合成：中英各一套，PNG + JPEG 各一份
python scripts/make-screenshots.py
python scripts/make-screenshots.py --lang en    # 只出英文
python scripts/make-screenshots.py --no-jpg     # 只出 PNG

# 3. 提交前校验（尺寸 / 位深 / alpha / 张数）
python scripts/make-screenshots.py --check
```

⚠️ **`raw/` 里的原图一律不合规**：实测 474×600 和 1438×736，直传必然报「图片尺寸不正确」。

⚠️ 缺几张也能跑——脚本列出缺哪几个，先出已有的，补齐后再跑一次覆盖。

### 5.4 两种版式

- **`page`**（报表、体检查询类页面）：标题 + 副标题在左上，页面截图装进圆角卡片，**等比缩放、不裁切**。
  > 上一版用的是 `object-fit: cover`，1438×736 的图被塞进 1.6 的画面，左右各切掉约 140px——标题「Browsing stats」被切成「wsing stats」。现在改成等比缩放放进卡片，整页内容完整可见。
- **`popup`**（窄高的扩展弹窗）：左侧标题 + 三条功能点，右侧弹窗卡片带圆角阴影。

`SLIDES` 里每张可以配 `crop: (左, 上, 右, 下)` 做前期裁切，用来去掉滚动条、或让画面停在卡片之间的空白行上（避免底边把卡片切一半）。当前配置：

| 图 | 裁切 | 原因 |
|---|---|---|
| `1-stats.png` | `(0,0,1438,604)` | 原图底部两张卡被视口切断，裁到热力图卡片下方的空白行（实测 y=591–608 是纯底色） |
| `4-popup-sessions.png` | `(0,0,460,525)` | 去掉右侧滚动条，并在第 3 张卡片下方的空白处收尾 |

⚠️ 换了新截图后，`crop` 的坐标要重新量——换成别的页面、别的窗口宽度都会失效。不去量就先删掉 `crop`，让脚本按原图整张用。

文案在脚本顶部 `SLIDES` 里，改措辞直接编辑。

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

### 6.1 以后想自动化发版（现在不做）

两家商店都有发布 API，**但第一次提交必须在网页后台手工做完**——产品 ID 由后台分配，没有第一次就没有 ID。所以这条只在上架之后才有意义。

Edge 的流程是两步异步，容易踩坑：

```bash
# 1. 传包（202 Accepted 只代表"开始处理"，不代表成功）
curl -X POST "https://api.addons.microsoftedge.microsoft.com/v1/products/$PRODUCT_ID/submissions/draft/package" \
  -H "Authorization: ApiKey $API_KEY" -H "X-ClientID: $CLIENT_ID" \
  -H "Content-Type: application/zip" --data-binary @release/TabPocket-v0.6.1.zip -D -

# 2. 用上一步 Location 头里的 operationId 轮询到 Succeeded，再提交
curl -X POST "https://api.addons.microsoftedge.microsoft.com/v1/products/$PRODUCT_ID/submissions" \
  -H "Authorization: ApiKey $API_KEY" -H "X-ClientID: $CLIENT_ID" \
  -H "Content-Type: application/json" -d '{"notes":"Release 0.7.0 — 见 release notes"}'
```

两个坑：v1.1 用 `Client ID + API key` 走请求头，v1 用 OAuth Bearer，**两代鉴权并存**，抄网上示例容易混用；API key 会过期，到期不轮换会让发版静默失败（只返回 401，CI 里如果没检查状态码就当成功了）。

优先级：低于所有功能开发。一两个月才发一次版，手工点几下不痛。详见 `ROADMAP.md` §6。

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

## 8. 政策条款自查（2026-11-02 对着官方原文逐条过）

来源：`https://developer.chrome.com/docs/webstore/program-policies/policies`（47 个条款，下面只列与 TabPocket 有关的）

| 条款 | 政策要什么 | 我们的情况 | 状态 |
|---|---|---|---|
| Privacy Policy | 处理任何用户数据就必须发布准确、最新的隐私政策，并全面披露收集 / 使用 / 共享及**共享对象** | `docs/privacy.html` 有存储表、权限表、共享说明 | 已有 |
| **Limited Use** | **必须在扩展自己的网站上明确声明遵守 Limited Use** | 补在 `privacy.html` §3，中英各一段，照抄官方句式 | **本轮新增** |
| Limited Use | 禁止采集浏览活动，除非是商店页与界面里显著描述的用户可见功能 | 收藏排序、体检、统计都是界面里看得见的功能 | 合规 |
| Use of Permissions | 取最窄权限，不得为"将来可能用到"预留 | 8 个都有当期用途；`unlimitedStorage`、`idle` 最易被追问，理由里点名了替代方案 | 靠理由说服 |
| Disclosure Requirements | 安装前显著披露收什么数据、怎么用 | 隐私权规范页的勾选会公开显示；本轮又在描述里加了 "What it reads" 一段 | **本轮新增** |
| **Accepting Payment** | **基础功能要付费，必须在安装前看到的描述里写明；且须声明卖家是开发者本人、不是 Google** | 暂不收费。将来做 Pro 必须先改描述，否则属隐瞒收费 | 未涉及 |
| Ads / Affiliate Ads | 不得注入、不得静默改写链接；联盟必须显著披露且需用户动作 | 零广告、零联盟、零外链改写 | 合规 |
| Spam and Abuse | 不得提交多个功能重复的扩展 | 印证了「不拆中英两个扩展」的决定 | 合规 |
| Quality Guidelines | 单一、狭窄、易理解的用途，不得捆绑无关功能 | 四块功能靠单一用途说明论证成「同一份本地记录的四个视图」 | **最脆弱** |
| Listing Requirements | 空白描述、缺图标、缺截图直接拒 | 正在补 | 进行中 |
| Listing Requirements | 隐私字段与隐私政策或**实际行为**矛盾 → 可下架 | 本轮逐条 grep 过代码，改掉 4 处不符 | 合规 |
| Keyword Spam | 同一关键词非自然重复超过 5 次 | 描述 302 词，`bookmarks` 6 次但属功能名 | 低风险 |
| Code Readability | 不得混淆代码，minify 允许 | vite 产物是去空白 + 短变量名 | 合规 |
| **MV3 附加要求** | 远程只能取「数据」不能取逻辑。明确允许 *"Fetching a remote configuration file for A/B testing or determining enabled features, where all logic for the functionality is contained within the extension package"* | 目前零网络请求。将来做 license 校验时，远程只返回「是否已付费」这一个状态，判断逻辑留在包内 | 合规 |
| 2-Step Verification | 发布与更新前必须开 2SV | 注册账号时一并办 | 待办 |

### 三条值得记住的

1. **Limited Use 声明是独立开发者最常漏的一条**。它不在「隐私权规范」表单里，而在政策正文，要求写在**你自己网站的隐私政策上**。之前 `privacy.html` 通篇没有 "Limited Use" 字样，等于少一条硬性披露。
2. **MV3 明确允许远程取配置做功能开关**。这直接决定将来付费墙怎么做：远程只回 `{paid:true}`，判断逻辑不能放到远程，否则就是远程代码违规。
3. **Quality Guidelines 是 TabPocket 最脆弱的地方**。会话、收藏、统计、体检四块，审核员完全可以质疑「捆绑无关功能」。单一用途说明已经按「同一份本地记录的四个视图」论证过，但如果被拒，第一件该做的不是补材料，而是考虑把「浏览统计」拆出去单独上架。

### 改完要做的

- `docs/privacy.html` 本轮改动**尚未 push**，线上仍是旧版。提交前必须推，否则审核员打开看不到 Limited Use。
- 描述文案改了，后台描述框要重新粘 `paste/en/03-description.txt`（现在 2,155 字符）。

---

*本文档随扩展版本维护。当前对应 v0.6.1。*
