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
  created_at: string;
  updated_at: string;
}

// 训练会话
export interface WorkoutSession {
  id: number;
  date: string; // YYYY-MM-DD
  started_at: string;
  completed_at: string | null;
  training_started_at: string | null;
  training_ended_at: string | null;
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
}

// 重量变更记录
export interface WeightChange {
  id: number;
  exercise_config_id: number;
  old_weight: number;
  new_weight: number;
  changed_at: string;
}
