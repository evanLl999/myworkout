# 技术栈与架构

## 技术栈

| 层 | 选择 | 说明 |
|---|---|---|
| 前端框架 | React 18 + TypeScript | 组件化，类型检查 |
| 构建工具 | Vite | 开发热更新，生产构建 |
| 手机端 | PWA | GitHub Pages 托管，添加到主屏幕 |
| 浏览器存储 | IndexedDB | 无后端，数据留在本机 |
| 桌面壳 | Electron 42 | 保留的 Windows 运行方式，非当前发布目标 |
| 桌面存储 | sql.js | SQLite 的 WebAssembly 版本，无需编译 |
| 样式 | 原生 CSS 变量 | 不引入 UI 库 |
| 体重图表 | 原生 SVG | 自绘折线/面积图，不引入图表库 |

## 运行形态

### 手机 PWA（主要）

- 线上地址：`https://evanll999.github.io/myworkout/`
- 首次打开后通过 Safari「分享 → 添加到主屏幕」
- `public/manifest.json` 提供应用名称、图标和独立窗口模式
- `public/sw.js` 提供离线缓存和自动更新
- 数据保存在当前浏览器的 IndexedDB，不上传服务器
- 底部导航包含：训练、体重、饮食、计划

### Electron（保留）

- `electron/main.js` 负责窗口和 IPC
- `electron/preload.js` 暴露白名单通道
- `electron/database.js` 使用 sql.js 读写 `userData/myworkout.db`

## 数据访问层

`src/db/api.ts` 是前端统一入口：

- 检测到 `window.electronAPI` 时通过 IPC 调用主进程
- 否则调用 `src/db/browser-db.ts` 的 IndexedDB 实现

新增数据库操作时，两套实现和 `preload.js` 白名单要一起更新。

## 身体数据模型

IndexedDB 当前 `DB_VERSION = 3`，在原有 4 个 store 基础上新增：

- `weight_logs`：体重记录，一天一条
- `nutrition_plans`：膳食阶段（热量、蛋白质、碳水、脂肪）
- `nutrition_items`：阶段下的每日食材
- `app_settings`：目标体重等设置键值

初始膳食模板位于 `src/data/nutrition-template.json`，浏览器和 Electron 共用。
体重趋势与周速度评估在 `src/pages/WeightPage.tsx` 中计算；
折线图由 `src/components/WeightChart.tsx` 用 SVG 绘制。

## 部署

`.github/workflows/deploy.yml` 在推送到 `master` 后执行：

1. `npm ci`
2. `npm run build`
3. 上传 `dist/` 到 GitHub Pages

Vite 使用 `base: './'`，所有资源必须使用相对路径或 `import.meta.env.BASE_URL`，
否则会部署到子路径 `/myworkout/` 时 404。

## 已知限制

- 没有账号和云同步，换设备需要手动导出/导入备份
- 数据清理、浏览器重装会导致本机记录丢失
- Electron 尚未配置 electron-builder，不能直接生成 exe
