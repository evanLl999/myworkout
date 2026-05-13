import { useState, useEffect, useRef } from 'react';
import type { ExerciseConfig } from '../types';
import * as api from '../db/api';

const DAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

interface ExerciseFormData {
  muscle_group: string;
  exercise_name: string;
  default_weight: string;
  target_sets: string;
  target_reps: string;
  sort_order: string;
  image_data: string | null;
  is_required: boolean;
}

const EMPTY_FORM: ExerciseFormData = {
  muscle_group: '',
  exercise_name: '',
  default_weight: '0',
  target_sets: '4',
  target_reps: '12',
  sort_order: '0',
  image_data: null,
  is_required: true,
};

export default function DayConfig() {
  const [selectedDay, setSelectedDay] = useState(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
  const [exercises, setExercises] = useState<ExerciseConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ExerciseFormData>(EMPTY_FORM);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadExercises(selectedDay);
  }, [selectedDay]);

  async function loadExercises(day: number) {
    setLoading(true);
    const data = await api.getConfigsByDay(day);
    setExercises(data);
    setLoading(false);
  }

  function handleAdd() {
    // 自动计算下一个序号
    const nextOrder = exercises.length > 0
      ? Math.max(...exercises.map((e) => e.sort_order)) + 1
      : 1;
    setEditingId(null);
    setForm({ ...EMPTY_FORM, sort_order: String(nextOrder) });
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
  }

  function handleEdit(ex: ExerciseConfig) {
    setEditingId(ex.id);
    setForm({
      muscle_group: ex.muscle_group,
      exercise_name: ex.exercise_name,
      default_weight: String(ex.default_weight),
      target_sets: String(ex.target_sets),
      target_reps: String(ex.target_reps),
      sort_order: String(ex.sort_order),
      image_data: ex.image_data,
      is_required: !!ex.is_required,
    });
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
  }

  async function handleDelete(id: number) {
    await api.deleteExercise(id);
    await loadExercises(selectedDay);
  }

  async function handleSave() {
    if (!form.muscle_group.trim() || !form.exercise_name.trim()) return;

    const data = {
      muscle_group: form.muscle_group.trim(),
      exercise_name: form.exercise_name.trim(),
      default_weight: parseFloat(form.default_weight) || 0,
      target_sets: parseInt(form.target_sets) || 1,
      target_reps: parseInt(form.target_reps) || 1,
      sort_order: parseInt(form.sort_order) || 0,
      image_data: form.image_data,
      is_required: form.is_required,
    };

    if (editingId) {
      await api.updateExercise(editingId, data);
    } else {
      await api.addExercise({ ...data, day_of_week: selectedDay });
    }
    setShowForm(false);
    await loadExercises(selectedDay);
  }

  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm({ ...form, image_data: reader.result as string });
    };
    reader.readAsDataURL(file);
  }

  function handleRemoveImage() {
    setForm({ ...form, image_data: null });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleDayChange(day: number) {
    setSelectedDay(day);
    setShowForm(false);
  }

  return (
    <div>
      <div className="tabs">
        {DAY_NAMES.map((name, i) => (
          <button
            key={i}
            className={`tab${i === selectedDay ? ' active' : ''}`}
            onClick={() => handleDayChange(i)}
          >
            {name}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 40 }}>加载中...</p>
      ) : exercises.length === 0 && !showForm ? (
        <div className="page-placeholder">
          这天还没有训练计划，点击下方按钮添加
        </div>
      ) : (
        <div>
          {exercises.map((ex) => (
            <div key={ex.id} className="exercise-card">
              <div style={{ display: 'flex', gap: 12 }}>
                {ex.image_data && (
                  <div className="exercise-thumb" onClick={() => setEnlargedImage(ex.image_data)}>
                    <img src={ex.image_data} alt={ex.exercise_name} />
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div className="exercise-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="exercise-name">{ex.exercise_name}</span>
                      <span className={`tag ${ex.is_required ? 'tag-required' : 'tag-optional'}`}>
                        {ex.is_required ? '必练 *' : '选练'}
                      </span>
                    </div>
                    <span className="exercise-muscle">{ex.muscle_group}</span>
                  </div>
                  <div className="exercise-meta">
                    <span>{ex.target_sets} 组 × {ex.target_reps} 次</span>
                    <span>{ex.default_weight} kg</span>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>排序 #{ex.sort_order}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => handleEdit(ex)}>编辑</button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(ex.id)}>删除</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div ref={formRef} className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 16, fontSize: 16 }}>
            {editingId ? '编辑动作' : '添加动作'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">训练类型</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className={`btn btn-sm ${form.is_required ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setForm({ ...form, is_required: true })}
                >必练</button>
                <button
                  type="button"
                  className={`btn btn-sm ${!form.is_required ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setForm({ ...form, is_required: false })}
                >选练</button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">排序（数字越小越靠前）</label>
              <input className="form-input" type="text" inputMode="numeric"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">肌肉群</label>
              <input className="form-input" placeholder="例如：胸、背、腿"
                value={form.muscle_group}
                onChange={(e) => setForm({ ...form, muscle_group: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">动作名称</label>
              <input className="form-input" placeholder="例如：卧推"
                value={form.exercise_name}
                onChange={(e) => setForm({ ...form, exercise_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">配重 (kg)</label>
              <input className="form-input" type="text" inputMode="decimal"
                value={form.default_weight}
                onChange={(e) => setForm({ ...form, default_weight: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">组数</label>
              <input className="form-input" type="text" inputMode="numeric"
                value={form.target_sets}
                onChange={(e) => setForm({ ...form, target_sets: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">每组次数</label>
              <input className="form-input" type="text" inputMode="numeric"
                value={form.target_reps}
                onChange={(e) => setForm({ ...form, target_reps: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">参考图片</label>
              {form.image_data ? (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img src={form.image_data} alt="预览"
                    style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}
                  />
                  <button type="button" onClick={handleRemoveImage}
                    style={{
                      position: 'absolute', top: -8, right: -8,
                      width: 22, height: 22, borderRadius: '50%',
                      border: '1px solid var(--border)', background: '#fff',
                      cursor: 'pointer', fontSize: 12, lineHeight: '20px', color: '#e74c3c',
                    }}
                  >✕</button>
                </div>
              ) : (
                <div>
                  <input ref={fileInputRef} type="file" accept="image/*"
                    onChange={handleImagePick} style={{ fontSize: 13 }}
                  />
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button type="button" className="btn btn-primary" onClick={handleSave}>
              {editingId ? '保存修改' : '添加'}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>取消</button>
          </div>
        </div>
      )}

      {!showForm && (
        <div style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-primary" onClick={handleAdd}>+ 添加动作</button>
        </div>
      )}

      {enlargedImage && (
        <div className="image-overlay" onClick={() => setEnlargedImage(null)}>
          <img src={enlargedImage} alt="放大查看" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
