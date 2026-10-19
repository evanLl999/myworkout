# 数据结构

## 存储位置

| 运行方式 | 实现 | 位置 |
|---|---|---|
| 手机 PWA / 浏览器 | IndexedDB | 数据库 `myworkout`，DB_VERSION 3，8 个 object store |
| Electron | sql.js + SQLite | `userData/myworkout.db` |

两套存储结构保持一致，字段名使用 snake_case。

## 1. exercise_configs — 训练计划动作

| 字段 | 类型 | 说明 |
|---|---|---|
| id | number | 主键，自增 |
| day_of_week | number | 0=周一 ~ 6=周日 |
| muscle_group | string | 肌肉群 |
| exercise_name | string | 动作名称 |
| default_weight | number | 当前配重 kg |
| target_sets | number | 目标组数 |
| target_reps | number | 每组次数 |
| sort_order | number | 手动排序，越小越靠前 |
| image_data | string / null | 压缩后的 JPEG data URL |
| is_required | 0 / 1 | 是否必练 |
| is_archived | 0 / 1 | 1 表示已从计划中归档 |
| created_at | string | 创建时间 |
| updated_at | string | 更新时间 |

删除动作时只把 `is_archived` 设为 1，不删除动作行，也不删除关联打卡。

## 2. workout_sessions — 每天的训练会话

| 字段 | 类型 | 说明 |
|---|---|---|
| id | number | 主键 |
| date | string | `YYYY-MM-DD`，唯一 |
| started_at | string | 会话创建时间 |
| completed_at | string / null | 必练全部完成时间 |
| training_started_at | string / null | 点击「开始训练」或首次打卡时间 |
| training_ended_at | string / null | 点击「结束训练」时间 |

## 3. set_logs — 每组打卡

| 字段 | 类型 | 说明 |
|---|---|---|
| id | number | 主键 |
| session_id | number | 关联 workout_sessions |
| exercise_config_id | number | 关联 exercise_configs |
| set_number | number | 第几组 |
| weight_used | number | 当组实际重量 |
| reps_done | number | 当组次数 |
| exercise_name | string / null | 打卡时的动作名快照 |
| muscle_group | string / null | 打卡时的肌肉群快照 |
| completed_at | string | 打卡时间 |

`exercise_name` / `muscle_group` 是快照字段。之后修改动作名或归档动作，
历史记录仍显示打卡当时的内容。旧数据没有快照时，读取时回退到当前配置。

## 4. weight_changes — 重量变更历史

| 字段 | 类型 | 说明 |
|---|---|---|
| id | number | 主键 |
| exercise_config_id | number | 关联动作 |
| old_weight | number | 变更前 |
| new_weight | number | 变更后 |
| changed_at | string | 变更时间 |

## 5. weight_logs — 体重记录

| 字段 | 类型 | 说明 |
|---|---|---|
| id | number | 主键 |
| date | string | `YYYY-MM-DD`，唯一（一天一条） |
| weight_kg | number | 体重 kg |
| note | string | 备注，如「早晨空腹」 |
| created_at | string | 创建时间 |
| updated_at | string | 更新时间 |

同一天再次保存会覆盖原记录。趋势评估使用最近 28 天的线性回归斜率 × 7，
按每周下降 0.25–0.75 kg 为「良好」。

## 6. nutrition_plans — 膳食阶段

| 字段 | 类型 | 说明 |
|---|---|---|
| id | number | 主键 |
| name | string | 阶段名，如「减脂阶段 01」 |
| start_date | string | 阶段开始日期 |
| calories | number | 每日目标热量 |
| protein | number | 蛋白质 g |
| carbs | number | 碳水 g |
| fat | number | 脂肪 g |
| note | string | 阶段说明/身体数据 |
| is_active | 0 / 1 | 当前阶段 |
| created_at | string | 创建时间 |
| updated_at | string | 更新时间 |

## 7. nutrition_items — 每日食材

| 字段 | 类型 | 说明 |
|---|---|---|
| id | number | 主键 |
| plan_id | number | 关联 nutrition_plans |
| meal | string | 餐次，默认「每日固定」 |
| food_name | string | 食材名 |
| amount | string | 数量，保留原始输入 |
| unit | string | g / 个 / ml / 份 |
| note | string | 生重、去壳、熟重等称重方式 |
| sort_order | number | 排序 |

## 8. app_settings — 本地设置

| 字段 | 类型 | 说明 |
|---|---|---|
| key | string | 主键，如 `weight_goal` |
| value | string | 值，字符串存储 |

目前用于保存 `weight_goal`（目标体重）和 `weight_goal_visible`（目标线显示开关）。
两项设置都包含在备份中。

## 备份格式

导出文件是 JSON：

```json
{
  "app": "myworkout",
  "version": 3,
  "exported_at": "2026-10-20T12:00:00.000Z",
  "configs": [],
  "sessions": [],
  "set_logs": [],
  "weight_changes": [],
  "weight_logs": [],
  "nutrition_plans": [],
  "nutrition_items": [],
  "app_settings": []
}
```

导入采用整库覆盖，保留记录的 `id`，并恢复归档状态。v1 旧备份没有体重/膳食数组时，
对应数据会为空；导入前必须二次确认。

## 迁移规则

- IndexedDB 当前 DB_VERSION 为 3；从 v1 升级时新增 `weight_logs`、`nutrition_plans`、
  `nutrition_items`，v3 再新增 `app_settings`；旧数据不受影响。
- SQLite 新增字段使用 `ALTER TABLE ... ADD COLUMN`，并包在 try/catch 中处理字段已存在。
- 新增字段必须有默认值或允许为 null，保证旧数据库可以直接打开。
