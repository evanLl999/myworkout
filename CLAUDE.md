# CLAUDE.md — MyWorkOut 项目助手指引

## 项目简介

MyWorkOut 是一款个人健身日志应用，当前主要形态是部署在 GitHub Pages 上的 PWA：
iPhone Safari 打开后选择「添加到主屏幕」，日常使用体验接近原生 App。

同一套 React 代码保留了 Electron 桌面壳（Windows），但桌面版目前不是发布目标，
也没有配置安装包打包脚本。新增功能时，以手机 PWA 的体验为准。

## 在线地址

https://evanll999.github.io/myworkout/

## 视觉方向

当前视觉语言是「运动杂志感」：暖白纸张、墨黑结构、焦橙强调。

- 设计令牌集中在 `src/styles/global.css` 的 `:root`。
- 顶部是品牌栏，底部是浮动 Dock，不再是旧的侧边栏/纯白卡片。
- 当前训练动作使用墨黑焦点卡；其他动作保持暖白卡片。
- 图表、图标统一使用 `src/components/Icons.tsx` 的 SVG，不使用 emoji 当图标。
- 添加/编辑表单和日历使用底部抽屉（portal 到 body，锁定背景滚动）。
- 强调色可在顶部调色盘切换；不要改背景色和墨黑结构。

## 启动与验证

```bash
npm install
npm run dev        # Vite + Electron 开发模式
npm run build      # 生产构建（输出 dist/）
npx tsc --noEmit   # 类型检查（vite build 不做类型检查）
npm run check      # 类型检查 + 生产构建
```

推送到 `master` 后，`.github/workflows/deploy.yml` 会自动构建并发布到 GitHub Pages。

## 数据存储

| 运行方式 | 存储 | 位置 |
|---|---|---|
| 手机 PWA / 浏览器 | IndexedDB | 数据库名 `myworkout` |
| Electron | sql.js + SQLite | `userData/myworkout.db` |

两套后端共用 `src/db/api.ts` 的接口。修改数据结构或查询时，必须同步修改
`src/db/browser-db.ts` 和 `electron/database.js`。

训练记录只保存在当前设备。备份入口在「我的计划」页底部，支持导出 JSON、
复制备份内容和导入恢复。

当前 IndexedDB `DB_VERSION = 3`，在原有 4 个 store 基础上新增：

- `weight_logs`：体重记录（一天一条）
- `nutrition_plans`：膳食阶段
- `nutrition_items`：阶段下的每日食材
- `app_settings`：目标体重等本地设置

初始膳食模板在 `src/data/nutrition-template.json`，浏览器和 Electron 共用。
体重评估使用最近 28 天的线性回归斜率 × 7，每周下降 0.25–0.75 kg 为「良好」。

补练通过 `workout_sessions.plan_day_of_week` 实现：只改变某个日期的动作来源，
不要修改 `exercise_configs.day_of_week`，否则会改掉后续每周的计划。

## 标准文档

| 文件 | 用途 |
|------|------|
| [docs/requirements.md](docs/requirements.md) | 需求规格说明 |
| [docs/tech-stack.md](docs/tech-stack.md) | 技术栈与架构 |
| [docs/design-spec.md](docs/design-spec.md) | UI 设计规范 |
| [docs/database-schema.md](docs/database-schema.md) | 数据结构与迁移规则 |
| [docs/dev-steps.md](docs/dev-steps.md) | 阶段进度与验收标准 |

## 工作规范

1. **先读文档再动手**：开始一个阶段前，先看对应的标准文档。
2. **数据安全优先**：动作删除采用归档，不物理删除历史打卡；打卡时保存动作名和
   肌肉群快照，之后改名不能改写历史。
3. **PWA 路径不能写死**：资源、Service Worker、manifest 都要跟随
   `import.meta.env.BASE_URL` 或相对路径，保证部署在 `/myworkout/` 子路径下可用。
4. **类型检查必须通过**：提交前运行 `npx tsc --noEmit`。
5. **保持简洁**：代码不加多余注释，组件专注单一职责，能用原生 CSS 就不加依赖。
6. **视觉一致**：新增组件先复用设计令牌和 `Icons.tsx`，不要引入 emoji 图标或第三方 UI 库。
7. **安全第一**：Electron 保持 contextIsolation + preload 白名单，所有数据库操作走 IPC。
8. **健康数据谨慎表达**：体重评估和膳食模板是趋势参考，不写成医疗诊断或处方。
9. **记录开发日志**：每次开发会话结束，在 `dev-log/YYYY-MM-DD.md` 记录已完成、待办、风险。

## 技术要点

- 渲染进程：`src/`，React 18 + TypeScript + Vite
- 主进程：`electron/main.js`，窗口管理与 IPC
- 预加载：`electron/preload.js`，白名单 IPC 桥接
- 浏览器数据库：`src/db/browser-db.ts`，IndexedDB
- 桌面数据库：`electron/database.js`，sql.js
- 样式：`src/styles/global.css`，CSS 变量，主色 `--primary`
- 训练状态卡：`src/components/SessionHero.tsx`
- 图标库：`src/components/Icons.tsx`
- 添加/编辑抽屉：`src/components/DayConfig.tsx`
- 体重趋势页：`src/pages/WeightPage.tsx`
- 体重 SVG 图表：`src/components/WeightChart.tsx`
- 膳食指南页：`src/pages/NutritionPage.tsx`
- 膳食模板：`src/data/nutrition-template.json`
- PWA：`public/sw.js` + `public/manifest.json`，导航请求网络优先、静态资源缓存优先
