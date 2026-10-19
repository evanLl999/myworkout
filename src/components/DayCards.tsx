interface Props {
  weekStart: Date;
  selectedDate: string;
  onSelect: (date: string) => void;
}

const DAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function DayCards({ weekStart, selectedDate, onSelect }: Props) {
  const today = formatDate(new Date());
  const days: { date: string; name: string; dayNum: number }[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    days.push({
      date: formatDate(d),
      name: DAY_NAMES[i],
      dayNum: d.getDate(),
    });
  }

  return (
    <div className="day-cards">
      {days.map((d) => {
        const classes = ['day-card'];
        if (d.date === selectedDate) classes.push('is-active');
        if (d.date === today) classes.push('is-today');
        return (
          <button
            key={d.date}
            type="button"
            className={classes.join(' ')}
            onClick={() => onSelect(d.date)}
            aria-label={`${d.date} ${d.name}`}
          >
            <span className="day-name">{d.name}</span>
            <span className="day-date">{d.dayNum}</span>
            <span className="day-dot" />
          </button>
        );
      })}
    </div>
  );
}
