interface Props {
  weekStart: Date;
  onPrev: () => void;
  onNext: () => void;
  onCalendarClick: () => void;
}

function getWeekLabel(monday: Date) {
  const d = new Date(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}年第${weekNum}周`;
}

export default function WeekNavigator({ weekStart, onPrev, onNext, onCalendarClick }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
      <button className="btn btn-outline btn-sm" onClick={onPrev}>←</button>
      <span style={{ fontSize: 16, fontWeight: 600 }}>{getWeekLabel(weekStart)}</span>
      <button className="btn btn-outline btn-sm" onClick={onNext}>→</button>
      <button
        className="btn btn-outline btn-sm"
        onClick={onCalendarClick}
        style={{ marginLeft: 8, fontSize: 16 }}
        title="选择日期"
      >
        📅
      </button>
    </div>
  );
}

export { getWeekLabel };
