import { parseDate } from '../utils/date';

export interface WeightPoint {
  date: string;
  weight_kg: number;
}

interface Props {
  points: WeightPoint[];
}

interface PlottedPoint {
  x: number;
  y: number;
  date: string;
  weight: number;
}

const LEFT = 38;
const RIGHT = 302;
const TOP = 18;
const BOTTOM = 120;

function dayIndex(date: string, start: string): number {
  return Math.round((parseDate(date).getTime() - parseDate(start).getTime()) / 86400000);
}

function formatTick(date: string): string {
  const d = parseDate(date);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function smoothPath(points: PlottedPoint[]): string {
  if (points.length < 2) return '';
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return path;
}

export default function WeightChart({ points }: Props) {
  if (points.length < 2) {
    return (
      <div className="weight-chart-empty">
        <span className="weight-chart-dash" />
        <p>再记录一次，就能看到趋势</p>
      </div>
    );
  }

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const start = sorted[0].date;
  const end = sorted[sorted.length - 1].date;
  const span = Math.max(1, dayIndex(end, start));
  const weights = sorted.map((p) => p.weight_kg);
  const rawMin = Math.min(...weights);
  const rawMax = Math.max(...weights);
  const padding = Math.max(0.35, (rawMax - rawMin) * 0.18);
  const min = rawMin - padding;
  const max = rawMax + padding;
  const range = Math.max(0.1, max - min);

  const plotted: PlottedPoint[] = sorted.map((point) => ({
    x: LEFT + (dayIndex(point.date, start) / span) * (RIGHT - LEFT),
    y: TOP + (1 - (point.weight_kg - min) / range) * (BOTTOM - TOP),
    date: point.date,
    weight: point.weight_kg,
  }));

  const line = smoothPath(plotted);
  const area = `${line} L ${plotted[plotted.length - 1].x} ${BOTTOM} L ${plotted[0].x} ${BOTTOM} Z`;
  const grid = [0, 0.5, 1].map((ratio) => ({
    y: TOP + ratio * (BOTTOM - TOP),
    value: max - ratio * range,
  }));
  const tickIndexes = Array.from(new Set([0, Math.floor((sorted.length - 1) / 2), sorted.length - 1]));

  return (
    <svg
      className="weight-chart-svg"
      viewBox="0 0 320 160"
      role="img"
      aria-label={`体重趋势，从 ${formatTick(start)} 到 ${formatTick(end)}`}
    >
      <defs>
        <linearGradient id="weight-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.26" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>

      {grid.map((item, index) => (
        <g key={index}>
          <line className="weight-grid-line" x1={LEFT} y1={item.y} x2={RIGHT} y2={item.y} />
          <text className="weight-axis-label" x={LEFT - 8} y={item.y + 3} textAnchor="end">
            {item.value.toFixed(1)}
          </text>
        </g>
      ))}

      <path className="weight-area" d={area} fill="url(#weight-area)" />
      <path className="weight-line" d={line} />

      {plotted.map((point, index) => (
        <circle
          key={`${point.date}-${index}`}
          className={`weight-dot${index === plotted.length - 1 ? ' is-latest' : ''}`}
          cx={point.x}
          cy={point.y}
          r={index === plotted.length - 1 ? 4.5 : 2.8}
        />
      ))}

      {tickIndexes.map((index) => (
        <text
          key={index}
          className="weight-axis-label weight-axis-x"
          x={plotted[index].x}
          y={148}
          textAnchor={index === 0 ? 'start' : index === sorted.length - 1 ? 'end' : 'middle'}
        >
          {formatTick(sorted[index].date)}
        </text>
      ))}
    </svg>
  );
}
