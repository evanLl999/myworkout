import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import * as api from '../db/api';
import type { WeightLog } from '../types';
import WeightChart, { type WeightPoint } from '../components/WeightChart';
import { ChevronRightIcon, CloseIcon, PlusIcon, TrashIcon, TrendIcon } from '../components/Icons';
import { formatDate, monthDayCN, parseDate, weekdayCN } from '../utils/date';

type AssessmentTone = 'good' | 'warn' | 'bad' | 'muted';

interface Assessment {
  tone: AssessmentTone;
  label: string;
  rate: number | null;
  message: string;
}

function daysBetween(start: string, end: string): number {
  return Math.round((parseDate(end).getTime() - parseDate(start).getTime()) / 86400000);
}

function assessWeight(logs: WeightLog[]): Assessment {
  const recent = logs.filter((log) => daysBetween(log.date, formatDate(new Date())) <= 28);
  if (recent.length < 2) {
    return {
      tone: 'muted',
      label: '数据不足',
      rate: null,
      message: '再记录至少两次，趋势评估才有意义。',
    };
  }

  const first = recent[0];
  const last = recent[recent.length - 1];
  const span = daysBetween(first.date, last.date);
  if (span < 7) {
    return {
      tone: 'muted',
      label: '数据不足',
      rate: null,
      message: '至少间隔 7 天，才能估算每周变化速度。',
    };
  }

  const xs = recent.map((log) => daysBetween(first.date, log.date));
  const ys = recent.map((log) => log.weight_kg);
  const meanX = xs.reduce((sum, x) => sum + x, 0) / xs.length;
  const meanY = ys.reduce((sum, y) => sum + y, 0) / ys.length;
  const numerator = xs.reduce((sum, x, i) => sum + (x - meanX) * (ys[i] - meanY), 0);
  const denominator = xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0);
  if (denominator === 0) {
    return { tone: 'muted', label: '数据不足', rate: null, message: '记录日期太集中，暂时算不出周变化。' };
  }

  const rate = (numerator / denominator) * 7;
  if (rate <= -0.25 && rate >= -0.75) {
    return {
      tone: 'good',
      label: '良好',
      rate,
      message: '下降速度在 0.25–0.75 kg/周，比较稳妥。',
    };
  }
  if (rate < -0.75) {
    return {
      tone: 'warn',
      label: '偏快',
      rate,
      message: '下降超过 0.75 kg/周，注意蛋白质和恢复。',
    };
  }
  if (rate > 0.25) {
    return {
      tone: 'bad',
      label: '上升',
      rate,
      message: '体重在上升，结合饮食记录观察一下。',
    };
  }
  return {
    tone: 'warn',
    label: '偏慢',
    rate,
    message: '变化比较平缓，可以再观察 1–2 周。',
  };
}

function rateText(rate: number | null): string {
  if (rate == null) return '—';
  return `${rate > 0 ? '+' : ''}${rate.toFixed(2)}`;
}

