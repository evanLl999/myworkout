import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import * as api from '../db/api';
import type {
  NutritionItemInput,
  NutritionPlan,
  NutritionPlanWithItems,
} from '../types';
import { CloseIcon, EditIcon, HistoryIcon, PlusIcon, TrashIcon } from '../components/Icons';
import { formatDate } from '../utils/date';

interface DraftItem extends NutritionItemInput {
  key: string;
}

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toDraftItems(plan: NutritionPlanWithItems): DraftItem[] {
  return plan.items.map((item) => ({
    key: uid(),
    id: item.id,
    meal: item.meal,
    food_name: item.food_name,
    amount: item.amount,
    unit: item.unit,
    note: item.note,
    sort_order: item.sort_order,
  }));
}

function nextPhaseName(current: string, plans: NutritionPlan[]): string {
  const numbers = plans.map((plan) => {
    const match = plan.name.match(/(\d+)\s*$/);
    return match ? Number(match[1]) : 0;
  });
  const next = Math.max(0, ...numbers) + 1;
  const base = current.replace(/\s*\d+\s*$/, '').trim() || '膳食阶段';
  return `${base} ${String(next).padStart(2, '0')}`;
}

function draftFromPlan(plan: NutritionPlanWithItems, plans: NutritionPlan[]): NutritionPlanWithItems {
  return {
    ...plan,
    id: 0,
    name: nextPhaseName(plan.name, plans),
    start_date: formatDate(new Date()),
    items: plan.items.map((item, index) => ({
      ...item,
      id: -(index + 1),
      sort_order: index + 1,
    })),
  };
}

