import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ExerciseConfig } from '../types';
import { CheckIcon, CloseIcon } from './Icons';

const DAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

interface Props {
  calendarDay: number;
  selectedDay: number;
  configs: ExerciseConfig[];
  onSelect: (planDay: number | null) => void;
  onClose: () => void;
}

export default function PlanPicker({
  calendarDay,
  selectedDay,
  configs,
  onSelect,
  onClose,
}: Props) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const stats = Array.from({ length: 7 }, (_, day) => {
    const items = configs.filter((item) => item.day_of_week === day && !item.is_archived);
    const muscles = Array.from(new Set(items.map((item) => item.muscle_group))).filter(Boolean);
    return {
      day,
      count: items.length,
      sets: items.reduce((sum, item) => sum + item.target_sets, 0),
      muscles,
    };
  });

  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet plan-picker-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="sheet-handle" />
        <header className="sheet-head">
          <div>
            <span className="eyebrow">MAKEUP PLAN</span>
            <h2 className="sheet-title">选择训练计划</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            <CloseIcon />
          </button>
        </header>

        <div className="sheet-body">
          <p className="history-note">
            补练只影响这一天，不会修改原来的周计划。已经开始训练或已有打卡时，请先重置当天记录。
          </p>

          <div className="plan-options">
            {stats.map((item) => {
              const disabled = item.count === 0;
              const selected = item.day === selectedDay && !disabled;
              return (
                <button
                  key={item.day}
                  type="button"
                  className={`plan-option${selected ? ' is-selected' : ''}`}
                  onClick={() => onSelect(item.day)}
                  disabled={disabled}
                >
                  <div className="plan-option-main">
                    <div className="plan-option-title">
                      <span className="plan-option-day">{DAY_NAMES[item.day]}</span>
                      {item.day === calendarDay && <span className="plan-option-today">今天</span>}
                    </div>
                    <span className="plan-option-meta">
                      {disabled
                        ? '未安排训练'
                        : `${item.muscles.slice(0, 2).join(' · ') || '训练'} · ${item.count} 个动作 · ${item.sets} 组`}
                    </span>
                  </div>
                  <span className={`plan-option-status${selected ? ' is-selected' : ''}`}>
                    {selected ? <CheckIcon /> : disabled ? '—' : '选择'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <footer className="sheet-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>取消</button>
          <button type="button" className="btn btn-outline" onClick={() => onSelect(null)}>
            按今天计划
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
