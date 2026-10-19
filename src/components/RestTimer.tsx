import { useState, useEffect } from 'react';
import { parseTimestamp } from '../utils/date';
import { CheckIcon } from './Icons';

interface Props {
  lastCheckInTime: string | null;
  isComplete: boolean;
}

function formatRest(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function RestTimer({ lastCheckInTime, isComplete }: Props) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!lastCheckInTime || isComplete) return;
    const timer = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(timer);
  }, [lastCheckInTime, isComplete]);

  if (isComplete) {
    return (
      <div className="rest-pill is-done">
        <span className="rest-dot" />
        <span className="rest-label">训练完成</span>
        <span className="rest-time"><CheckIcon /></span>
      </div>
    );
  }
  if (!lastCheckInTime) return null;

  const elapsed = Math.max(0, Math.floor((Date.now() - parseTimestamp(lastCheckInTime).getTime()) / 1000));
  return (
    <div className="rest-pill">
      <span className="rest-dot" />
      <span className="rest-label">休息中</span>
      <span className="rest-time">{formatRest(elapsed)}</span>
    </div>
  );
}