export default function NutritionPage() {
  const [plan, setPlan] = useState<NutritionPlanWithItems | null>(null);
  const [plans, setPlans] = useState<NutritionPlan[]>([]);
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetPlan, setSheetPlan] = useState<NutritionPlanWithItems | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [error, setError] = useState('');

  const loadPlan = useCallback(async () => {
    setLoading(true);
    try {
      const [nutrition, weights, historyPlans] = await Promise.all([
        api.ensureNutritionTemplate(),
        api.getWeightLogs(),
        api.getNutritionPlans(),
      ]);
      setPlan(nutrition);
      setPlans(historyPlans);
      setLatestWeight(weights.length > 0 ? weights[weights.length - 1].weight_kg : null);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '膳食计划加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  useEffect(() => {
    if (!sheetOpen && !historyOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [sheetOpen, historyOpen]);

  const macros = useMemo(() => {
    if (!plan) return null;
    const proteinCal = plan.protein * 4;
    const carbsCal = plan.carbs * 4;
    const fatCal = plan.fat * 9;
    const total = proteinCal + carbsCal + fatCal;
    const proteinPct = total > 0 ? Math.round((proteinCal / total) * 100) : 0;
    const carbsPct = total > 0 ? Math.round((carbsCal / total) * 100) : 0;
    return {
      proteinCal,
      carbsCal,
      fatCal,
      total,
      proteinPct,
      carbsPct,
      fatPct: total > 0 ? Math.max(0, 100 - proteinPct - carbsPct) : 0,
    };
  }, [plan]);

  async function handleSaved() {
    setSheetOpen(false);
    setSheetPlan(null);
    await loadPlan();
  }

  function openEdit() {
    if (!plan) return;
    setSheetPlan(plan);
    setSheetOpen(true);
  }

  function openNewPhase() {
    if (!plan) return;
    setHistoryOpen(false);
    setSheetPlan(draftFromPlan(plan, plans));
    setSheetOpen(true);
  }

  async function activatePlan(id: number) {
    try {
      await api.activateNutritionPlan(id);
      setHistoryOpen(false);
      await loadPlan();
    } catch (err) {
      setError(err instanceof Error ? err.message : '切换阶段失败');
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="eyebrow">FUEL / PLAN</span>
          <h1 className="page-title">膳食指南</h1>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setHistoryOpen(true)}
            aria-label="阶段历史"
            disabled={!plan}
          >
            <HistoryIcon />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn-accent"
            onClick={openEdit}
            aria-label="编辑膳食计划"
            disabled={!plan}
          >
            <EditIcon />
          </button>
        </div>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')}>关闭</button>
        </div>
      )}

      {loading ? (
        <div className="skeleton-list">
          <div className="skeleton-card is-tall" />
          <div className="skeleton-card is-short" />
        </div>
      ) : plan && macros ? (
        <>
          <section className="nutrition-hero">
            <div className="nutrition-hero-top">
              <div>
                <span className="eyebrow">DAILY TARGET</span>
                <div className="calorie-value">
                  {Math.round(plan.calories).toLocaleString('zh-CN')}
                  <span>kcal</span>
                </div>
              </div>
              <span className="phase-pill">{plan.name}</span>
            </div>

            <p className="nutrition-profile">{plan.note}</p>

            <div className="macro-stack" aria-label="三大营养素热量比例">
              <span className="macro-segment is-protein" style={{ width: `${macros.proteinPct}%` }} />
              <span className="macro-segment is-carbs" style={{ width: `${macros.carbsPct}%` }} />
              <span className="macro-segment is-fat" style={{ width: `${macros.fatPct}%` }} />
            </div>

            <div className="macro-grid">
              <div className="macro-card">
                <span className="macro-label"><i className="macro-dot is-protein" />蛋白质</span>
                <span className="macro-value">{plan.protein}<small>g</small></span>
                <span className="macro-kcal">{Math.round(macros.proteinCal)} kcal · {macros.proteinPct}%</span>
              </div>
              <div className="macro-card">
                <span className="macro-label"><i className="macro-dot is-carbs" />碳水</span>
                <span className="macro-value">{plan.carbs}<small>g</small></span>
                <span className="macro-kcal">{Math.round(macros.carbsCal)} kcal · {macros.carbsPct}%</span>
              </div>
              <div className="macro-card">
                <span className="macro-label"><i className="macro-dot is-fat" />脂肪</span>
                <span className="macro-value">{plan.fat}<small>g</small></span>
                <span className="macro-kcal">{Math.round(macros.fatCal)} kcal · {macros.fatPct}%</span>
              </div>
            </div>

            <p className="nutrition-note">
              按三大营养素换算约 <strong>{Math.round(macros.total).toLocaleString('zh-CN')}</strong> 千卡
              <span> · </span>
              {latestWeight ? `当前体重 ${latestWeight.toFixed(1)} kg` : '尚未记录体重'}
            </p>
          </section>

          <section className="food-card">
            <div className="section-head">
              <div>
                <span className="eyebrow">DAILY FOODS</span>
                <h2 className="section-title">每日固定食材</h2>
              </div>
              <span className="section-count">{plan.items.length} 项</span>
            </div>

            <div className="food-list">
              {plan.items.map((item) => (
                <div className="food-row" key={item.id}>
                  <span className="food-dot" />
                  <div className="food-copy">
                    <span className="food-name">{item.food_name}</span>
                    <span className="food-note">
                      {item.meal !== '每日固定' ? `${item.meal} · ` : ''}{item.note}
                    </span>
                  </div>
                  <span className="food-amount">
                    {item.amount}{item.unit ? ` ${item.unit}` : ''}
                  </span>
                </div>
              ))}
            </div>

            <p className="food-footnote">
              再搭配水果、其他蔬菜和适量奶类或强化钙豆奶，额外热量要计入。
            </p>
          </section>

          <p className="disclaimer">
            这是一份可编辑的阶段模板，不构成医疗或营养处方；实际摄入会因食材和烹饪方式略有差异。
          </p>
        </>
      ) : (
        <div className="empty-state-card">
          <span className="empty-icon"><PlusIcon /></span>
          <span className="eyebrow">NO PLAN</span>
          <h2 className="empty-title">还没有膳食模板</h2>
          <p className="empty-copy">点击生成一份初始模板，之后可以自由修改。</p>
          <button type="button" className="btn btn-primary" onClick={loadPlan}>生成初始模板</button>
        </div>
      )}

      {sheetOpen && sheetPlan && createPortal(
        <NutritionSheet
          plan={sheetPlan}
          onClose={() => {
            setSheetOpen(false);
            setSheetPlan(null);
          }}
          onSaved={handleSaved}
        />,
        document.body
      )}

      {historyOpen && plan && createPortal(
        <NutritionHistorySheet
          plans={plans}
          activeId={plan.id}
          onActivate={activatePlan}
          onNew={openNewPhase}
          onClose={() => setHistoryOpen(false)}
        />,
        document.body
      )}
    </div>
  );
}

