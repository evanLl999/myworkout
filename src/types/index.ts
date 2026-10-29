// 训练配置
export interface ExerciseConfig {
  id: number;
  day_of_week: number; // 0=周一 ~ 6=周日
  muscle_group: string;
  exercise_name: string;
  default_weight: number;
  target_sets: number;
  target_reps: number;
  sort_order: number;
  image_data: string | null;
  is_required: number;
  is_archived?: number;
  created_at: string;
  updated_at: string;
}

export interface NewExerciseInput {
  day_of_week: number;
  muscle_group: string;
  exercise_name: string;
  default_weight: number;
  target_sets: number;
  target_reps: number;
  sort_order?: number;
  image_data?: string | null;
  is_required?: number | boolean;
}

// 训练会话
export interface WorkoutSession {
  id: number;
  date: string; // YYYY-MM-DD
  started_at: string;
  completed_at: string | null;
  training_started_at: string | null;
  training_ended_at: string | null;
  plan_day_of_week?: number | null;
}

// 单组打卡记录
export interface SetLog {
  id: number;
  session_id: number;
  exercise_config_id: number;
  set_number: number;
  weight_used: number;
  reps_done: number;
  completed_at: string;
  exercise_name?: string | null;
  muscle_group?: string | null;
}

export type SetLogWithMeta = SetLog & { exercise_name: string; muscle_group: string };

// 重量变更记录
export interface WeightChange {
  id: number;
  exercise_config_id: number;
  old_weight: number;
  new_weight: number;
  changed_at: string;
}

export interface BackupData {
  app?: string;
  version?: number;
  exported_at?: string;
  configs: ExerciseConfig[];
  sessions: WorkoutSession[];
  set_logs: SetLog[];
  weight_changes: WeightChange[];
  weight_logs?: WeightLog[];
  nutrition_plans?: NutritionPlan[];
  nutrition_items?: NutritionItem[];
  app_settings?: AppSetting[];
}

export interface AppSetting {
  key: string;
  value: string;
}

export interface WeightLog {
  id: number;
  date: string;
  weight_kg: number;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface WeightLogInput {
  id?: number;
  date: string;
  weight_kg: number;
  note: string;
}

export interface NutritionPlan {
  id: number;
  name: string;
  start_date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  note: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface NutritionItem {
  id: number;
  plan_id: number;
  meal: string;
  food_name: string;
  amount: string;
  unit: string;
  note: string;
  sort_order: number;
}

export interface NutritionPlanWithItems extends NutritionPlan {
  items: NutritionItem[];
}

export interface NutritionPlanInput {
  id?: number;
  name: string;
  start_date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  note: string;
}

export interface NutritionItemInput {
  id?: number;
  meal: string;
  food_name: string;
  amount: string;
  unit: string;
  note: string;
  sort_order: number;
}
