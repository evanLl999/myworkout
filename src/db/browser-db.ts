import type {
  BackupData,
  ExerciseConfig,
  NewExerciseInput,
  SetLog,
  WeightChange,
  WorkoutSession,
} from '../types';

const DB_NAME = 'myworkout';
const DB_VERSION = 1;
const STORES = ['exercise_configs', 'workout_sessions', 'set_logs', 'weight_changes'] as const;

type StoreName = typeof STORES[number];

function openDB(): Promise<IDBDatabase> {
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

function store(db: IDBDatabase, name: StoreName, mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
  return db.transaction(name, mode).objectStore(name);
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAll<T>(objectStore: IDBObjectStore): Promise<T[]> {
  return request(objectStore.getAll() as IDBRequest<T[]>);
}

function getByIndex<T>(objectStore: IDBObjectStore, indexName: string, value: IDBValidKey): Promise<T[]> {
  return request(objectStore.index(indexName).getAll(value) as IDBRequest<T[]>);
}

function putOne<T>(objectStore: IDBObjectStore, data: T): Promise<IDBValidKey> {
  return request(objectStore.put(data));
}

function deleteOne(objectStore: IDBObjectStore, id: IDBValidKey): Promise<void> {
  return request(objectStore.delete(id) as IDBRequest<undefined>).then(() => undefined);
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('数据库事务已取消'));
  });
}

