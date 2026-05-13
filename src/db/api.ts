import type { ExerciseConfig, WorkoutSession, SetLog, WeightChange } from '../types';
import browserDB from './browser-db';

const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return (window as any).electronAPI.invoke(channel, ...args) as Promise<T>;
}

// ========== 训练配置 ==========

export async function getConfigsByDay(dayOfWeek: number): Promise<ExerciseConfig[]> {
  if (isElectron) return invoke<ExerciseConfig[]>('db:getConfigsByDay', dayOfWeek);
  return browserDB.getConfigsByDay(dayOfWeek);
}

export async function getAllConfigs(): Promise<ExerciseConfig[]> {
  if (isElectron) return invoke<ExerciseConfig[]>('db:getAllConfigs');
  return browserDB.getAllConfigs();
}

export async function addExercise(data: {
  day_of_week: number;
  muscle_group: string;
  exercise_name: string;
  default_weight: number;
  target_sets: number;
  target_reps: number;
  image_data?: string | null;
}): Promise<number> {
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

export async function getSessionByDate(date: string): Promise<WorkoutSession | undefined> {
  if (isElectron) return invoke<WorkoutSession | undefined>('db:getSessionByDate', date);
  return browserDB.getSessionByDate(date) as Promise<WorkoutSession | undefined>;
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
  repsDone: number
): Promise<number> {
  if (isElectron) return invoke<number>('db:addSetLog', sessionId, exerciseConfigId, setNumber, weightUsed, repsDone);
  return browserDB.addSetLog(sessionId, exerciseConfigId, setNumber, weightUsed, repsDone) as unknown as number;
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
