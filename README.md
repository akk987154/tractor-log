# 🚜 TractorLog — 农机维护日志 PWA

**TractorLog** is an offline-first Progressive Web App for tracking tractor maintenance records. All data is stored locally in IndexedDB — no server needed.

---

## 中文

### 功能

- 📋 **维护日志** — 记录机油、滤芯、液压油等各项保养，支持费用和零件追踪
- 🚜 **农机管理** — 管理多台拖拉机的基本信息
- 🔔 **保养提醒** — 基于当前小时数和保养周期自动计算到期/超期项目
- 📱 **PWA 离线可用** — 安装到手机桌面，无网络也能正常使用
- 💾 **本地存储** — IndexedDB 存于浏览器，数据完全私有
- 🇨🇳 中文界面

### 快速开始

```bash
npm install
npm run dev        # 开发模式 http://localhost:5173
npm run build      # 生产构建 (含 Service Worker)
npm run preview    # 预览生产构建
```

### 使用方式

1. 在"农机管理"标签页添加一台或多台拖拉机
2. 在"维护日志"标签页记录每次保养（类型、日期、小时数、费用、零件）
3. 在"保养提醒"标签页查看即将到期和已超期的保养项目

### 保养周期

| 项目 | 周期 |
|------|------|
| 机油更换 | 250 小时 |
| 滤芯更换 | 500 小时 |
| 液压油更换 | 1,000 小时 |
| 变速箱保养 | 1,500 小时 |
| 润滑 | 50 小时 |

### 技术栈

Vue 3 · Vite · vite-plugin-pwa · IndexedDB

---

## English

### Features

- 📋 **Maintenance Log** — Record oil changes, filter swaps, hydraulic service etc. with cost & parts tracking
- 🚜 **Fleet Management** — Manage multiple tractors
- 🔔 **Service Reminders** — Auto-calculates due/overdue items based on current hours and service intervals
- 📱 **Offline PWA** — Install on phone, works without internet
- 💾 **Local Storage** — IndexedDB in browser, fully private data
- 🇺🇸 Chinese UI (code in English)

### Quick Start

```bash
npm install
npm run dev        # Dev at http://localhost:5173
npm run build      # Production build with Service Worker
```

### How to Use

1. Add tractors in the "Fleet" tab
2. Log maintenance in the "Log" tab (type, date, hours, cost, parts)
3. Check the "Alerts" tab for due/overdue services

### Service Intervals

| Item | Interval |
|------|----------|
| Oil Change | 250 hrs |
| Filter Change | 500 hrs |
| Hydraulic Fluid | 1,000 hrs |
| Transmission | 1,500 hrs |
| Greasing | 50 hrs |

### Tech Stack

Vue 3 · Vite · vite-plugin-pwa · IndexedDB

### PWA

The app registers a Service Worker for offline caching. Installable on iOS Safari and Android Chrome via "Add to Home Screen".

```bash
npm run build   # Generates dist/ with sw.js and manifest
```