function NutritionSheet({
  plan,
  onClose,
  onSaved,
}: {
  plan: NutritionPlanWithItems;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(plan.name);
  const [startDate, setStartDate] = useState(plan.start_date);
  const [calories, setCalories] = useState(String(plan.calories));
  const [protein, setProtein] = useState(String(plan.protein));
  const [carbs, setCarbs] = useState(String(plan.carbs));
  const [fat, setFat] = useState(String(plan.fat));
  const [note, setNote] = useState(plan.note);
  const [items, setItems] = useState<DraftItem[]>(() => toDraftItems(plan));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const calculated = (parseFloat(protein) || 0) * 4
    + (parseFloat(carbs) || 0) * 4
    + (parseFloat(fat) || 0) * 9;

  function updateItem(key: string, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((item) => item.key === key ? { ...item, ...patch } : item));
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        key: uid(),
        meal: '每日固定',
        food_name: '',
        amount: '',
        unit: 'g',
        note: '',
        sort_order: prev.length + 1,
      },
    ]);
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('请填写阶段名称');
      return;
    }
    const cleanItems = items
      .filter((item) => item.food_name.trim())
      .map((item, index) => ({
        meal: item.meal || '每日固定',
        food_name: item.food_name.trim(),
        amount: item.amount.trim(),
        unit: item.unit,
        note: item.note.trim(),
        sort_order: index + 1,
      }));
    setSaving(true);
    setError('');
    try {
      await api.saveNutritionPlan({
        id: plan.id || undefined,
        name: name.trim(),
        start_date: startDate,
        calories: parseFloat(calories) || 0,
        protein: parseFloat(protein) || 0,
        carbs: parseFloat(carbs) || 0,
        fat: parseFloat(fat) || 0,
        note: note.trim(),
      }, cleanItems);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
      setSaving(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="sheet-handle" />
        <header className="sheet-head">
          <div>
            <span className="eyebrow">{plan.id ? 'EDIT NUTRITION' : 'NEW NUTRITION'}</span>
            <h2 className="sheet-title">{plan.id ? '编辑膳食阶段' : '新建膳食阶段'}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            <CloseIcon />
          </button>
        </header>

        <div className="sheet-body">
          {error && <div className="form-error">{error}</div>}

          <label className="field">
            <span className="field-label">阶段名称</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          <label className="field">
            <span className="field-label">开始日期</span>
            <input
              className="input"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>

          <div className="form-grid is-two">
            <label className="field">
              <span className="field-label">总热量 kcal</span>
              <input className="input" inputMode="decimal" value={calories} onChange={(e) => setCalories(e.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">蛋白质 g</span>
              <input className="input" inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">碳水 g</span>
              <input className="input" inputMode="decimal" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">脂肪 g</span>
              <input className="input" inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} />
            </label>
          </div>

          <p className="macro-calc-hint">
            按 4 / 4 / 9 换算约 <strong>{Math.round(calculated).toLocaleString('zh-CN')}</strong> 千卡
          </p>

          <label className="field">
            <span className="field-label">阶段说明</span>
            <textarea className="input textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>

          <div className="food-edit-head">
            <span className="field-label">食材清单</span>
            <button type="button" className="btn btn-outline btn-sm" onClick={addItem}>
              <PlusIcon className="btn-icon" />
              添加食材
            </button>
          </div>

          <div className="food-edit-list">
            {items.map((item) => (
              <div className="food-edit-card" key={item.key}>
                <div className="food-edit-title">
                  <input
                    className="input"
                    placeholder="食材名称"
                    value={item.food_name}
                    onChange={(e) => updateItem(item.key, { food_name: e.target.value })}
                  />
                  <button
                    type="button"
                    className="icon-btn is-danger"
                    onClick={() => setItems((prev) => prev.filter((entry) => entry.key !== item.key))}
                    aria-label="删除食材"
                  >
                    <TrashIcon />
                  </button>
                </div>
                <div className="food-edit-grid">
                  <input
                    className="input"
                    inputMode="decimal"
                    placeholder="数量"
                    value={item.amount}
                    onChange={(e) => updateItem(item.key, { amount: e.target.value })}
                  />
                  <select
                    className="input"
                    value={item.unit}
                    onChange={(e) => updateItem(item.key, { unit: e.target.value })}
                  >
                    <option value="g">g</option>
                    <option value="个">个</option>
                    <option value="ml">ml</option>
                    <option value="份">份</option>
                  </select>
                  <input
                    className="input food-note-input"
                    placeholder="生重 / 去壳 / 熟重"
                    value={item.note}
                    onChange={(e) => updateItem(item.key, { note: e.target.value })}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <footer className="sheet-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>取消</button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存阶段'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function NutritionHistorySheet({
  plans,
  activeId,
  onActivate,
  onNew,
  onClose,
}: {
  plans: NutritionPlan[];
  activeId: number;
  onActivate: (id: number) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet history-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="sheet-handle" />
        <header className="sheet-head">
          <div>
            <span className="eyebrow">PHASE HISTORY</span>
            <h2 className="sheet-title">阶段历史</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            <CloseIcon />
          </button>
        </header>

        <div className="sheet-body">
          <p className="history-note">
            切换阶段只改变当前指南，历史阶段和食材都会保留。新建阶段会复制当前配方作为起点。
          </p>
          <div className="phase-list">
            {plans.map((item) => {
              const active = item.id === activeId;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`phase-row${active ? ' is-active' : ''}`}
                  onClick={() => { if (!active) onActivate(item.id); }}
                  aria-current={active ? 'true' : undefined}
                >
                  <div className="phase-row-main">
                    <span className="phase-row-name">{item.name}</span>
                    <span className="phase-row-meta">
                      {item.start_date} · {Math.round(item.calories).toLocaleString('zh-CN')} kcal
                    </span>
                    <span className="phase-row-macros">
                      P {item.protein} · C {item.carbs} · F {item.fat}
                    </span>
                  </div>
                  <span className={`phase-badge${active ? ' is-active' : ''}`}>
                    {active ? '当前' : '切换'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <footer className="sheet-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>关闭</button>
          <button type="button" className="btn btn-primary" onClick={onNew}>新建阶段</button>
        </footer>
      </div>
    </div>
  );
}
