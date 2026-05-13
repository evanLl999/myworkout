interface Props {
  weekStart: Date;
  selectedDate: string; // YYYY-MM-DD
  onSelect: (date: string) => void;
}

const DAY_NAMES = ['一', '二', '三', '四', '五', '六', '日'];
const MONTH_ABBRS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function DayCards({ weekStart, selectedDate, onSelect }: Props) {
  const today = formatDate(new Date());
  const days: { date: string; name: string; dayNum: number; dateLabel: string }[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    days.push({
      date: formatDate(d),
      name: DAY_NAMES[i],
      dayNum: d.getDate(),
      dateLabel: `${d.getDate()}-${MONTH_ABBRS[d.getMonth()]}`,
    });
  }

  return (
    <div className="day-cards">
      {days.map((d) => {
        let cls = 'day-card';
        if (d.date === selectedDate) cls += ' active';
        else if (d.date === today) cls += ' today';
        return (
          <button key={d.date} className={cls} onClick={() => onSelect(d.date)}>
            <div className="day-name">周{d.name}</div>
            <div className="day-date">{d.dateLabel}</div>
          </button>
        );
      })}
    </div>
  );
}