const browserDB = {
  async getConfigsByDay(dayOfWeek: number, includeArchived = false): Promise<ExerciseConfig[]> {
    const db = await openDB();
    const all = await getAll<ExerciseConfig>(store(db, 'exercise_configs'));
    return all
      .filter((e) => e.day_of_week === dayOfWeek && (includeArchived || !e.is_archived))
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  },

  async getAllConfigs(includeArchived = false): Promise<ExerciseConfig[]> {
    const db = await openDB();
    const all = await getAll<ExerciseConfig>(store(db, 'exercise_configs'));
    return all
      .filter((e) => includeArchived || !e.is_archived)
      .sort((a, b) => a.day_of_week - b.day_of_week || a.sort_order - b.sort_order || a.id - b.id);
  },

  async addExercise(data: NewExerciseInput): Promise<number> {
    const db = await openDB();
    const all = await getAll<ExerciseConfig>(store(db, 'exercise_configs'));
    const dayExercises = all.filter((e) => e.day_of_week === data.day_of_week && !e.is_archived);
    const requestedOrder = Number(data.sort_order);
    const sortOrder = Number.isFinite(requestedOrder)
      ? requestedOrder
      : dayExercises.length > 0
        ? Math.max(...dayExercises.map((e) => e.sort_order)) + 1
        : 1;
    const now = new Date().toISOString();
    const record = {
      ...data,
      sort_order: sortOrder,
      image_data: data.image_data ?? null,
      is_required: data.is_required ? 1 : 0,
      is_archived: 0,
      created_at: now,
      updated_at: now,
    };
    const id = await request(store(db, 'exercise_configs', 'readwrite').add(record));
    return Number(id);
  },

  async updateExercise(id: number, fields: Partial<ExerciseConfig>): Promise<{ changes: number }> {
    const db = await openDB();
    const existing = await request<ExerciseConfig | undefined>(
      store(db, 'exercise_configs').get(id) as IDBRequest<ExerciseConfig | undefined>
    );
    if (!existing) return { changes: 0 };
    const { id: _id, created_at: _createdAt, ...safeFields } = fields;
    const updated: ExerciseConfig = {
      ...existing,
      ...safeFields,
      is_required: safeFields.is_required !== undefined
        ? Number(safeFields.is_required)
        : existing.is_required,
      updated_at: new Date().toISOString(),
    };
    await putOne(store(db, 'exercise_configs', 'readwrite'), updated);
    return { changes: 1 };
  },

  async deleteExercise(id: number): Promise<{ changes: number }> {
    const db = await openDB();
    const existing = await request<ExerciseConfig | undefined>(
      store(db, 'exercise_configs').get(id) as IDBRequest<ExerciseConfig | undefined>
    );
    if (!existing) return { changes: 0 };
    const updated: ExerciseConfig = {
      ...existing,
      is_archived: 1,
      updated_at: new Date().toISOString(),
    };
    await putOne(store(db, 'exercise_configs', 'readwrite'), updated);
    return { changes: 1 };
  },

  async getOrCreateSession(date: string): Promise<WorkoutSession> {
    const db = await openDB();
    const sessions = await getByIndex<WorkoutSession>(store(db, 'workout_sessions'), 'date', date);
    if (sessions.length > 0) return sessions[0];
    const record = {
      date,
      started_at: new Date().toISOString(),
      completed_at: null,
      training_started_at: null,
      training_ended_at: null,
    };
    const id = await request(store(db, 'workout_sessions', 'readwrite').add(record));
    return { id: Number(id), ...record };
  },

  async getSessionByDate(date: string): Promise<WorkoutSession | null> {
    const db = await openDB();
    const sessions = await getByIndex<WorkoutSession>(store(db, 'workout_sessions'), 'date', date);
    return sessions[0] ?? null;
  },

  async completeSession(sessionId: number): Promise<void> {
    const db = await openDB();
    const existing = await request<WorkoutSession | undefined>(
      store(db, 'workout_sessions').get(sessionId) as IDBRequest<WorkoutSession | undefined>
    );
    if (!existing) return;
    await putOne(store(db, 'workout_sessions', 'readwrite'), {
      ...existing,
      completed_at: new Date().toISOString(),
    });
  },

  async startTraining(sessionId: number): Promise<WorkoutSession | null> {
    const db = await openDB();
    const existing = await request<WorkoutSession | undefined>(
      store(db, 'workout_sessions').get(sessionId) as IDBRequest<WorkoutSession | undefined>
    );
    if (!existing) return null;
    const updated: WorkoutSession = {
      ...existing,
      training_started_at: new Date().toISOString(),
    };
    await putOne(store(db, 'workout_sessions', 'readwrite'), updated);
    return updated;
  },

  async endTraining(sessionId: number): Promise<WorkoutSession | null> {
    const db = await openDB();
    const existing = await request<WorkoutSession | undefined>(
      store(db, 'workout_sessions').get(sessionId) as IDBRequest<WorkoutSession | undefined>
    );
    if (!existing) return null;
    const updated: WorkoutSession = {
      ...existing,
      training_ended_at: new Date().toISOString(),
    };
    await putOne(store(db, 'workout_sessions', 'readwrite'), updated);
    return updated;
  },

  async resetSession(sessionId: number): Promise<WorkoutSession | null> {
    const db = await openDB();
    const logs = await getByIndex<SetLog>(store(db, 'set_logs'), 'session_id', sessionId);
    const logStore = store(db, 'set_logs', 'readwrite');
    await Promise.all(logs.map((log) => deleteOne(logStore, log.id)));

    const existing = await request<WorkoutSession | undefined>(
      store(db, 'workout_sessions').get(sessionId) as IDBRequest<WorkoutSession | undefined>
    );
    if (!existing) return null;
    const updated: WorkoutSession = {
      ...existing,
      completed_at: null,
      training_started_at: null,
      training_ended_at: null,
    };
    await putOne(store(db, 'workout_sessions', 'readwrite'), updated);
    return updated;
  },

  async addSetLog(
    sessionId: number,
    exerciseConfigId: number,
    setNumber: number,
    weightUsed: number,
    repsDone: number,
    exerciseName: string,
    muscleGroup: string
  ): Promise<number> {
    const db = await openDB();
    const record = {
      session_id: sessionId,
      exercise_config_id: exerciseConfigId,
      set_number: setNumber,
      weight_used: weightUsed,
      reps_done: repsDone,
      exercise_name: exerciseName,
      muscle_group: muscleGroup,
      completed_at: new Date().toISOString(),
    };
    const id = await request(store(db, 'set_logs', 'readwrite').add(record));
    return Number(id);
  },

  async getSetLogs(sessionId: number): Promise<(SetLog & { exercise_name: string; muscle_group: string })[]> {
    const db = await openDB();
    const logs = await getByIndex<SetLog>(store(db, 'set_logs'), 'session_id', sessionId);
    const configs = await getAll<ExerciseConfig>(store(db, 'exercise_configs'));
    const configMap = new Map(configs.map((c) => [c.id, c]));
    return logs
      .map((log) => {
        const cfg = configMap.get(log.exercise_config_id);
        return {
          ...log,
          exercise_name: log.exercise_name || cfg?.exercise_name || '已删除动作',
          muscle_group: log.muscle_group || cfg?.muscle_group || '',
        };
      })
      .sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime());
  },

  async getCompletedSetCount(sessionId: number, exerciseConfigId: number): Promise<number> {
    const db = await openDB();
    const logs = await getByIndex<SetLog>(store(db, 'set_logs'), 'session_id', sessionId);
    return logs.filter((log) => log.exercise_config_id === exerciseConfigId).length;
  },

  async updateWeight(exerciseConfigId: number, newWeight: number): Promise<{ oldWeight: number; newWeight: number } | null> {
    const db = await openDB();
    const existing = await request<ExerciseConfig | undefined>(
      store(db, 'exercise_configs').get(exerciseConfigId) as IDBRequest<ExerciseConfig | undefined>
    );
    if (!existing) return null;
    const oldWeight = existing.default_weight;
    const tx = db.transaction(['exercise_configs', 'weight_changes'], 'readwrite');
    tx.objectStore('exercise_configs').put({
      ...existing,
      default_weight: newWeight,
      updated_at: new Date().toISOString(),
    });
    tx.objectStore('weight_changes').add({
      exercise_config_id: exerciseConfigId,
      old_weight: oldWeight,
      new_weight: newWeight,
      changed_at: new Date().toISOString(),
    });
    await transactionDone(tx);
    return { oldWeight, newWeight };
  },

  async getWeightHistory(exerciseConfigId: number): Promise<WeightChange[]> {
    const db = await openDB();
    const all = await getByIndex<WeightChange>(store(db, 'weight_changes'), 'exercise_config_id', exerciseConfigId);
    return all.sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());
  },

  async exportAll(): Promise<BackupData> {
    const db = await openDB();
    const [configs, sessions, set_logs, weight_changes] = await Promise.all([
      getAll<ExerciseConfig>(store(db, 'exercise_configs')),
      getAll<WorkoutSession>(store(db, 'workout_sessions')),
      getAll<SetLog>(store(db, 'set_logs')),
      getAll<WeightChange>(store(db, 'weight_changes')),
    ]);
    return {
      app: 'myworkout',
      version: 1,
      exported_at: new Date().toISOString(),
      configs,
      sessions,
      set_logs,
      weight_changes,
    };
  },

  async importAll(data: BackupData): Promise<void> {
    if (
      !data ||
      !Array.isArray(data.configs) ||
      !Array.isArray(data.sessions) ||
      !Array.isArray(data.set_logs) ||
      !Array.isArray(data.weight_changes)
    ) {
      throw new Error('备份文件格式不正确');
    }
    const db = await openDB();
    const tx = db.transaction([...STORES], 'readwrite');
    for (const name of STORES) tx.objectStore(name).clear();
    for (const config of data.configs) tx.objectStore('exercise_configs').put(config);
    for (const session of data.sessions) tx.objectStore('workout_sessions').put(session);
    for (const log of data.set_logs) tx.objectStore('set_logs').put(log);
    for (const change of data.weight_changes) tx.objectStore('weight_changes').put(change);
    await transactionDone(tx);
  },
};

export default browserDB;
