import type {
  BackupData,
  ExerciseConfig,
  NewExerciseInput,
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
import browserDB from './browser-db';

const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return (window as any).electronAPI.invoke(channel, ...args) as Promise<T>;
}

// ========== 训练配置 ==========

export async function getConfigsByDay(dayOfWeek: number, includeArchived = false): Promise<ExerciseConfig[]> {
  if (isElectron) return invoke<ExerciseConfig[]>('db:getConfigsByDay', dayOfWeek, includeArchived);
  return browserDB.getConfigsByDay(dayOfWeek, includeArchived);
}

export async function getAllConfigs(includeArchived = false): Promise<ExerciseConfig[]> {
  if (isElectron) return invoke<ExerciseConfig[]>('db:getAllConfigs', includeArchived);
  return browserDB.getAllConfigs(includeArchived);
}

export async function addExercise(data: NewExerciseInput): Promise<number> {
  if (isElectron) return invoke<number>('db:addExercise', data);
  return browserDB.addExercise(data) as unknown as number;
}

export async function updateExercise(id: number, fields: Partial<ExerciseConfig>): Promise<{ changes: number }> {
  if (isElectron) return invoke<{ changes: number }>('db:updateExercise', id, fields);
  return browserDB.updateExercise(id, fields);
}

export async function deleteExercise(id: number): Promise<{ changes: number }> {
  if (isElectron) return invoke<{ changes: number }>('db:deleteExercise', id);
  return browserDB.deleteExercise(id);
}

// ========== 训练会话 ==========

export async function getOrCreateSession(date: string): Promise<WorkoutSession> {
  if (isElectron) return invoke<WorkoutSession>('db:getOrCreateSession', date);
  return browserDB.getOrCreateSession(date) as Promise<WorkoutSession>;
}

export async function getSessionByDate(date: string): Promise<WorkoutSession | null> {
  if (isElectron) return invoke<WorkoutSession | null>('db:getSessionByDate', date);
  return browserDB.getSessionByDate(date);
}

export async function completeSession(sessionId: number): Promise<void> {
  if (isElectron) return invoke<void>('db:completeSession', sessionId);
  return browserDB.completeSession(sessionId);
}

export async function startTraining(sessionId: number): Promise<WorkoutSession | null> {
  if (isElectron) return invoke<WorkoutSession>('db:startTraining', sessionId);
  return browserDB.startTraining(sessionId) as Promise<WorkoutSession | null>;
}

export async function endTraining(sessionId: number): Promise<WorkoutSession | null> {
  if (isElectron) return invoke<WorkoutSession>('db:endTraining', sessionId);
  return browserDB.endTraining(sessionId) as Promise<WorkoutSession | null>;
}

export async function resetSession(sessionId: number): Promise<WorkoutSession | null> {
  if (isElectron) return invoke<WorkoutSession>('db:resetSession', sessionId);
  return browserDB.resetSession(sessionId) as Promise<WorkoutSession | null>;
}

// ========== 打卡记录 ==========

export async function addSetLog(
  sessionId: number,
  exerciseConfigId: number,
  setNumber: number,
  weightUsed: number,
  repsDone: number,
  exerciseName: string,
  muscleGroup: string
): Promise<number> {
  if (isElectron) {
    return invoke<number>(
      'db:addSetLog',
      sessionId,
      exerciseConfigId,
      setNumber,
      weightUsed,
      repsDone,
      exerciseName,
      muscleGroup
    );
  }
  return browserDB.addSetLog(
    sessionId,
    exerciseConfigId,
    setNumber,
    weightUsed,
    repsDone,
    exerciseName,
    muscleGroup
  ) as unknown as number;
}

export async function getSetLogs(sessionId: number): Promise<(SetLog & { exercise_name: string; muscle_group: string })[]> {
  if (isElectron) return invoke<(SetLog & { exercise_name: string; muscle_group: string })[]>('db:getSetLogs', sessionId);
  return browserDB.getSetLogs(sessionId);
}

