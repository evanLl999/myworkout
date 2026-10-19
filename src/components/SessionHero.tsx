import { useEffect, useState } from 'react';
import type { WorkoutSession } from '../types';
import { formatClock, formatDuration, parseTimestamp } from '../utils/date';
import { CheckIcon, PlayIcon } from './Icons';

interface Props {
  session: WorkoutSession | null;
  allCompleted: boolean;
  exerciseCount: number;
  plannedSets: number;
  completedSets: number;
  planDuration: number;
  totalDuration: number;
  extraDuration: number;
  onStart: () => void;
  onEnd: () => void;
  onReset: () => void;
}

export default function SessionHero({
  session,
  allCompleted,
  exerciseCount,
  plannedSets,
  completedSets,
  planDuration,
  totalDuration,
  extraDuration,
  onStart,
  onEnd,
  onReset,
}: Props) {
  const [now, setNow] = useState(() => Date.now());
  const started = !!session?.training_started_at;
  const ended = !!session?.training_ended_at;
  const live = started && !ended;

  useEffect(() => {
    if (!live || !session?.training_started_at) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [live, session?.training_started_at]);

  const elapsed = live && session?.training_started_at
    ? Math.max(0, (now - parseTimestamp(session.training_started_at).getTime()) / 1000)
    : totalDuration;
  const progress = plannedSets > 0 ? Math.min(100, Math.round((completedSets / plannedSets) * 100)) : 0;

  return (
    <section className={`session-hero ${live ? 'is-live' : ''} ${ended ? 'is-ended' : ''} ${allCompleted ? 'is-complete' : ''}`}>
      <div className="session-hero-top">
        <div>
          <span className="eyebrow">
            {ended ? 'SESSION COMPLETE' : live ? (allCompleted ? 'PLAN COMPLETE' : 'IN PROGRESS') : 'TODAY'}
          </span>
          <h2 className="session-title">
            {ended ? '训练完成' : live ? (allCompleted ? '今天的计划完成了' : '训练进行中') : '准备好开始了吗'}
          </h2>
        </div>
        {live && !allCompleted && (
          <span className="live-badge"><span className="live-dot" />LIVE</span>
        )}
        {(ended || allCompleted) && (
          <span className="done-badge"><CheckIcon />DONE</span>
        )}
      </div>

      {!started && !ended && (
        <>
          <p className="session-copy">
            今天有 <strong>{exerciseCount}</strong> 个动作，共 <strong>{plannedSets}</strong> 组。
            开始后会自动记录每一组。
          </p>
          <button type="button" className="btn btn-primary btn-block" onClick={onStart}>
            <PlayIcon className="btn-icon" />
            开始训练
          </button>
        </>
      )}

      {live && (
        <>
          <div className="session-clock">{formatClock(elapsed)}</div>
          <div className="session-progress">
            <div className="session-progress-head">
              <span>{completedSets} / {plannedSets} 组</span>
              <span>{progress}%</span>
            </div>
            <div className="progress-track">
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>
          {allCompleted && planDuration > 0 && (
            <p className="session-copy">计划用时 <strong>{formatDuration(planDuration)}</strong>，可以结束训练了。</p>
          )}
          <div className="session-actions">
            <button type="button" className={`btn ${allCompleted ? 'btn-primary' : 'btn-ghost'}`} onClick={onEnd}>
              {allCompleted ? '结束训练' : '提前结束'}
            </button>
            <button type="button" className="text-btn" onClick={onReset}>重置</button>
          </div>
        </>
      )}

      {ended && (
        <>
          <div className="session-stats">
            <div>
              <span className="stat-value">{totalDuration > 0 ? formatDuration(totalDuration) : '—'}</span>
              <span className="stat-label">总用时</span>
            </div>
            <div>
              <span className="stat-value">{completedSets}</span>
              <span className="stat-label">完成组数</span>
            </div>
            {extraDuration > 0 && (
              <div>
                <span className="stat-value">+{formatDuration(extraDuration)}</span>
                <span className="stat-label">额外用时</span>
              </div>
            )}
          </div>
          <button type="button" className="text-btn" onClick={onReset}>重置这次记录</button>
        </>
      )}
    </section>
  );
}
