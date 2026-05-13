interface Props {
  weekStart: Date;
  onPrev: () => void;
  onNext: () => void;
  onCalendarClick: () => void;
}

function getWeekLabel(monday: Date) {
  const year = monday.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const dayOfYear = Math.floor((monday.getTime() - jan1.getTime()) / 86400000);
  const weekNum = Math.ceil((dayOfYear + jan1.getDay()) / 7) || 1;
  return `${year}年第${weekNum}周`;
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