export async function getCompletedSetCount(sessionId: number, exerciseConfigId: number): Promise<number> {
  if (isElectron) return invoke<number>('db:getCompletedSetCount', sessionId, exerciseConfigId);
  return browserDB.getCompletedSetCount(sessionId, exerciseConfigId);
}

// ========== 重量管理 ==========

export async function updateWeight(exerciseConfigId: number, newWeight: number): Promise<{ oldWeight: number; newWeight: number } | null> {
  if (isElectron) return invoke<{ oldWeight: number; newWeight: number } | null>('db:updateWeight', exerciseConfigId, newWeight);
  return browserDB.updateWeight(exerciseConfigId, newWeight);
}

export async function getWeightHistory(exerciseConfigId: number): Promise<WeightChange[]> {
  if (isElectron) return invoke<WeightChange[]>('db:getWeightHistory', exerciseConfigId);
  return browserDB.getWeightHistory(exerciseConfigId);
}

// ========== 数据备份 ==========

export async function exportAll(): Promise<BackupData> {
  if (isElectron) return invoke<BackupData>('db:exportAll');
  return browserDB.exportAll();
}

export async function importAll(data: BackupData): Promise<void> {
  if (isElectron) return invoke<void>('db:importAll', data);
  return browserDB.importAll(data);
}

// ========== 体重记录 ==========

export async function getWeightLogs(): Promise<WeightLog[]> {
  if (isElectron) return invoke<WeightLog[]>('db:getWeightLogs');
  return browserDB.getWeightLogs();
}

export async function saveWeightLog(input: WeightLogInput): Promise<WeightLog> {
  if (isElectron) return invoke<WeightLog>('db:saveWeightLog', input);
  return browserDB.saveWeightLog(input);
}

export async function deleteWeightLog(id: number): Promise<void> {
  if (isElectron) return invoke<void>('db:deleteWeightLog', id);
  return browserDB.deleteWeightLog(id);
}

export async function getWeightGoal(): Promise<number | null> {
  if (isElectron) return invoke<number | null>('db:getWeightGoal');
  return browserDB.getWeightGoal();
}

export async function saveWeightGoal(goal: number | null): Promise<void> {
  if (isElectron) return invoke<void>('db:saveWeightGoal', goal);
  return browserDB.saveWeightGoal(goal);
}

export async function getWeightGoalVisible(): Promise<boolean> {
  if (isElectron) return invoke<boolean>('db:getWeightGoalVisible');
  return browserDB.getWeightGoalVisible();
}

export async function saveWeightGoalVisible(visible: boolean): Promise<void> {
  if (isElectron) return invoke<void>('db:saveWeightGoalVisible', visible);
  return browserDB.saveWeightGoalVisible(visible);
}

// ========== 膳食计划 ==========

export async function getNutritionPlan(): Promise<NutritionPlanWithItems | null> {
  if (isElectron) return invoke<NutritionPlanWithItems | null>('db:getNutritionPlan');
  return browserDB.getNutritionPlan();
}

export async function getNutritionPlans(): Promise<NutritionPlan[]> {
  if (isElectron) return invoke<NutritionPlan[]>('db:getNutritionPlans');
  return browserDB.getNutritionPlans();
}

export async function saveNutritionPlan(
  plan: NutritionPlanInput,
  items: NutritionItemInput[]
): Promise<NutritionPlanWithItems> {
  if (isElectron) return invoke<NutritionPlanWithItems>('db:saveNutritionPlan', plan, items);
  return browserDB.saveNutritionPlan(plan, items);
}

export async function activateNutritionPlan(id: number): Promise<NutritionPlanWithItems | null> {
  if (isElectron) return invoke<NutritionPlanWithItems | null>('db:activateNutritionPlan', id);
  return browserDB.activateNutritionPlan(id);
}

export async function ensureNutritionTemplate(): Promise<NutritionPlanWithItems> {
  if (isElectron) return invoke<NutritionPlanWithItems>('db:ensureNutritionTemplate');
  return browserDB.ensureNutritionTemplate();
}
