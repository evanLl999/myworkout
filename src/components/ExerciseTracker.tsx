import { useState, useEffect, useRef } from 'react';
import type { ExerciseConfig, SetLogWithMeta } from '../types';
import SetProgress from './SetProgress';
import {
  ArrowRightIcon,
  CheckIcon,
  MinusIcon,
  PlusIcon,
} from './Icons';
import { formatTimeWithSeconds, parseTimestamp } from '../utils/date';

interface Spark {
  id: number;
  x: number;
  y: number;
  color: string;
  sx: number;
  sy: number;
}

interface Props {
  sessionId: number;
  exercises: ExerciseConfig[];
  setLogs: SetLogWithMeta[];
  lastCheckInTime: string | null;
  onCheckIn: (configId: number, weight: number, setNumber: number) => void;
  onWeightChange: (configId: number, newWeight: number) => void;
  isToday: boolean;
  readOnly?: boolean;
}

const SPARK_COLORS = ['#FF6B3D', '#FFB020', '#FFE0D3', '#1E7A55', '#FFF3E8'];

function formatInterval(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m${s}s` : `${s}s`;
}

export default function ExerciseTracker({
  sessionId,
  exercises,
  setLogs,
  lastCheckInTime,
  onCheckIn,
  onWeightChange,
  isToday,
  readOnly = false,
}: Props) {
  const [weights, setWeights] = useState<Record<number, number>>({});
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const sparkIdRef = useRef(0);
  const exerciseRefs = useRef<Record<number, HTMLElement | null>>({});
  const lastSetCount = useRef(setLogs.length);
  const prevSessionId = useRef(sessionId);

  const currentExerciseId = isToday && !readOnly
    ? exercises.find((ex) => !ex.is_archived && ex.is_required && getCompletedSets(ex.id) < ex.target_sets)?.id ?? null
    : null;

  useEffect(() => {
    const w: Record<number, number> = {};
    exercises.forEach((ex) => { w[ex.id] = ex.default_weight; });
    setWeights(w);
  }, [exercises]);

  // 只在同一次训练中打卡后自动定位，切换日期时不要跳走
  useEffect(() => {
    if (prevSessionId.current !== sessionId) {
      prevSessionId.current = sessionId;
      lastSetCount.current = setLogs.length;
      return;
    }
    if (currentExerciseId == null) return;
    if (setLogs.length === lastSetCount.current) return;
    lastSetCount.current = setLogs.length;
    const el = exerciseRefs.current[currentExerciseId];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentExerciseId, setLogs.length, sessionId]);

  function getCompletedSets(configId: number): number {
    return setLogs.filter((sl) => sl.exercise_config_id === configId).length;
  }

  function adjustWeight(configId: number, delta: number) {
    const current = weights[configId] ?? 0;
    const newWeight = Math.max(0, parseFloat((current + delta).toFixed(1)));
    setWeights((prev) => ({ ...prev, [configId]: newWeight }));
    onWeightChange(configId, newWeight);
  }

  function triggerEffects(clientX: number, clientY: number) {
    const newSparks: Spark[] = [];
    for (let i = 0; i < 14; i++) {
      const angle = (Math.PI * 2 * i) / 14 + (Math.random() - 0.5) * 0.5;
      const distance = 70 + Math.random() * 130;
      newSparks.push({
        id: ++sparkIdRef.current,
        x: clientX,
        y: clientY,
        color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
        sx: Math.cos(angle) * distance,
        sy: Math.sin(angle) * distance,
      });
    }
    setSparks((prev) => [...prev, ...newSparks]);
    setTimeout(() => {
      setSparks((prev) => prev.filter((s) => !newSparks.find((ns) => ns.id === s.id)));
    }, 700);
  }

  function handleCheckInClick(configId: number, weight: number, setNumber: number, e: React.MouseEvent) {
    triggerEffects(e.clientX, e.clientY);
    onCheckIn(configId, weight, setNumber);
  }

  return (
    <div className="exercise-list">
      {exercises.length === 0 ? (
        <div className="page-placeholder">
          该天还没有训练计划，请先去「我的计划」页面配置
        </div>
      ) : (
        exercises.map((ex) => {
          const completed = getCompletedSets(ex.id);
          const allDone = completed >= ex.target_sets;
          const isCurrent = ex.id === currentExerciseId;
          const canEdit = isToday && !readOnly && !ex.is_archived;
          const isUnfinished = canEdit && ex.is_required && !allDone && !isCurrent;
          const weight = weights[ex.id] ?? ex.default_weight;
          const cardClass = [
            'exercise-card',
            isCurrent ? 'is-current' : '',
            isUnfinished ? 'is-unfinished' : '',
            ex.is_archived ? 'is-archived' : '',
            allDone ? 'is-done' : '',
          ].filter(Boolean).join(' ');
          const exerciseLogs = setLogs
            .filter((sl) => sl.exercise_config_id === ex.id)
            .sort((a, b) => parseTimestamp(a.completed_at).getTime() - parseTimestamp(b.completed_at).getTime());

          return (
            <article
              key={ex.id}
              ref={(el) => { exerciseRefs.current[ex.id] = el; }}
              className={cardClass}
            >
              <div className="exercise-card-top">
                {ex.image_data && (
                  <button
                    type="button"
                    className="exercise-thumb"
                    onClick={() => setEnlargedImage(ex.image_data)}
                    aria-label={`查看${ex.exercise_name}参考图`}
                  >
                    <img src={ex.image_data} alt={ex.exercise_name} />
                  </button>
                )}
                <div className="exercise-heading">
                  <div className="exercise-kicker">
                    <span>{ex.muscle_group}</span>
                    <span className="kicker-sep">·</span>
                    <span>{ex.is_required ? '必练' : '选练'}</span>
                    {!!ex.is_archived && <span className="tag-archived">已删除</span>}
                  </div>
                  <h3 className="exercise-name">{ex.exercise_name}</h3>
                </div>
                {allDone && <span className="card-done"><CheckIcon /></span>}
              </div>

              <div className="exercise-specs">
                <div className="spec">
                  <span className="spec-value">{ex.target_sets}</span>
                  <span className="spec-label">组</span>
                </div>
                <div className="spec">
                  <span className="spec-value">{ex.target_reps}</span>
                  <span className="spec-label">次</span>
                </div>
                <div className="spec">
                  <span className="spec-value">{weight}</span>
                  <span className="spec-label">kg</span>
                </div>
              </div>

              <div className="exercise-progress">
                <SetProgress completed={completed} total={ex.target_sets} />
                <span className="progress-count">{completed}/{ex.target_sets}</span>
              </div>

              <div className="exercise-controls">
                {canEdit ? (
                  <div className="stepper">
                    <button type="button" onClick={() => adjustWeight(ex.id, -0.5)} aria-label="减少重量">
                      <MinusIcon />
                    </button>
                    <span className="stepper-value">{weight}<small>kg</small></span>
                    <button type="button" onClick={() => adjustWeight(ex.id, 0.5)} aria-label="增加重量">
                      <PlusIcon />
                    </button>
                  </div>
                ) : (
                  <span className="readonly-weight">重量 <strong>{weight}</strong> kg</span>
                )}
                {canEdit && !allDone && (
                  <button
                    type="button"
                    className="btn-checkin"
                    onClick={(e) => handleCheckInClick(ex.id, weight, completed + 1, e)}
                  >
                    完成第 {completed + 1} 组
                    <ArrowRightIcon />
                  </button>
                )}
                {allDone && <span className="complete-label">已完成</span>}
              </div>

              {exerciseLogs.length > 0 && (
                <div className="set-timeline">
                  {exerciseLogs.map((log, index) => {
                    const prev = index > 0 ? exerciseLogs[index - 1] : null;
                    const interval = prev
                      ? Math.max(0, Math.floor(
                          (parseTimestamp(log.completed_at).getTime() - parseTimestamp(prev.completed_at).getTime()) / 1000
                        ))
                      : null;
                    return (
                      <div className="set-row" key={log.id}>
                        <span className="set-dot" />
                        <span className="set-index">第{log.set_number}组</span>
                        <span className="set-time">{formatTimeWithSeconds(log.completed_at)}</span>
                        {interval !== null && <span className="set-interval">+{formatInterval(interval)}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          );
        })
      )}

      {enlargedImage && (
        <div className="image-overlay" onClick={() => setEnlargedImage(null)}>
          <img src={enlargedImage} alt="放大查看" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {sparks.length > 0 && (
        <div className="spark-container">
          {sparks.map((s) => (
            <div
              key={s.id}
              className="spark-particle"
              style={{
                left: s.x,
                top: s.y,
                background: s.color,
                '--sx': `${s.sx}px`,
                '--sy': `${s.sy}px`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}
    </div>
  );
}
