const DB_NAME = 'myworkout';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('exercise_configs')) {
        const store = db.createObjectStore('exercise_configs', { keyPath: 'id', autoIncrement: true });
        store.createIndex('day_of_week', 'day_of_week');
      }
      if (!db.objectStoreNames.contains('workout_sessions')) {
        const store = db.createObjectStore('workout_sessions', { keyPath: 'id', autoIncrement: true });
        store.createIndex('date', 'date', { unique: true });
      }
      if (!db.objectStoreNames.contains('set_logs')) {
        const store = db.createObjectStore('set_logs', { keyPath: 'id', autoIncrement: true });
        store.createIndex('session_id', 'session_id');
        store.createIndex('exercise_config_id', 'exercise_config_id');
      }
      if (!db.objectStoreNames.contains('weight_changes')) {
        const store = db.createObjectStore('weight_changes', { keyPath: 'id', autoIncrement: true });
        store.createIndex('exercise_config_id', 'exercise_config_id');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, storeName, mode = 'readonly') {
  return db.transaction(storeName, mode).objectStore(storeName);
}

function getAll(store) {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getByIndex(store, indexName, value) {
  return new Promise((resolve, reject) => {
    const req = store.index(indexName).getAll(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function putOne(store, data) {
  return new Promise((resolve, reject) => {
    const req = store.put(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function deleteOne(store, id) {
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

const browserDB = {
  async getConfigsByDay(dayOfWeek) {
    const db = await openDB();
    const all = await getAll(tx(db, 'exercise_configs'));
    return all.filter((e) => e.day_of_week === dayOfWeek).sort((a, b) => a.sort_order - b.sort_order);
  },

  async getAllConfigs() {
    const db = await openDB();
    const all = await getAll(tx(db, 'exercise_configs'));
    return all.sort((a, b) => a.day_of_week - b.day_of_week || a.sort_order - b.sort_order);
  },

  async addExercise(data) {
    const db = await openDB();
    const all = await getAll(tx(db, 'exercise_configs'));
    const dayExercises = all.filter((e) => e.day_of_week === data.day_of_week);
    const sortOrder = dayExercises.length > 0 ? Math.max(...dayExercises.map((e) => e.sort_order)) + 1 : 0;
    const now = new Date().toISOString();
    const record = { ...data, sort_order: sortOrder, image_data: data.image_data ?? null, created_at: now, updated_at: now };
    return await putOne(tx(db, 'exercise_configs', 'readwrite'), record);
  },

  async updateExercise(id, fields) {
    const db = await openDB();
    const store = tx(db, 'exercise_configs', 'readwrite');
    const existing = await new Promise((resolve) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
    });
    if (!existing) return { changes: 0 };
    const updated = { ...existing, ...fields, updated_at: new Date().toISOString() };
    await putOne(store, updated);
    return { changes: 1 };
  },

  async deleteExercise(id) {
    const db = await openDB();
    // Delete related records
    const wlStore = tx(db, 'weight_changes', 'readwrite');
    const wlAll = await getByIndex(wlStore, 'exercise_config_id', id);
    for (const w of wlAll) await deleteOne(wlStore, w.id);

    const slStore = tx(db, 'set_logs', 'readwrite');
    const slAll = await getByIndex(slStore, 'exercise_config_id', id);
    for (const s of slAll) await deleteOne(slStore, s.id);

    await deleteOne(tx(db, 'exercise_configs', 'readwrite'), id);
    return { changes: 1 };
  },

  async getOrCreateSession(date) {
    const db = await openDB();
    const sessions = await getByIndex(tx(db, 'workout_sessions'), 'date', date);
    if (sessions.length > 0) return sessions[0];
    const record = { date, started_at: new Date().toISOString(), completed_at: null, training_started_at: null, training_ended_at: null };
    const id = await putOne(tx(db, 'workout_sessions', 'readwrite'), record);
    return { id, ...record };
  },

  async getSessionByDate(date) {
    const db = await openDB();
    const sessions = await getByIndex(tx(db, 'workout_sessions'), 'date', date);
    return sessions[0] ?? null;
  },

  async completeSession(sessionId) {
    const db = await openDB();
    const store = tx(db, 'workout_sessions', 'readwrite');
    const existing = await new Promise((resolve) => {
      const req = store.get(sessionId);
      req.onsuccess = () => resolve(req.result);
    });
    if (!existing) return;
    await putOne(store, { ...existing, completed_at: new Date().toISOString() });
  },

  async startTraining(sessionId) {
    const db = await openDB();
    const store = tx(db, 'workout_sessions', 'readwrite');
    const existing = await new Promise((resolve) => {
      const req = store.get(sessionId);
      req.onsuccess = () => resolve(req.result);
    });
    if (!existing) return null;
    const updated = { ...existing, training_started_at: new Date().toISOString() };
    await putOne(store, updated);
    return updated;
  },

  async endTraining(sessionId) {
    const db = await openDB();
    const store = tx(db, 'workout_sessions', 'readwrite');
    const existing = await new Promise((resolve) => {
      const req = store.get(sessionId);
      req.onsuccess = () => resolve(req.result);
    });
    if (!existing) return null;
    const updated = { ...existing, training_ended_at: new Date().toISOString() };
    await putOne(store, updated);
    return updated;
  },

  async resetSession(sessionId) {
    const db = await openDB();
    const slStore = tx(db, 'set_logs', 'readwrite');
    const all = await getByIndex(slStore, 'session_id', sessionId);
    for (const s of all) await deleteOne(slStore, s.id);

    const wsStore = tx(db, 'workout_sessions', 'readwrite');
    const existing = await new Promise((resolve) => {
      const req = wsStore.get(sessionId);
      req.onsuccess = () => resolve(req.result);
    });
    if (!existing) return null;
    const updated = { ...existing, completed_at: null, training_started_at: null, training_ended_at: null };
    await putOne(wsStore, updated);
    return updated;
  },

  async addSetLog(sessionId, exerciseConfigId, setNumber, weightUsed, repsDone) {
    const db = await openDB();
    const record = {
      session_id: sessionId,
      exercise_config_id: exerciseConfigId,
      set_number: setNumber,
      weight_used: weightUsed,
      reps_done: repsDone,
      completed_at: new Date().toISOString(),
    };
    return await putOne(tx(db, 'set_logs', 'readwrite'), record);
  },

  async getSetLogs(sessionId) {
    const db = await openDB();
    const logs = await getByIndex(tx(db, 'set_logs'), 'session_id', sessionId);
    const configs = await getAll(tx(db, 'exercise_configs'));
    const configMap = new Map(configs.map((c) => [c.id, c]));
    return logs
      .map((l) => {
        const cfg = configMap.get(l.exercise_config_id);
        return { ...l, exercise_name: cfg?.exercise_name ?? '', muscle_group: cfg?.muscle_group ?? '' };
      })
      .sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime());
  },

  async getCompletedSetCount(sessionId, exerciseConfigId) {
    const db = await openDB();
    const logs = await getByIndex(tx(db, 'set_logs'), 'session_id', sessionId);
    return logs.filter((l) => l.exercise_config_id === exerciseConfigId).length;
  },

  async updateWeight(exerciseConfigId, newWeight) {
    const db = await openDB();
    const store = tx(db, 'exercise_configs', 'readwrite');
    const existing = await new Promise((resolve) => {
      const req = store.get(exerciseConfigId);
      req.onsuccess = () => resolve(req.result);
    });
    if (!existing) return null;
    const oldWeight = existing.default_weight;
    await putOne(store, { ...existing, default_weight: newWeight, updated_at: new Date().toISOString() });
    const wcStore = tx(db, 'weight_changes', 'readwrite');
    await putOne(wcStore, {
      exercise_config_id: exerciseConfigId,
      old_weight: oldWeight,
      new_weight: newWeight,
      changed_at: new Date().toISOString(),
    });
    return { oldWeight, newWeight };
  },

  async getWeightHistory(exerciseConfigId) {
    const db = await openDB();
    const all = await getByIndex(tx(db, 'weight_changes'), 'exercise_config_id', exerciseConfigId);
    return all.sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());
  },
};

export default browserDB;
