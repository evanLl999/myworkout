# 数据库表结构

## 概述

使用 SQLite 数据库（better-sqlite3），文件存储在 Electron `userData` 目录下，文件名为 `myworkout.db`。

启用 WAL 模式和外键约束。

---

## 表结构

### 1. exercise_configs — 训练配置模板

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 主键 |
| day_of_week | INTEGER | NOT NULL, CHECK(0-6) | 0=周一 ~ 6=周日 |
| muscle_group | TEXT | NOT NULL | 肌肉群名称 |
| exercise_name | TEXT | NOT NULL | 动作名称 |
| default_weight | REAL | NOT NULL, DEFAULT 0 | 默认配重(kg) |
| target_sets | INTEGER | NOT NULL, DEFAULT 1 | 目标组数 |
| target_reps | INTEGER | NOT NULL, DEFAULT 1 | 每组次数 |
| sort_order | INTEGER | NOT NULL, DEFAULT 0 | 排序序号 |
| created_at | TEXT | NOT NULL | 创建时间 |
| updated_at | TEXT | NOT NULL | 最后修改时间 |

### 2. workout_sessions — 训练会话

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 主键 |
| date | TEXT | NOT NULL, UNIQUE | 日期 YYYY-MM-DD |
| started_at | TEXT | NOT NULL | 开始时间 |
| completed_at | TEXT | 可空 | 完成时间 |

### 3. set_logs — 打卡记录

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 主键 |
| session_id | INTEGER | NOT NULL, FK→workout_sessions | 关联会话 |
| exercise_config_id | INTEGER | NOT NULL, FK→exercise_configs | 关联动作 |
| set_number | INTEGER | NOT NULL | 第几组 |
| weight_used | REAL | NOT NULL | 实际重量(kg) |
| reps_done | INTEGER | NOT NULL | 实际次数 |
| completed_at | TEXT | NOT NULL | 打卡时间 |

### 4. weight_changes — 重量变更历史

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 主键 |
| exercise_config_id | INTEGER | NOT NULL, FK→exercise_configs | 关联动作 |
| old_weight | REAL | NOT NULL | 旧重量(kg) |
| new_weight | REAL | NOT NULL | 新重量(kg) |
| changed_at | TEXT | NOT NULL | 变更时间 |

---

## 索引

- workout_sessions.date（唯一索引）
- set_logs(session_id)
- set_logs(exercise_config_id)
- weight_changes(exercise_config_id)

---

## 级联删除规则

删除 exercise_config 时，同步删除其关联的 set_logs 和 weight_changes 记录。
