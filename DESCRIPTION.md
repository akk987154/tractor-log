# TractorLog

TractorLog 是一个离线优先的拖拉机维护日志 PWA，用于记录保养、管理设备和查看保养提醒。

## 核心内容

- 维护日志：记录保养类型、日期、小时数、费用和零件信息
- 农机管理：管理多台拖拉机资料
- 保养提醒：自动计算即将到期和已超期项目
- PWA 离线支持：可安装到手机桌面，离线也可使用
- 本地存储：数据保存在浏览器 IndexedDB 中

## 技术栈

- Vue 3
- Vite
- vite-plugin-pwa
- IndexedDB

## 运行方式

```bash
npm install
npm run dev
```

## 适合上传到 GitHub 的描述

一个面向拖拉机车队维护管理的离线 PWA，用于记录保养日志和提醒服务周期。