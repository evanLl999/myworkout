# CLAUDE.md — MyWorkOut 项目助手指引

## 项目简介

MyWorkOut 是一款 Windows 桌面健身日志应用，基于 Electron + React + TypeScript 构建，以"周"为时间单位管理个人健身记录。

## 标准文档路径

所有开发规范和设计文档位于 `docs/` 文件夹，是项目实现的单一事实来源：

| 文件 | 用途 |
|------|------|
| [docs/requirements.md](docs/requirements.md) | 需求规格说明、功能清单 |
| [docs/tech-stack.md](docs/tech-stack.md) | 技术栈选型与架构说明 |
| [docs/design-spec.md](docs/design-spec.md) | UI 设计规范（配色、布局、组件） |
| [docs/database-schema.md](docs/database-schema.md) | 数据库表结构 |
| [docs/dev-steps.md](docs/dev-steps.md) | 分阶段执行步骤与验收标准 |

## 开发日志

每次开发会话结束时，在 `dev-log/YYYY-MM-DD.md` 中记录：
- **已完成**：实际完成的事项
- **待办**：下一步要做什么
- **问题/风险**：遇到的阻碍

如果当天文件已存在，追加内容（标时间戳）。

## 工作规范

1. **分阶段推进**：严格按照 `docs/dev-steps.md` 中的阶段顺序开发，每个阶段完成后验收通过再进入下一阶段
2. **先读文档再动手**：开始每个阶段前，阅读对应的标准文档了解规范
3. **保持简洁**：代码不加多余注释，组件专注于单一职责
4. **不引入多余依赖**：能用原生 CSS 解决的不加库，能自研的组件不引入第三方
5. **安全第一**：Electron 使用 contextIsolation + preload 隔离，所有数据库操作走 IPC

## 技术要点

- **主进程**：`electron/main.js` — 窗口管理
- **预加载**：`electron/preload.js` — 安全 IPC 桥接，白名单通道
- **渲染进程**：`src/` — React 前端
- **数据库**：`electron/database.js` — better-sqlite3 操作封装（阶段 1 创建）
- **样式**：CSS 变量定义在 `src/styles/global.css`，主色 `--primary: #5B9BD5`

## 启动命令

```bash
npm run dev    # 启动 Vite dev server + Electron 窗口
npm run build  # 构建生产版本
```
