import { useState } from 'react';

interface Props {
  selectedDate: string;
  onSelect: (date: string) => void;
  onClose: () => void;
}

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

  const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [];

  for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(d);
  }

  const today = formatDate(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

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

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onClose}>
      <div className="card" style={{ width: 320, padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <button className="btn btn-outline btn-sm" onClick={prevMonth}>←</button>
          <span style={{ fontWeight: 600 }}>
            {viewYear}年{viewMonth + 1}月
          </span>
          <button className="btn btn-outline btn-sm" onClick={nextMonth}>→</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center' }}>
          {['一', '二', '三', '四', '五', '六', '日'].map((n) => (
            <div key={n} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '4px 0' }}>{n}</div>
          ))}
          {cells.map((d, i) => {
            if (d === null) return <div key={`e${i}`} />;
            const dateStr = formatDate(viewYear, viewMonth, d);
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === today;
            return (
              <button
                key={d}
                onClick={() => selectDay(d)}
                style={{
                  padding: '6px 0', border: 'none', borderRadius: 6, cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 14,
                  background: isSelected ? 'var(--primary)' : 'transparent',
                  color: isSelected ? '#fff' : isToday ? 'var(--primary)' : 'var(--text)',
                  fontWeight: isSelected || isToday ? 600 : 400,
                  outline: isToday && !isSelected ? '1px solid var(--primary)' : undefined,
                }}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
