import type {
  AppSetting,
  BackupData,
  ExerciseConfig,
  NewExerciseInput,
  NutritionItem,
  NutritionItemInput,
  NutritionPlan,
  NutritionPlanInput,
  NutritionPlanWithItems,
  SetLog,
  WeightChange,
  WeightLog,
  WeightLogInput,
  WorkoutSession,
} from '../types';
import nutritionTemplate from '../data/nutrition-template.json';
import { formatDate } from '../utils/date';

const DB_NAME = 'myworkout';
const DB_VERSION = 3;
const STORES = [
  'exercise_configs',
  'workout_sessions',
  'set_logs',
  'weight_changes',
  'weight_logs',
  'nutrition_plans',
  'nutrition_items',
  'app_settings',
] as const;

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
      if (!db.objectStoreNames.contains('weight_logs')) {
        const store = db.createObjectStore('weight_logs', { keyPath: 'id', autoIncrement: true });
        store.createIndex('date', 'date', { unique: true });
      }
      if (!db.objectStoreNames.contains('nutrition_plans')) {
        const store = db.createObjectStore('nutrition_plans', { keyPath: 'id', autoIncrement: true });
        store.createIndex('is_active', 'is_active');
      }
      if (!db.objectStoreNames.contains('nutrition_items')) {
        const store = db.createObjectStore('nutrition_items', { keyPath: 'id', autoIncrement: true });
        store.createIndex('plan_id', 'plan_id');
      }
      if (!db.objectStoreNames.contains('app_settings')) {
        db.createObjectStore('app_settings', { keyPath: 'key' });
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

async function readNutritionPlan(): Promise<NutritionPlanWithItems | null> {
  const db = await openDB();
  const plans = await getAll<NutritionPlan>(store(db, 'nutrition_plans'));
  if (plans.length === 0) return null;
  const plan = plans
    .slice()
    .sort((a, b) => (b.is_active ?? 0) - (a.is_active ?? 0) || b.id - a.id)[0];
  const items = await getByIndex<NutritionItem>(store(db, 'nutrition_items'), 'plan_id', plan.id);
  return {
    ...plan,
    items: items.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
  };
}

async function writeNutritionPlan(
  input: NutritionPlanInput,
  items: NutritionItemInput[]
): Promise<NutritionPlanWithItems> {
  const db = await openDB();
  const now = new Date().toISOString();
  let existing: NutritionPlan | undefined;

  if (input.id) {
    existing = await request<NutritionPlan | undefined>(
      store(db, 'nutrition_plans').get(input.id) as IDBRequest<NutritionPlan | undefined>
    );
  }

  const planRecord = {
    name: input.name,
    start_date: input.start_date,
    calories: input.calories,
    protein: input.protein,
    carbs: input.carbs,
    fat: input.fat,
    note: input.note,
    is_active: 1,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };

  let planId: number;
  if (existing) {
    planId = existing.id;
    await putOne(store(db, 'nutrition_plans', 'readwrite'), { ...existing, ...planRecord });
  } else {
    planId = Number(await request(store(db, 'nutrition_plans', 'readwrite').add(planRecord)));
  }

  const oldItems = await getByIndex<NutritionItem>(store(db, 'nutrition_items'), 'plan_id', planId);
  const deleteStore = store(db, 'nutrition_items', 'readwrite');
  await Promise.all(oldItems.map((item) => deleteOne(deleteStore, item.id)));

  const tx = db.transaction('nutrition_items', 'readwrite');
  const itemStore = tx.objectStore('nutrition_items');
  for (const item of items) {
    itemStore.add({
      plan_id: planId,
      meal: item.meal || '每日固定',
      food_name: item.food_name,
      amount: item.amount,
      unit: item.unit,
      note: item.note,
      sort_order: item.sort_order,
    });
  }
  await transactionDone(tx);

  const plans = await getAll<NutritionPlan>(store(db, 'nutrition_plans'));
  const activeTx = db.transaction('nutrition_plans', 'readwrite');
  const planStore = activeTx.objectStore('nutrition_plans');
  for (const plan of plans) {
    planStore.put({ ...plan, is_active: plan.id === planId ? 1 : 0 });
  }
  await transactionDone(activeTx);

  const saved = await readNutritionPlan();
  if (!saved) throw new Error('膳食计划保存失败');
  return saved;
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

  async getWeightLogs(): Promise<WeightLog[]> {
    const db = await openDB();
    const logs = await getAll<WeightLog>(store(db, 'weight_logs'));
    return logs.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  },

  async saveWeightLog(input: WeightLogInput): Promise<WeightLog> {
    const db = await openDB();
    const now = new Date().toISOString();
    let existing: WeightLog | undefined;

    if (input.id) {
      existing = await request<WeightLog | undefined>(
        store(db, 'weight_logs').get(input.id) as IDBRequest<WeightLog | undefined>
      );
    } else {
      const matches = await getByIndex<WeightLog>(store(db, 'weight_logs'), 'date', input.date);
      existing = matches[0];
    }

    const record: WeightLog = {
      id: existing?.id ?? 0,
      date: input.date,
      weight_kg: input.weight_kg,
      note: input.note ?? '',
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };

    if (existing) {
      await putOne(store(db, 'weight_logs', 'readwrite'), record);
      return record;
    }

    const id = await request(store(db, 'weight_logs', 'readwrite').add({
      date: record.date,
      weight_kg: record.weight_kg,
      note: record.note,
      created_at: record.created_at,
      updated_at: record.updated_at,
    }));
    return { ...record, id: Number(id) };
  },

  async deleteWeightLog(id: number): Promise<void> {
    const db = await openDB();
    await deleteOne(store(db, 'weight_logs', 'readwrite'), id);
  },

  async getWeightGoal(): Promise<number | null> {
    const db = await openDB();
    const record = await request<AppSetting | undefined>(
      store(db, 'app_settings').get('weight_goal') as IDBRequest<AppSetting | undefined>
    );
    const value = Number(record?.value);
    return Number.isFinite(value) && value > 0 ? value : null;
  },

  async saveWeightGoal(goal: number | null): Promise<void> {
    const db = await openDB();
    if (goal == null) {
      await deleteOne(store(db, 'app_settings', 'readwrite'), 'weight_goal');
      return;
    }
    await putOne(store(db, 'app_settings', 'readwrite'), {
      key: 'weight_goal',
      value: String(goal),
    });
  },

  async getNutritionPlan(): Promise<NutritionPlanWithItems | null> {
    return readNutritionPlan();
  },

  async getNutritionPlans(): Promise<NutritionPlan[]> {
    const db = await openDB();
    const plans = await getAll<NutritionPlan>(store(db, 'nutrition_plans'));
    return plans.sort((a, b) => b.start_date.localeCompare(a.start_date) || b.id - a.id);
  },

  async saveNutritionPlan(
    plan: NutritionPlanInput,
    items: NutritionItemInput[]
  ): Promise<NutritionPlanWithItems> {
    return writeNutritionPlan(plan, items);
  },

  async activateNutritionPlan(id: number): Promise<NutritionPlanWithItems | null> {
    const db = await openDB();
    const plans = await getAll<NutritionPlan>(store(db, 'nutrition_plans'));
    if (!plans.some((plan) => plan.id === id)) return null;
    const tx = db.transaction('nutrition_plans', 'readwrite');
    const planStore = tx.objectStore('nutrition_plans');
    for (const plan of plans) {
      planStore.put({ ...plan, is_active: plan.id === id ? 1 : 0 });
    }
    await transactionDone(tx);
    return readNutritionPlan();
  },

  async ensureNutritionTemplate(): Promise<NutritionPlanWithItems> {
    const existing = await readNutritionPlan();
    if (existing) return existing;
    return writeNutritionPlan(
      {
        name: nutritionTemplate.name,
        start_date: formatDate(new Date()),
        calories: nutritionTemplate.calories,
        protein: nutritionTemplate.protein,
        carbs: nutritionTemplate.carbs,
        fat: nutritionTemplate.fat,
        note: nutritionTemplate.note,
      },
      nutritionTemplate.items
    );
  },

  async exportAll(): Promise<BackupData> {
    const db = await openDB();
    const [configs, sessions, set_logs, weight_changes, weight_logs, nutrition_plans, nutrition_items, app_settings] = await Promise.all([
      getAll<ExerciseConfig>(store(db, 'exercise_configs')),
      getAll<WorkoutSession>(store(db, 'workout_sessions')),
      getAll<SetLog>(store(db, 'set_logs')),
      getAll<WeightChange>(store(db, 'weight_changes')),
      getAll<WeightLog>(store(db, 'weight_logs')),
      getAll<NutritionPlan>(store(db, 'nutrition_plans')),
      getAll<NutritionItem>(store(db, 'nutrition_items')),
      getAll<AppSetting>(store(db, 'app_settings')),
    ]);
    return {
      app: 'myworkout',
      version: 3,
      exported_at: new Date().toISOString(),
      configs,
      sessions,
      set_logs,
      weight_changes,
      weight_logs,
      nutrition_plans,
      nutrition_items,
      app_settings,
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
    for (const weight of data.weight_logs ?? []) tx.objectStore('weight_logs').put(weight);
    for (const plan of data.nutrition_plans ?? []) tx.objectStore('nutrition_plans').put(plan);
    for (const item of data.nutrition_items ?? []) tx.objectStore('nutrition_items').put(item);
    for (const setting of data.app_settings ?? []) tx.objectStore('app_settings').put(setting);
    await transactionDone(tx);
  },
};

export default browserDB;
