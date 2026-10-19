const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const nutritionTemplate = require('../src/data/nutrition-template.json');

let db = null;
let dbPath = null;

function getDbPath() {
  if (!dbPath) {
    const userDataPath = app.getPath('userData');
    dbPath = path.join(userDataPath, 'myworkout.db');
  }
  return dbPath;
}

async function initDatabase() {
  if (db) return db;

  const SQL = await require('sql.js')();
  const dbFile = getDbPath();

  if (fs.existsSync(dbFile)) {
    const buffer = fs.readFileSync(dbFile);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS exercise_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_of_week INTEGER NOT NULL CHECK(day_of_week >= 0 AND day_of_week <= 6),
      muscle_group TEXT NOT NULL,
      exercise_name TEXT NOT NULL,
      default_weight REAL NOT NULL DEFAULT 0,
      target_sets INTEGER NOT NULL DEFAULT 1,
      target_reps INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      image_data TEXT DEFAULT NULL,
      is_required INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // 迁移：为已有数据库添加新字段
  try { db.run("ALTER TABLE exercise_configs ADD COLUMN image_data TEXT"); } catch (_) {}
  try { db.run("ALTER TABLE exercise_configs ADD COLUMN is_required INTEGER NOT NULL DEFAULT 1"); } catch (_) {}
  try { db.run("ALTER TABLE exercise_configs ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0"); } catch (_) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS workout_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      started_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      completed_at TEXT,
      training_started_at TEXT,
      training_ended_at TEXT
    )
  `);

  // 迁移：为已有数据库添加新字段
  migrateWorkoutSessions();

  db.run(`
    CREATE TABLE IF NOT EXISTS set_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      exercise_config_id INTEGER NOT NULL,
      set_number INTEGER NOT NULL,
      weight_used REAL NOT NULL,
      reps_done INTEGER NOT NULL,
      completed_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (session_id) REFERENCES workout_sessions(id),
      FOREIGN KEY (exercise_config_id) REFERENCES exercise_configs(id)
    )
  `);

  // 迁移：打卡时保存动作快照，之后改名或归档不影响历史
  try { db.run("ALTER TABLE set_logs ADD COLUMN exercise_name TEXT"); } catch (_) {}
  try { db.run("ALTER TABLE set_logs ADD COLUMN muscle_group TEXT"); } catch (_) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS weight_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise_config_id INTEGER NOT NULL,
      old_weight REAL NOT NULL,
      new_weight REAL NOT NULL,
      changed_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (exercise_config_id) REFERENCES exercise_configs(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS weight_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      weight_kg REAL NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS nutrition_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      calories REAL NOT NULL DEFAULT 0,
      protein REAL NOT NULL DEFAULT 0,
      carbs REAL NOT NULL DEFAULT 0,
      fat REAL NOT NULL DEFAULT 0,
      note TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS nutrition_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      meal TEXT NOT NULL DEFAULT '每日固定',
      food_name TEXT NOT NULL,
      amount TEXT NOT NULL,
      unit TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (plan_id) REFERENCES nutrition_plans(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  saveDb();
  return db;
}

function migrateWorkoutSessions() {
  // 用 try-catch 处理字段已存在的情况
  try { db.run("ALTER TABLE workout_sessions ADD COLUMN training_started_at TEXT"); } catch (_) {}
  try { db.run("ALTER TABLE workout_sessions ADD COLUMN training_ended_at TEXT"); } catch (_) {}
  saveDb();
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(getDbPath(), buffer);
}

// ========== 辅助：将查询结果转为对象数组 ==========

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function queryOne(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  let result = null;
  if (stmt.step()) {
    result = stmt.getAsObject();
  }
  stmt.free();
  return result;
}

function run(sql, params = []) {
  db.run(sql, params);
  const changes = db.getRowsModified();
  const lastInsertRowid = queryOne('SELECT last_insert_rowid() as id')?.id ?? 0;
  saveDb();
  return { changes, lastInsertRowid };
}

// ========== exercise_configs CRUD ==========

function getConfigsByDay(dayOfWeek, includeArchived = false) {
  return queryAll(
    `SELECT * FROM exercise_configs
     WHERE day_of_week = ?${includeArchived ? '' : ' AND is_archived = 0'}
     ORDER BY sort_order, id`,
    [dayOfWeek]
  );
}

function getAllConfigs(includeArchived = false) {
  return queryAll(
    `SELECT * FROM exercise_configs
     ${includeArchived ? '' : 'WHERE is_archived = 0'}
     ORDER BY day_of_week, sort_order, id`
  );
}

function addExercise({ day_of_week, muscle_group, exercise_name, default_weight, target_sets, target_reps, sort_order, image_data, is_required }) {
  const row = queryOne(
    'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM exercise_configs WHERE day_of_week = ? AND is_archived = 0',
    [day_of_week]
  );
  const requestedOrder = Number(sort_order);
  const sortOrder = Number.isFinite(requestedOrder) ? requestedOrder : (row ? row.next : 1);

  const result = run(
    `INSERT INTO exercise_configs (day_of_week, muscle_group, exercise_name, default_weight, target_sets, target_reps, sort_order, image_data, is_required)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [day_of_week, muscle_group, exercise_name, default_weight, target_sets, target_reps, sortOrder, image_data ?? null, is_required ? 1 : 0]
  );
  return result.lastInsertRowid;
}

