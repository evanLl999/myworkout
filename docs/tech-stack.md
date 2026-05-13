# 技术栈

| 层 | 选择 | 版本 | 原因 |
|---|---|---|---|
| 桌面框架 | Electron | 42.x | 成熟稳定，Windows 支持好，后续可跨平台 |
| 前端框架 | React | 18.x | 组件化开发，生态丰富 |
| 语言 | TypeScript | 5.x | 类型安全，减少运行时错误 |
| 构建工具 | Vite | 6.x | 开发启动快，HMR 体验好 |
| 数据库 | sql.js | 1.x | SQLite 的 WebAssembly 版本，无需编译，纯 JS 运行 |
| 样式 | CSS 变量 | - | 无额外依赖，维护简单 |

## 架构说明

- **主进程** (`electron/main.js`)：窗口管理 + 数据库操作
- **预加载** (`electron/preload.js`)：安全 IPC 桥接层
- **渲染进程** (`src/`)：React UI，通过 `window.electronAPI` 调用主进程

## 待定项

- 手机端方案：React Native 或 PWA（后续评估）
- 打包工具：electron-builder（阶段 7 引入）