export default function WeightPage() {
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<30 | 90 | 0>(30);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<WeightLog | null>(null);
  const [error, setError] = useState('');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      setLogs(await api.getWeightLogs());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '体重记录加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    if (!sheetOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [sheetOpen]);

  const latest = logs[logs.length - 1] ?? null;
  const assessment = useMemo(() => assessWeight(logs), [logs]);
  const rangePoints: WeightPoint[] = useMemo(() => {
    const today = formatDate(new Date());
    const filtered = range === 0
      ? logs
      : logs.filter((log) => daysBetween(log.date, today) <= range);
    return filtered.map((log) => ({ date: log.date, weight_kg: log.weight_kg }));
  }, [logs, range]);

  const recent = logs.filter((log) => daysBetween(log.date, formatDate(new Date())) <= 28);
  const delta = recent.length > 1
    ? recent[recent.length - 1].weight_kg - recent[0].weight_kg
    : null;
  const deltaText = delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg`;

  function openAdd() {
    setEditing(null);
    setError('');
    setSheetOpen(true);
  }

  function openEdit(log: WeightLog) {
    setEditing(log);
    setError('');
    setSheetOpen(true);
  }

  async function handleSaved() {
    setSheetOpen(false);
    setEditing(null);
    await loadLogs();
  }

  async function handleDelete(log: WeightLog) {
    if (!confirm(`删除 ${monthDayCN(log.date)} 的体重记录吗？`)) return;
    try {
      await api.deleteWeightLog(log.id);
      setSheetOpen(false);
      setEditing(null);
      await loadLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="eyebrow">BODY / TREND</span>
          <h1 className="page-title">体重趋势</h1>
        </div>
        <button type="button" className="icon-btn icon-btn-accent" onClick={openAdd} aria-label="记录体重">
          <PlusIcon />
        </button>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')}>关闭</button>
        </div>
      )}

      <section className="weight-hero">
        <div className="weight-hero-top">
          <div>
            <span className="eyebrow">LATEST</span>
            <div className="weight-value">
              {latest ? latest.weight_kg.toFixed(1) : '—'}
              <span>kg</span>
            </div>
            <span className="weight-sub">
              {latest ? `${monthDayCN(latest.date)} · ${weekdayCN(latest.date)}` : '还没有记录'}
            </span>
          </div>
          <span className={`assessment-badge is-${assessment.tone}`}>{assessment.label}</span>
        </div>

        <div className="weight-rate-row">
          <div className="weight-rate">
            {rateText(assessment.rate)}
            <span>kg/周</span>
          </div>
          <div className="weight-rate-meta">
            <span>近 28 天</span>
            <span className={delta != null && delta < 0 ? 'is-down' : delta != null && delta > 0 ? 'is-up' : ''}>
              {deltaText}
            </span>
          </div>
        </div>
        <p className="weight-assessment-message">{assessment.message}</p>

        <WeightChart points={rangePoints} />

        <div className="chart-range" role="group" aria-label="图表时间范围">
          {[
            { value: 30 as const, label: '30 天' },
            { value: 90 as const, label: '90 天' },
            { value: 0 as const, label: '全部' },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              className={range === item.value ? 'is-active' : ''}
              onClick={() => setRange(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="weight-standard">良好区间：每周下降 0.25–0.75 kg · 仅作趋势参考</p>
      </section>

      <section className="weight-history">
        <div className="section-head">
          <div>
            <span className="eyebrow">LOG</span>
            <h2 className="section-title">记录</h2>
          </div>
          <span className="section-count">{logs.length} 条</span>
        </div>

        {loading ? (
          <div className="skeleton-list">
            <div className="skeleton-card is-short" />
          </div>
        ) : logs.length === 0 ? (
          <div className="weight-empty">
            <span className="empty-icon"><TrendIcon /></span>
            <p>记录第一笔体重，开始看趋势。</p>
            <button type="button" className="btn btn-primary btn-sm" onClick={openAdd}>记录第一笔</button>
          </div>
        ) : (
          <div className="weight-rows">
            {logs.slice().reverse().map((log) => {
              const index = logs.findIndex((item) => item.id === log.id);
              const previous = index > 0 ? logs[index - 1] : null;
              const rowDelta = previous ? log.weight_kg - previous.weight_kg : null;
              return (
                <button type="button" className="weight-row" key={log.id} onClick={() => openEdit(log)}>
                  <div className="weight-row-copy">
                    <span className="weight-row-date">
                      {monthDayCN(log.date)} <small>{weekdayCN(log.date)}</small>
                    </span>
                    {log.note && <span className="weight-row-note">{log.note}</span>}
                  </div>
                  <span className="weight-row-value">{log.weight_kg.toFixed(1)}<small>kg</small></span>
                  <span className={`weight-row-delta${rowDelta != null && rowDelta < 0 ? ' is-down' : rowDelta != null && rowDelta > 0 ? ' is-up' : ''}`}>
                    {rowDelta == null ? '—' : `${rowDelta > 0 ? '+' : ''}${rowDelta.toFixed(1)}`}
                  </span>
                  <ChevronRightIcon className="weight-row-chevron" />
                </button>
              );
            })}
          </div>
        )}
      </section>

      <p className="disclaimer">体重会受水分、盐分和测量时间影响，单日波动不代表真实脂肪变化。</p>

      {sheetOpen && createPortal(
        <WeightSheet
          log={editing}
          defaultWeight={latest?.weight_kg}
          onClose={() => setSheetOpen(false)}
          onSaved={handleSaved}
          onDelete={editing ? () => handleDelete(editing) : undefined}
        />,
        document.body
      )}
    </div>
  );
}

function WeightSheet({
  log,
  defaultWeight,
  onClose,
  onSaved,
  onDelete,
}: {
  log: WeightLog | null;
  defaultWeight?: number;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: () => void;
}) {
  const [date, setDate] = useState(log?.date ?? formatDate(new Date()));
  const [weight, setWeight] = useState(log ? String(log.weight_kg) : defaultWeight ? String(defaultWeight) : '');
  const [note, setNote] = useState(log?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    const value = parseFloat(weight);
    if (!date || !Number.isFinite(value) || value <= 0 || value > 500) {
      setError('请填写有效日期和体重');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.saveWeightLog({ id: log?.id, date, weight_kg: value, note: note.trim() });
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
            <span className="eyebrow">{log ? 'EDIT WEIGHT' : 'NEW WEIGHT'}</span>
            <h2 className="sheet-title">{log ? '编辑体重' : '记录体重'}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            <CloseIcon />
          </button>
        </header>

        <div className="sheet-body">
          {error && <div className="form-error">{error}</div>}
          <label className="field">
            <span className="field-label">日期</span>
            <input
              className="input"
              type="date"
              value={date}
              max={formatDate(new Date())}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">体重 kg</span>
            <input
              className="input input-weight"
              type="text"
              inputMode="decimal"
              placeholder="例如 89.6"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">备注（可选）</span>
            <input
              className="input"
              type="text"
              placeholder="例如：早晨空腹"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <p className="field-hint">同一天只保留一条记录，再次保存会覆盖原来的数值。</p>
          {onDelete && (
            <button type="button" className="text-btn text-btn-danger" onClick={onDelete}>
              <TrashIcon />
              删除这条记录
            </button>
          )}
        </div>

        <footer className="sheet-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>取消</button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存记录'}
          </button>
        </footer>
      </div>
    </div>
  );
}