function updateExercise(id, fields) {
  const allowed = ['muscle_group', 'exercise_name', 'default_weight', 'target_sets', 'target_reps', 'sort_order', 'image_data', 'is_required'];
  const sets = [];
  const values = [];

  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = ?`);
      values.push(fields[key]);
    }
  }

  if (sets.length === 0) return { changes: 0 };

  values.push(id);
  const result = run(`UPDATE exercise_configs SET ${sets.join(', ')}, updated_at = datetime('now', 'localtime') WHERE id = ?`, values);
  return { changes: result.changes };
}

function deleteExercise(id) {
  const result = run(
    "UPDATE exercise_configs SET is_archived = 1, updated_at = datetime('now', 'localtime') WHERE id = ?",
    [id]
  );
  return { changes: result.changes };
}

// ========== workout_sessions ==========

function getOrCreateSession(date) {
  let session = queryOne('SELECT * FROM workout_sessions WHERE date = ?', [date]);
  if (!session) {
    run("INSERT INTO workout_sessions (date, started_at) VALUES (?, datetime('now', 'localtime'))", [date]);
    session = queryOne('SELECT * FROM workout_sessions WHERE date = ?', [date]);
  }
  return session;
}

function getSessionByDate(date) {
  return queryOne('SELECT * FROM workout_sessions WHERE date = ?', [date]);
}

function completeSession(sessionId) {
  run("UPDATE workout_sessions SET completed_at = datetime('now', 'localtime') WHERE id = ?", [sessionId]);
}

function startTraining(sessionId) {
  run("UPDATE workout_sessions SET training_started_at = datetime('now', 'localtime') WHERE id = ?", [sessionId]);
  return queryOne('SELECT * FROM workout_sessions WHERE id = ?', [sessionId]);
}

function endTraining(sessionId) {
  run("UPDATE workout_sessions SET training_ended_at = datetime('now', 'localtime') WHERE id = ?", [sessionId]);
  return queryOne('SELECT * FROM workout_sessions WHERE id = ?', [sessionId]);
}

function resetSession(sessionId) {
  run('DELETE FROM set_logs WHERE session_id = ?', [sessionId]);
  run("UPDATE workout_sessions SET completed_at = NULL, training_started_at = NULL, training_ended_at = NULL WHERE id = ?", [sessionId]);
  return queryOne('SELECT * FROM workout_sessions WHERE id = ?', [sessionId]);
}

// ========== set_logs ==========

function addSetLog(sessionId, exerciseConfigId, setNumber, weightUsed, repsDone, exerciseName, muscleGroup) {
  const result = run(
    `INSERT INTO set_logs
       (session_id, exercise_config_id, set_number, weight_used, reps_done, exercise_name, muscle_group, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))`,
    [sessionId, exerciseConfigId, setNumber, weightUsed, repsDone, exerciseName ?? null, muscleGroup ?? null]
  );
  return result.lastInsertRowid;
}

function getSetLogs(sessionId) {
  return queryAll(
    `SELECT sl.*,
            COALESCE(sl.exercise_name, ec.exercise_name, '已删除动作') AS exercise_name,
            COALESCE(sl.muscle_group, ec.muscle_group, '') AS muscle_group
     FROM set_logs sl
     LEFT JOIN exercise_configs ec ON sl.exercise_config_id = ec.id
     WHERE sl.session_id = ?
     ORDER BY sl.completed_at`,
    [sessionId]
  );
}

function getCompletedSetCount(sessionId, exerciseConfigId) {
  const row = queryOne(
    'SELECT COUNT(*) as count FROM set_logs WHERE session_id = ? AND exercise_config_id = ?',
    [sessionId, exerciseConfigId]
  );
  return row ? row.count : 0;
}

// ========== weight_changes ==========

function updateWeight(exerciseConfigId, newWeight) {
  const config = queryOne('SELECT * FROM exercise_configs WHERE id = ?', [exerciseConfigId]);
  if (!config) return null;

  const oldWeight = config.default_weight;

  run(
    "INSERT INTO weight_changes (exercise_config_id, old_weight, new_weight, changed_at) VALUES (?, ?, ?, datetime('now', 'localtime'))",
    [exerciseConfigId, oldWeight, newWeight]
  );

  run("UPDATE exercise_configs SET default_weight = ?, updated_at = datetime('now', 'localtime') WHERE id = ?", [newWeight, exerciseConfigId]);

  return { oldWeight, newWeight };
}

function getWeightHistory(exerciseConfigId) {
  return queryAll('SELECT * FROM weight_changes WHERE exercise_config_id = ? ORDER BY changed_at DESC', [exerciseConfigId]);
}

// ========== 体重记录 ==========

function getWeightLogs() {
  return queryAll('SELECT * FROM weight_logs ORDER BY date, id');
}

function saveWeightLog({ id, date, weight_kg, note }) {
  let existing = null;
  if (id) {
    existing = queryOne('SELECT * FROM weight_logs WHERE id = ?', [id]);
  }
  if (!existing) {
    existing = queryOne('SELECT * FROM weight_logs WHERE date = ?', [date]);
  }

  if (existing) {
    run(
      "UPDATE weight_logs SET date = ?, weight_kg = ?, note = ?, updated_at = datetime('now', 'localtime') WHERE id = ?",
      [date, weight_kg, note ?? '', existing.id]
    );
    return queryOne('SELECT * FROM weight_logs WHERE id = ?', [existing.id]);
  }

  const result = run(
    'INSERT INTO weight_logs (date, weight_kg, note) VALUES (?, ?, ?)',
    [date, weight_kg, note ?? '']
  );
  return queryOne('SELECT * FROM weight_logs WHERE id = ?', [result.lastInsertRowid]);
}

function deleteWeightLog(id) {
  run('DELETE FROM weight_logs WHERE id = ?', [id]);
}

function getWeightGoal() {
  const row = queryOne("SELECT value FROM app_settings WHERE key = 'weight_goal'");
  const value = Number(row?.value);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function saveWeightGoal(goal) {
  if (goal == null) {
    run("DELETE FROM app_settings WHERE key = 'weight_goal'");
    return;
  }
  run(
    `INSERT INTO app_settings (key, value) VALUES ('weight_goal', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [String(goal)]
  );
}

