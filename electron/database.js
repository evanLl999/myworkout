const path = require('path');
const fs = require('fs');
const { app } = require('electron');

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
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // 迁移：为已有数据库添加新字段
  try { db.run("ALTER TABLE exercise_configs ADD COLUMN image_data TEXT"); } catch (_) {}

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
  saveDb();
  return {
    changes: db.getRowsModified(),
    lastInsertRowid: queryOne('SELECT last_insert_rowid() as id')?.id ?? 0,
  };
}

// ========== exercise_configs CRUD ==========

function getConfigsByDay(dayOfWeek) {
  return queryAll('SELECT * FROM exercise_configs WHERE day_of_week = ? ORDER BY sort_order', [dayOfWeek]);
}

function getAllConfigs() {
  return queryAll('SELECT * FROM exercise_configs ORDER BY day_of_week, sort_order');
}

function addExercise({ day_of_week, muscle_group, exercise_name, default_weight, target_sets, target_reps, image_data }) {
  const row = queryOne('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM exercise_configs WHERE day_of_week = ?', [day_of_week]);
  const sortOrder = row ? row.next : 0;

  const result = run(
    `INSERT INTO exercise_configs (day_of_week, muscle_group, exercise_name, default_weight, target_sets, target_reps, sort_order, image_data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [day_of_week, muscle_group, exercise_name, default_weight, target_sets, target_reps, sortOrder, image_data ?? null]
  );
  return result.lastInsertRowid;
}

function updateExercise(id, fields) {
  const allowed = ['muscle_group', 'exercise_name', 'default_weight', 'target_sets', 'target_reps', 'sort_order', 'image_data'];
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
  run('DELETE FROM weight_changes WHERE exercise_config_id = ?', [id]);
  run('DELETE FROM set_logs WHERE exercise_config_id = ?', [id]);
  const result = run('DELETE FROM exercise_configs WHERE id = ?', [id]);
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

function addSetLog(sessionId, exerciseConfigId, setNumber, weightUsed, repsDone) {
  const result = run(
    `INSERT INTO set_logs (session_id, exercise_config_id, set_number, weight_used, reps_done, completed_at)
     VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))`,
    [sessionId, exerciseConfigId, setNumber, weightUsed, repsDone]
  );
  return result.lastInsertRowid;
}

function getSetLogs(sessionId) {
  return queryAll(
    `SELECT sl.*, ec.exercise_name, ec.muscle_group
     FROM set_logs sl
     JOIN exercise_configs ec ON sl.exercise_config_id = ec.id
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
};
