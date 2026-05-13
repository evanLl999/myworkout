import { useState, useEffect } from 'react';

interface Props {
  lastCheckInTime: string | null;
  isComplete: boolean;
}

function formatRest(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
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
  if (!lastCheckInTime) return <span className="rest-timer">准备开始</span>;

  const elapsed = Math.floor((Date.now() - new Date(lastCheckInTime).getTime()) / 1000);
  return <span className="rest-timer">休息: {formatRest(elapsed)}</span>;
}
