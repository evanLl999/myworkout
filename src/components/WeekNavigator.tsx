import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from './Icons';

interface Props {
  weekStart: Date;
  onPrev: () => void;
  onNext: () => void;
  onCalendarClick: () => void;
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getWeekRange(monday: Date): string {
  const end = new Date(monday);
  end.setDate(end.getDate() + 6);
  const startMonth = monday.getMonth() + 1;
  const endMonth = end.getMonth() + 1;
  if (startMonth === endMonth) {
    return `${startMonth}月 ${monday.getDate()}–${end.getDate()}`;
  }
  return `${startMonth}月${monday.getDate()}日 – ${endMonth}月${end.getDate()}日`;
}

export function getWeekLabel(monday: Date): string {
  return `第${getISOWeek(monday)}周 · ${getWeekRange(monday)}`;
}

export default function WeekNavigator({ weekStart, onPrev, onNext, onCalendarClick }: Props) {
  return (
    <div className="week-nav">
      <div>
        <span className="eyebrow">WEEK {String(getISOWeek(weekStart)).padStart(2, '0')}</span>
        <h2 className="week-title">{getWeekRange(weekStart)}</h2>
      </div>
      <div className="week-actions">
        <button type="button" className="icon-btn" onClick={onPrev} aria-label="上一周">
          <ChevronLeftIcon />
        </button>
        <button type="button" className="icon-btn" onClick={onNext} aria-label="下一周">
          <ChevronRightIcon />
        </button>
        <button type="button" className="icon-btn icon-btn-accent" onClick={onCalendarClick} aria-label="选择日期">
          <CalendarIcon />
        </button>
      </div>
    </div>
  );
}
