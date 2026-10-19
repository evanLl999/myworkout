import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from './Icons';

interface Props {
  selectedDate: string;
  onSelect: (date: string) => void;
  onClose: () => void;
}

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

function formatDate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function CalendarPicker({ selectedDate, onSelect, onClose }: Props) {
  const [viewYear, setViewYear] = useState(() => {
    const [y] = selectedDate.split('-').map(Number);
    return y;
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const [, m] = selectedDate.split('-').map(Number);
    return m - 1;
  });

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [];

  for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(d);
  }

  const today = formatDate(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }

  function selectDay(day: number) {
    onSelect(formatDate(viewYear, viewMonth, day));
    onClose();
  }

  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet calendar-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="sheet-handle" />
        <header className="calendar-head">
          <div>
            <span className="eyebrow">CALENDAR</span>
            <h2 className="sheet-title">{viewYear}年 {viewMonth + 1}月</h2>
          </div>
          <div className="calendar-actions">
            <button type="button" className="icon-btn" onClick={prevMonth} aria-label="上个月">
              <ChevronLeftIcon />
            </button>
            <button type="button" className="icon-btn" onClick={nextMonth} aria-label="下个月">
              <ChevronRightIcon />
            </button>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
              <CloseIcon />
            </button>
          </div>
        </header>

        <div className="calendar-weekdays">
          {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
        </div>

        <div className="calendar-grid">
          {cells.map((day, index) => {
            if (day === null) return <span key={`empty-${index}`} />;
            const dateStr = formatDate(viewYear, viewMonth, day);
            const classes = ['calendar-day'];
            if (dateStr === selectedDate) classes.push('is-selected');
            if (dateStr === today) classes.push('is-today');
            return (
              <button
                key={dateStr}
                type="button"
                className={classes.join(' ')}
                onClick={() => selectDay(day)}
                aria-label={`${viewYear}年${viewMonth + 1}月${day}日`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
