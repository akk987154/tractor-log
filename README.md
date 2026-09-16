# 🚜 TractorLog — 农机维护日志 PWA

<!--
  这应该是所有项目里迭代最折腾的一个——从最开始只是一个简单的 localStorage JSON 数组，
  到 IndexedDB、到 PWA Service Worker、到智能提醒算法……
  Service Worker 的缓存策略调了好几版（一开始 cache-first 导致更新不及时，改成了 stale-while-revalidate）。
  维护周期的数据也是对照 TractorCompare 那边的各机型发动机参数来设的默认值。
-->

[![Vue 3](https://img.shields.io/badge/Vue-3.5-4fc08d?logo=vuedotjs)](https://vuejs.org)
[![Vite 8](https://img.shields.io/badge/Vite-8.0-646cff?logo=vite)](https://vitejs.dev)
[![PWA](https://img.shields.io/badge/PWA-ready-5a0fc8?logo=pwa)](https://web.dev/progressive-web-apps/)

**TractorLog** 是 [TractorTools](https://github.com/seb/tractor-tools) 生态的维护记录模块。它是五个工具里唯一一个"离线优先"的设计——因为维护记录经常在田间地头、信号不好的地方录入，所以从一开始就决定了要走 PWA + IndexedDB 路线。数据完全存储在浏览器本地，不上传任何服务器。如果你在用 [FarmCalc](../farm-calc) 做预算，维护成本可以从这里导出反哺；如果你在 [TractorCompare](../tractor-compare) 看中了一款机型，这里的保养周期可以帮你预估后期养车成本。

---

## 🗺️ 项目生态

| 项目 | 定位 | 与本项目的关系 |
|------|------|---------------|
| [FarmCalc](../farm-calc) | 成本/ROI 计算 | 实际维护花费可导出到 FarmCalc，对比预算 vs 实际 |
| [TractorCompare](../tractor-compare) | 规格对比 | 各机型保养周期参考数据（发动机/液压参数决定维护频率） |
| [TractorVIN](../tractor-vin) | 序列号解码 | 解码后可直接在此创建对应机型的维护档案 |
| [TractorWatch](../tractor-watch) | 二手价格追踪 | 完整维护记录 = 卖二手时的加分项，数据可导出 |

---

## 中文

### 功能

- 📋 **维护日志** — 记录每次保养：类型、日期、小时数、费用、更换零件、备注。支持按拖拉机筛选
- 🚜 **农机管理** — 管理多台拖拉机（名称、品牌、型号、年份、当前小时数），卡片式展示
- 🔔 **智能提醒** — 不是简单倒计时——算法会查你每台机器的历史记录，算出"上次做了某项保养后跑了多少小时"，对比标准周期来判断到期/超期
- 📱 **PWA 离线可用** — 安装到手机桌面，Service Worker 预缓存应用外壳（precache + 自动更新）。维护数据存在 IndexedDB，不经过 SW 缓存
- 💾 **本地存储** — IndexedDB，两个 Object Store（tractors + maintenance），支持索引查询 + 级联删除
- 🇨🇳 中文界面

### 快速开始

```bash
npm install
npm run dev        # 开发模式 http://localhost:5173
npm run build      # 生产构建（含 Service Worker 预缓存）
npm run preview    # 预览生产构建
```

### 使用方式

1. 在"农机管理"页添加拖拉机（至少一台）
2. 在"维护日志"页记录保养——选拖拉机 → 选保养类型 → 填日期/小时数/费用/零件
3. 切到"保养提醒"页，系统自动计算每台机器的到期/超期状态

### 保养周期（默认值）

这些默认周期参考了 [TractorCompare](../tractor-compare) 中各机型的发动机排量和液压流量数据，综合设定的通用值。后续版本会支持按机型自动匹配更精确的周期（从 TractorCompare 的数据直接读取）。

| 保养项目 | 标准周期 | 严重超期阈值 |
|---------|---------|------------|
| 机油更换 | 250 小时 | 500 小时 |
| 滤芯更换 | 500 小时 | 1,000 小时 |
| 液压油更换 | 1,000 小时 | 2,000 小时 |
| 变速箱保养 | 1,500 小时 | 3,000 小时 |
| 润滑 | 50 小时 | 100 小时 |
| 轮胎检查 | 500 小时 | 1,000 小时 |
| 电瓶检查 | 1,000 小时 | 2,000 小时 |
| 皮带更换 | 1,000 小时 | 2,000 小时 |

> "严重超期阈值" = 2 × 标准周期，即从上次保养起算已跑满两个周期。

### 提醒算法

跟简单的"固定周期倒计时"不同，这里的逻辑是：

1. 查该拖拉机最近一次该类型保养的记录
2. 算出"从上次保养到现在跑了多少小时"
3. 对比标准周期 → 正常 / 即将到期 / 已超期
4. 即将到期 = 剩余 ≤ 10% 周期；超期 = 已超出周期
5. 如果超期超过 2 倍周期（严重超期），用红色高亮

这个算法的灵感其实来自 [TractorWatch](../tractor-watch) 那边的价格异动检测——都是"查上次快照 → 算差值 → 跟阈值比"的模式。

### 技术栈

Vue 3 (Composition API) · Vite 8 · vite-plugin-pwa (Workbox) · IndexedDB (原生 API)

选 Vue 3 的原因很简单——这个项目在五个工具里 UI 交互最重（表单、列表、卡片、标签页），Vue 的响应式 + 模板语法写这类 CRUD 密集型界面最顺手。[FarmCalc](../farm-calc) 偏计算展示所以用 Svelte，[TractorCompare](../tractor-compare) 偏内容展示所以用 Next.js，各有各的选型理由。

### PWA 缓存策略

当前用的是 Workbox **预缓存（precache）+ 自动更新**，不是 stale-while-revalidate：

- `workbox.globPatterns` 把构建产物（js/css/html/svg/manifest）全部列入 precache 清单
- 资源带 revision 哈希，内容变了才会有新条目
- `registerType: 'autoUpdate'` 生成 `skipWaiting()` + `clientsClaim()`，新版本部署后接管已打开的页面
- 导航请求由 `NavigationRoute` 兜底到 `index.html`（已用 `navigateFallbackDenylist` 排除 `/api/`）

**维护数据不走 SW 缓存** —— 全部存在 IndexedDB，由应用直接读写。所以"添加了拖拉机但列表不更新"如果出现，问题一定在 IndexedDB 读写或 UI 刷新，与 SW 缓存策略无关，改缓存策略是治不好的。

`registerType: 'autoUpdate'` 对当前"单一 bundle、无懒加载路由"的结构是安全的。一旦引入代码分割或懒加载，应改为 `'prompt'` 并配合 `useRegisterSW` 给出更新提示，否则已打开的页面可能请求到已被 `cleanupOutdatedCaches` 清理掉的旧 chunk。

配置在 `vite.config.js` 的 `VitePWA` 插件中，生成 `sw.js` 和 manifest。

---

## English

### Features

- 📋 **Maintenance Log** — Record every service: type, date, hours, cost, parts, notes. Filter by tractor.
- 🚜 **Fleet Management** — Add/manage multiple tractors with card-based UI
- 🔔 **Smart Alerts** — Algorithm checks each tractor's actual history to determine due/overdue, not just a dumb countdown
- 📱 **Offline PWA** — Installable on iOS/Android, Workbox precache + auto-update (maintenance data lives in IndexedDB, not in the SW cache)
- 💾 **Local Storage** — IndexedDB, two object stores, indexed queries, cascade deletes
- 🇺🇸 Chinese UI (code in English)

### Quick Start

```bash
npm install
npm run dev        # Dev at http://localhost:5173
npm run build      # Production build with Service Worker precache
```

### Service Intervals (Defaults)

| Service | Interval | Severe Overdue |
|---------|----------|----------------|
| Oil Change | 250 hrs | 500 hrs |
| Filter Change | 500 hrs | 1,000 hrs |
| Hydraulic Fluid | 1,000 hrs | 2,000 hrs |
| Transmission | 1,500 hrs | 3,000 hrs |
| Greasing | 50 hrs | 100 hrs |
| Tire Check | 500 hrs | — |
| Battery Check | 1,000 hrs | — |
| Belt Replacement | 1,000 hrs | — |

### Tech Stack

Vue 3 · Vite 8 · vite-plugin-pwa · IndexedDB

---

## 📋 迭代记录

<details>
<summary>点击展开</summary>

### v0.5 — 脚手架清理 + 数据层可靠性修复 (当前)
- 删除误引入的 Vite 脚手架样式 `src/style.css`。其中全局的 `h1,h2 { color: var(--text-h) }`
  配合深色模式下的 `--text-h: #f3f4f6`，会让"🚜 TractorLog"和"🔔 保养提醒"标题变成
  近白字压近白渐变背景，在系统开启深色模式的设备上实际不可读；同时移除
  `:root { font: 18px }` 对所有 rem 的 12.5% 放大
- 保养周期表补齐到全部 8 类（v0.4 声称已补，但代码里只有 5 类，轮胎/电瓶/皮带仍静默失效）
- 到期分级按 README 口径真正实现：剩余 ≤ 10% 周期为即将到期，剩余 < -周期 为严重超期
- IndexedDB 改为单例连接 + `onversionchange` 主动关闭 + `onblocked` 报错。
  原实现每次操作都开新连接且从不 close，多标签页版本升级会无限期挂起且没有任何提示
- 级联删除改为单事务跨两个 store。原实现开了两个独立事务却在其中一个上 resolve，
  维护记录可能尚未删完调用方就已刷新，界面残留记录、提前关页面则留下孤儿数据
- 组件内硬编码的 `indexedDB.open('tractorlog', 1)` 改为调用 db.js 的 `updateTractor`
- 所有写入加 try/catch 与界面提示（配额超限原先会静默失败、用户毫无反馈）
- 启动时申请持久化存储，降低浏览器清空全部保养记录的风险
- 日期按年月日分量解析，避免 `new Date('2024-01-01')` 被当作 UTC 午夜而在西半球时区差一天
- 删除按钮补 `aria-label` 与 `type="button"`
- manifest 补 `lang: zh-CN` 与 `id`；precache 清单去掉重复的 favicon.svg（6 项）
- 新增 vitest 单测 12 例，覆盖周期表完整性与到期分级口径

### v0.4 — PWA 缓存策略修复 + UI 打磨
- Service Worker 实际为 precache + autoUpdate（原文档误写为 stale-while-revalidate，已更正）
- 维护记录支持按拖拉机筛选
- 新增 8 种保养类型（当时代码只落地了 5 类周期，其余 3 类在 v0.5 补齐）
- 严重超期红色高亮（v0.5 才真正实现分级判定）

### v0.3 — 智能提醒 + PWA 安装
- 提醒算法重写——基于历史记录的实际间隔计算，不再是固定倒计时
- PWA 安装支持（manifest + SW 预缓存）
- IndexedDB 从单表拆成双表（tractors + maintenance），加了级联删除

### v0.2 — IndexedDB 迁移
- 从 localStorage JSON 重写为 IndexedDB 存储层（注意：当时没有写数据迁移逻辑，
  旧 localStorage 里的记录不会被带过来）
- 添加农机管理页（之前只有维护日志）
- 基础提醒（简单固定周期）

### v0.1 — 初始版本
- 单页维护日志
- localStorage 存储
- 基础的 Vue 3 + Vite 脚手架
- 仅 3 种保养类型（机油、滤芯、液压油）

</details>

## 🗓️ 路线图

- [ ] 从 [TractorCompare](../tractor-compare) 导入机型 → 自动匹配保养周期
- [ ] 导出维护成本到 [FarmCalc](../farm-calc)（对比预算 vs 实际）
- [ ] 从 [TractorVIN](../tractor-vin) 扫码/输入序列号直接创建档案
- [ ] 导出维护报告 PDF（卖二手时用，配合 [TractorWatch](../tractor-watch) 的估价）
- [ ] 拍照记录（维修前后对比图）
- [ ] 多设备同步（可选，需要用户授权）
