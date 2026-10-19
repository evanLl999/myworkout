import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ExerciseConfig } from '../types';
import * as api from '../db/api';
import {
  CloseIcon,
  DumbbellIcon,
  EditIcon,
  PlusIcon,
  TrashIcon,
  UploadIcon,
} from './Icons';

const DAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const DAY_EN = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

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
  sort_order: '1',
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadExercises(selectedDay);
  }, [selectedDay]);

  useEffect(() => {
    if (!showForm) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [showForm]);

  async function loadExercises(day: number) {
    setLoading(true);
    const data = await api.getConfigsByDay(day);
    setExercises(data);
    setLoading(false);
  }

  function handleAdd() {
    const nextOrder = exercises.length > 0
      ? Math.max(...exercises.map((e) => e.sort_order)) + 1
      : 1;
    setEditingId(null);
    setForm({ ...EMPTY_FORM, sort_order: String(nextOrder) });
    setError('');
    setShowForm(true);
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
    setError('');
    setShowForm(true);
  }

  function closeSheet() {
    if (saving) return;
    setShowForm(false);
    setError('');
  }

  async function handleDelete(id: number) {
    const target = exercises.find((ex) => ex.id === id);
    const name = target?.exercise_name ?? '这个动作';
    if (!confirm(`确定删除「${name}」吗？\n\n动作会从计划中移除，但历史打卡记录会保留。`)) return;
    setError('');
    try {
      await api.deleteExercise(id);
      await loadExercises(selectedDay);
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  }

  async function handleSave() {
    if (!form.muscle_group.trim() || !form.exercise_name.trim()) {
      setError('请填写肌肉群和动作名称');
      return;
    }

    const data = {
      muscle_group: form.muscle_group.trim(),
      exercise_name: form.exercise_name.trim(),
      default_weight: parseFloat(form.default_weight) || 0,
      target_sets: parseInt(form.target_sets) || 1,
      target_reps: parseInt(form.target_reps) || 1,
      sort_order: parseInt(form.sort_order) || 0,
      image_data: form.image_data,
      is_required: form.is_required ? 1 : 0,
    };

    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await api.updateExercise(editingId, data);
      } else {
        await api.addExercise({ ...data, day_of_week: selectedDay });
      }
      setShowForm(false);
      await loadExercises(selectedDay);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      setError('图片太大了，请选择 15MB 以内的图片');
      return;
    }
    try {
      const compressed = await compressImage(file);
      setForm((prev) => ({ ...prev, image_data: compressed }));
      setError('');
    } catch {
      setError('图片处理失败，请换一张试试');
    }
  }

  function handleRemoveImage() {
    setForm((prev) => ({ ...prev, image_data: null }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleDayChange(day: number) {
    setSelectedDay(day);
    setShowForm(false);
  }

  return (
    <div>
      <div className="plan-tabs">
        {DAY_NAMES.map((name, i) => (
          <button
            key={name}
            type="button"
            className={`plan-tab${i === selectedDay ? ' is-active' : ''}`}
            onClick={() => handleDayChange(i)}
            aria-pressed={i === selectedDay}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="plan-head">
        <div>
          <span className="eyebrow">{DAY_EN[selectedDay]} / PROGRAM</span>
          <h2 className="plan-title">{DAY_NAMES[selectedDay]}计划</h2>
        </div>
        <span className="plan-count">{exercises.length} 个动作</span>
      </div>

      {!showForm && error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')}>关闭</button>
        </div>
      )}

      {loading ? (
        <div className="skeleton-list" aria-label="加载中">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
      ) : exercises.length === 0 ? (
        <div className="empty-plan">
          <span className="empty-icon"><DumbbellIcon /></span>
          <h3>这天还没有动作</h3>
          <p>从第一个动作开始，慢慢把计划搭起来。</p>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleAdd}>
            添加第一个动作
          </button>
        </div>
      ) : (
        <div className="plan-list">
          {exercises.map((ex) => (
            <article key={ex.id} className="plan-card">
              <div className="plan-card-main">
                {ex.image_data && (
                  <button
                    type="button"
                    className="plan-thumb"
                    onClick={() => setEnlargedImage(ex.image_data)}
                    aria-label={`查看${ex.exercise_name}参考图`}
                  >
                    <img src={ex.image_data} alt={ex.exercise_name} />
                  </button>
                )}
                <div className="plan-card-copy">
                  <div className="exercise-kicker">
                    <span>{ex.muscle_group}</span>
                    <span className="kicker-sep">·</span>
                    <span>{ex.is_required ? '必练' : '选练'}</span>
                  </div>
                  <h3 className="plan-card-title">{ex.exercise_name}</h3>
                  <p className="plan-card-meta">
                    {ex.target_sets} 组 × {ex.target_reps} 次 · {ex.default_weight} kg
                  </p>
                </div>
              </div>
              <div className="plan-card-actions">
                <span className="sort-badge">#{ex.sort_order}</span>
                <button type="button" className="icon-btn" onClick={() => handleEdit(ex)} aria-label={`编辑${ex.exercise_name}`}>
                  <EditIcon />
                </button>
                <button type="button" className="icon-btn is-danger" onClick={() => handleDelete(ex.id)} aria-label={`删除${ex.exercise_name}`}>
                  <TrashIcon />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {!showForm && exercises.length > 0 && (
        <button type="button" className="add-exercise" onClick={handleAdd}>
          <PlusIcon />
          添加动作
        </button>
      )}

      {showForm && createPortal(
        <div className="sheet-backdrop" onClick={closeSheet}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="sheet-handle" />
            <header className="sheet-head">
              <div>
                <span className="eyebrow">{editingId ? 'EDIT EXERCISE' : 'NEW EXERCISE'}</span>
                <h2 className="sheet-title">{editingId ? '编辑动作' : '添加动作'}</h2>
              </div>
              <button type="button" className="icon-btn" onClick={closeSheet} aria-label="关闭">
                <CloseIcon />
              </button>
            </header>

            <div className="sheet-body">
              {error && <div className="form-error">{error}</div>}

              <div className="field">
                <span className="field-label">训练类型</span>
                <div className="segmented">
                  <button
                    type="button"
                    className={form.is_required ? 'is-active' : ''}
                    onClick={() => setForm({ ...form, is_required: true })}
                    aria-pressed={form.is_required}
                  >
                    必练
                  </button>
                  <button
                    type="button"
                    className={!form.is_required ? 'is-active' : ''}
                    onClick={() => setForm({ ...form, is_required: false })}
                    aria-pressed={!form.is_required}
                  >
                    选练
                  </button>
                </div>
              </div>

              <label className="field">
                <span className="field-label">肌肉群</span>
                <input
                  className="input"
                  placeholder="例如：胸、背、腿"
                  value={form.muscle_group}
                  onChange={(e) => setForm({ ...form, muscle_group: e.target.value })}
                />
              </label>

              <label className="field">
                <span className="field-label">动作名称</span>
                <input
                  className="input"
                  placeholder="例如：卧推"
                  value={form.exercise_name}
                  onChange={(e) => setForm({ ...form, exercise_name: e.target.value })}
                />
              </label>

              <div className="form-grid">
                <label className="field">
                  <span className="field-label">配重 kg</span>
                  <input
                    className="input"
                    type="text"
                    inputMode="decimal"
                    value={form.default_weight}
                    onChange={(e) => setForm({ ...form, default_weight: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span className="field-label">组数</span>
                  <input
                    className="input"
                    type="text"
                    inputMode="numeric"
                    value={form.target_sets}
                    onChange={(e) => setForm({ ...form, target_sets: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span className="field-label">每组次数</span>
                  <input
                    className="input"
                    type="text"
                    inputMode="numeric"
                    value={form.target_reps}
                    onChange={(e) => setForm({ ...form, target_reps: e.target.value })}
                  />
                </label>
              </div>

              <label className="field">
                <span className="field-label">排序</span>
                <input
                  className="input"
                  type="text"
                  inputMode="numeric"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                />
                <span className="field-hint">数字越小越靠前</span>
              </label>

              <div className="field">
                <span className="field-label">参考图片</span>
                {form.image_data ? (
                  <div className="image-preview">
                    <img src={form.image_data} alt="动作参考图预览" />
                    <button type="button" className="image-remove" onClick={handleRemoveImage} aria-label="移除图片">
                      <CloseIcon />
                    </button>
                  </div>
                ) : (
                  <label className="image-picker">
                    <UploadIcon />
                    <span>添加一张参考图</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImagePick}
                      hidden
                    />
                  </label>
                )}
              </div>
            </div>

            <footer className="sheet-footer">
              <button type="button" className="btn btn-ghost" onClick={closeSheet}>取消</button>
              <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? '保存中...' : editingId ? '保存修改' : '添加动作'}
              </button>
            </footer>
          </div>
        </div>,
        document.body
      )}

      {enlargedImage && createPortal(
        <div className="image-overlay" onClick={() => setEnlargedImage(null)}>
          <img src={enlargedImage} alt="放大查看" onClick={(e) => e.stopPropagation()} />
        </div>,
        document.body
      )}
    </div>
  );
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxSize = 900;
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('无法处理图片'));
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = () => reject(new Error('图片读取失败'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });
}