// ========== 膳食计划 ==========

function getNutritionPlan() {
  const plan = queryOne('SELECT * FROM nutrition_plans WHERE is_active = 1 ORDER BY id DESC LIMIT 1');
  if (!plan) return null;
  plan.items = queryAll(
    'SELECT * FROM nutrition_items WHERE plan_id = ? ORDER BY sort_order, id',
    [plan.id]
  );
  return plan;
}

function getNutritionPlans() {
  return queryAll('SELECT * FROM nutrition_plans ORDER BY start_date DESC, id DESC');
}

function activateNutritionPlan(id) {
  const exists = queryOne('SELECT id FROM nutrition_plans WHERE id = ?', [id]);
  if (!exists) return null;
  run('UPDATE nutrition_plans SET is_active = CASE WHEN id = ? THEN 1 ELSE 0 END', [id]);
  return getNutritionPlan();
}

function saveNutritionPlan(plan, items) {
  let planId = plan.id || null;
  const existing = planId ? queryOne('SELECT * FROM nutrition_plans WHERE id = ?', [planId]) : null;

  if (!existing) planId = null;

  if (planId) {
    run(
      `UPDATE nutrition_plans
       SET name = ?, start_date = ?, calories = ?, protein = ?, carbs = ?, fat = ?, note = ?,
           is_active = 1, updated_at = datetime('now', 'localtime')
       WHERE id = ?`,
      [plan.name, plan.start_date, plan.calories, plan.protein, plan.carbs, plan.fat, plan.note ?? '', planId]
    );
  } else {
    const result = run(
      `INSERT INTO nutrition_plans
         (name, start_date, calories, protein, carbs, fat, note, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [plan.name, plan.start_date, plan.calories, plan.protein, plan.carbs, plan.fat, plan.note ?? '']
    );
    planId = result.lastInsertRowid;
  }

  run('UPDATE nutrition_plans SET is_active = 0 WHERE id <> ?', [planId]);
  run('DELETE FROM nutrition_items WHERE plan_id = ?', [planId]);
  for (const item of items) {
    run(
      `INSERT INTO nutrition_items (plan_id, meal, food_name, amount, unit, note, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [planId, item.meal || '每日固定', item.food_name, item.amount, item.unit ?? '', item.note ?? '', item.sort_order ?? 0]
    );
  }
  return getNutritionPlan();
}

function ensureNutritionTemplate() {
  const existing = getNutritionPlan();
  if (existing) return existing;
  const d = new Date();
  const startDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return saveNutritionPlan(
    {
      name: nutritionTemplate.name,
      start_date: startDate,
      calories: nutritionTemplate.calories,
      protein: nutritionTemplate.protein,
      carbs: nutritionTemplate.carbs,
      fat: nutritionTemplate.fat,
      note: nutritionTemplate.note,
    },
    nutritionTemplate.items
  );
}

// ========== 备份与恢复 ==========

function exportAll() {
  return {
    app: 'myworkout',
    version: 3,
    exported_at: new Date().toISOString(),
    configs: queryAll('SELECT * FROM exercise_configs ORDER BY id'),
    sessions: queryAll('SELECT * FROM workout_sessions ORDER BY id'),
    set_logs: queryAll('SELECT * FROM set_logs ORDER BY id'),
    weight_changes: queryAll('SELECT * FROM weight_changes ORDER BY id'),
    weight_logs: queryAll('SELECT * FROM weight_logs ORDER BY id'),
    nutrition_plans: queryAll('SELECT * FROM nutrition_plans ORDER BY id'),
    nutrition_items: queryAll('SELECT * FROM nutrition_items ORDER BY id'),
    app_settings: queryAll('SELECT * FROM app_settings ORDER BY key'),
  };
}

function importAll(payload) {
  if (
    !payload ||
    !Array.isArray(payload.configs) ||
    !Array.isArray(payload.sessions) ||
    !Array.isArray(payload.set_logs) ||
    !Array.isArray(payload.weight_changes)
  ) {
    throw new Error('备份文件格式不正确');
  }

  const now = new Date().toISOString();
  db.run('BEGIN');
  try {
    db.run('DELETE FROM set_logs');
    db.run('DELETE FROM nutrition_items');
    db.run('DELETE FROM app_settings');
    db.run('DELETE FROM weight_changes');
    db.run('DELETE FROM weight_logs');
    db.run('DELETE FROM workout_sessions');
    db.run('DELETE FROM nutrition_plans');
    db.run('DELETE FROM exercise_configs');

    for (const c of payload.configs) {
      db.run(
        `INSERT INTO exercise_configs
           (id, day_of_week, muscle_group, exercise_name, default_weight, target_sets, target_reps,
            sort_order, image_data, is_required, is_archived, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          c.id, c.day_of_week, c.muscle_group, c.exercise_name, c.default_weight ?? 0,
          c.target_sets ?? 1, c.target_reps ?? 1, c.sort_order ?? 1, c.image_data ?? null,
          c.is_required ?? 1, c.is_archived ?? 0, c.created_at ?? now, c.updated_at ?? now,
        ]
      );
    }

    for (const s of payload.sessions) {
      db.run(
        `INSERT INTO workout_sessions
           (id, date, started_at, completed_at, training_started_at, training_ended_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [s.id, s.date, s.started_at ?? now, s.completed_at ?? null, s.training_started_at ?? null, s.training_ended_at ?? null]
      );
    }

    for (const log of payload.set_logs) {
      db.run(
        `INSERT INTO set_logs
           (id, session_id, exercise_config_id, set_number, weight_used, reps_done, exercise_name, muscle_group, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          log.id, log.session_id, log.exercise_config_id, log.set_number, log.weight_used ?? 0,
          log.reps_done ?? 0, log.exercise_name ?? null, log.muscle_group ?? null, log.completed_at ?? now,
        ]
      );
    }

    for (const change of payload.weight_changes) {
      db.run(
        `INSERT INTO weight_changes
           (id, exercise_config_id, old_weight, new_weight, changed_at)
         VALUES (?, ?, ?, ?, ?)`,
        [change.id, change.exercise_config_id, change.old_weight ?? 0, change.new_weight ?? 0, change.changed_at ?? now]
      );
    }

    for (const weight of payload.weight_logs ?? []) {
      db.run(
        `INSERT INTO weight_logs (id, date, weight_kg, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [weight.id, weight.date, weight.weight_kg, weight.note ?? '', weight.created_at ?? now, weight.updated_at ?? now]
      );
    }

    for (const plan of payload.nutrition_plans ?? []) {
      db.run(
        `INSERT INTO nutrition_plans
           (id, name, start_date, calories, protein, carbs, fat, note, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          plan.id, plan.name, plan.start_date, plan.calories ?? 0, plan.protein ?? 0,
          plan.carbs ?? 0, plan.fat ?? 0, plan.note ?? '', plan.is_active ?? 1,
          plan.created_at ?? now, plan.updated_at ?? now,
        ]
      );
    }

    for (const item of payload.nutrition_items ?? []) {
      db.run(
        `INSERT INTO nutrition_items (id, plan_id, meal, food_name, amount, unit, note, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id, item.plan_id, item.meal ?? '每日固定', item.food_name, item.amount,
          item.unit ?? '', item.note ?? '', item.sort_order ?? 0,
        ]
      );
    }

    for (const setting of payload.app_settings ?? []) {
      db.run(
        'INSERT INTO app_settings (key, value) VALUES (?, ?)',
        [setting.key, setting.value]
      );
    }

    db.run('COMMIT');
  } catch (err) {
    try { db.run('ROLLBACK'); } catch (_) {}
    throw err;
  }
  saveDb();
}

module.exports = {
  initDatabase,
  saveDb,
  getConfigsByDay,
  getAllConfigs,
  addExercise,
  updateExercise,
  deleteExercise,
  getOrCreateSession,
  getSessionByDate,
  completeSession,
  startTraining,
  endTraining,
  resetSession,
  addSetLog,
  getSetLogs,
  getCompletedSetCount,
  updateWeight,
  getWeightHistory,
  getWeightLogs,
  saveWeightLog,
  deleteWeightLog,
  getWeightGoal,
  saveWeightGoal,
  getNutritionPlan,
  getNutritionPlans,
  saveNutritionPlan,
  activateNutritionPlan,
  ensureNutritionTemplate,
  exportAll,
  importAll,
};
