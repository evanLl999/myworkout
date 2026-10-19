import { useState, useEffect } from 'react';
import { parseTimestamp } from '../utils/date';

interface Props {
  lastCheckInTime: string | null;
  isComplete: boolean;
}

function formatRest(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h${m}m`;
  if (m > 0) return `${m}m${s}s`;
  return `${s}s`;
}

export default function RestTimer({ lastCheckInTime, isComplete }: Props) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!lastCheckInTime || isComplete) return;
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, [lastCheckInTime, isComplete]);

  if (isComplete) {
    return <span className="rest-timer" style={{ background: 'var(--success)', color: '#fff' }}>训练完成 ✓</span>;
  }
  if (!lastCheckInTime) return null;

  const elapsed = Math.max(0, Math.floor((Date.now() - parseTimestamp(lastCheckInTime).getTime()) / 1000));
  return <span className="rest-timer">休息中: {formatRest(elapsed)}</span>;
}
