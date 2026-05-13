import { useState, useEffect, useRef, useCallback } from 'react';
import type { ExerciseConfig } from '../types';
import SetProgress from './SetProgress';

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
  setLogs: { exercise_config_id: number; completed_at: string }[];
  lastCheckInTime: string | null;
  onCheckIn: (configId: number, weight: number, setNumber: number) => void;
  onWeightChange: (configId: number, newWeight: number) => void;
  isToday: boolean;
}

const SPARK_COLORS = ['#FF6B35', '#FFD700', '#FF4500', '#FFA500', '#FFE55C', '#FF4136', '#F012BE'];

export default function ExerciseTracker({
  sessionId, exercises, setLogs, lastCheckInTime, onCheckIn, onWeightChange, isToday,
}: Props) {
  const [weights, setWeights] = useState<Record<number, number>>({});
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const sparkIdRef = useRef(0);

  useEffect(() => {
    const w: Record<number, number> = {};
    exercises.forEach((ex) => { w[ex.id] = ex.default_weight; });
    setWeights(w);
  }, [exercises]);

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
    // 抖动主内容区
    const main = document.querySelector('.main-content');
    if (main) {
      main.classList.remove('shake-it');
      void (main as HTMLElement).offsetWidth;
      main.classList.add('shake-it');
      setTimeout(() => main.classList.remove('shake-it'), 500);
    }

    // 火星粒子
    const newSparks: Spark[] = [];
    for (let i = 0; i < 18; i++) {
      const angle = (Math.PI * 2 * i) / 18 + (Math.random() - 0.5) * 0.4;
      const distance = 100 + Math.random() * 160;
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
    }, 750);
  }

  function handleCheckInClick(configId: number, weight: number, setNumber: number, e: React.MouseEvent) {
    triggerEffects(e.clientX, e.clientY);
    onCheckIn(configId, weight, setNumber);
  }

  return (
    <div>
      {exercises.length === 0 ? (
        <div className="page-placeholder">
          该天还没有训练计划，请先去「我的」页面配置
        </div>
      ) : (
        exercises.map((ex) => {
          const completed = getCompletedSets(ex.id);
          const allDone = completed >= ex.target_sets;
          return (
            <div key={ex.id} className="exercise-card" style={allDone ? { opacity: 0.7 } : undefined}>
              <div style={{ display: 'flex', gap: 16 }}>
                {/* 缩略图 */}
                {ex.image_data && (
                  <div className="exercise-thumb"
                    onClick={() => setEnlargedImage(ex.image_data)}
                    style={{ cursor: 'pointer' }}
                  >
                    <img src={ex.image_data} alt={ex.exercise_name} />
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div className="exercise-header">
                    <div>
                      <span className="exercise-name">{ex.exercise_name}</span>
                      {allDone && (
                        <span style={{ marginLeft: 8, color: 'var(--success)', fontSize: 13, fontWeight: 600 }}>
                          ✓ 完成
                        </span>
                      )}
                    </div>
                    <span className="exercise-muscle">{ex.muscle_group}</span>
                  </div>
                  <div className="exercise-meta">
                    <span>目标: {ex.target_sets} 组 × {ex.target_reps} 次</span>
                    {isToday && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        重量:
                        <button className="btn btn-outline btn-sm"
                          style={{ padding: '2px 8px', fontSize: 12, minWidth: 24 }}
                          onClick={() => adjustWeight(ex.id, -0.5)}
                        >−</button>
                        <span style={{ fontWeight: 600, minWidth: 40, textAlign: 'center' }}>
                          {weights[ex.id] ?? ex.default_weight} kg
                        </span>
                        <button className="btn btn-outline btn-sm"
                          style={{ padding: '2px 8px', fontSize: 12, minWidth: 24 }}
                          onClick={() => adjustWeight(ex.id, 0.5)}
                        >+</button>
                      </span>
                    )}
                    {!isToday && (
                      <span>历史重量: {ex.default_weight} kg</span>
                    )}
                  </div>
                  <div className="exercise-actions">
                    <SetProgress completed={completed} total={ex.target_sets} />
                    {isToday && !allDone && (
                      <button className="btn btn-primary btn-sm"
                        onClick={(e) => handleCheckInClick(ex.id, weights[ex.id] ?? ex.default_weight, completed + 1, e)}
                      >
                        完成一组
                      </button>
                    )}
                  </div>
                  {setLogs.filter((sl) => sl.exercise_config_id === ex.id).length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                      {(() => {
                        const exerciseLogs = setLogs
                          .filter((sl) => sl.exercise_config_id === ex.id)
                          .sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime());
                        return exerciseLogs.map((log, i) => {
                          const time = new Date(log.completed_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                          let interval = '';
                          if (i > 0) {
                            const prev = new Date(exerciseLogs[i - 1].completed_at);
                            const curr = new Date(log.completed_at);
                            const diff = Math.floor((curr.getTime() - prev.getTime()) / 1000);
                            const m2 = Math.floor(diff / 60);
                            const s2 = diff % 60;
                            interval = m2 > 0 ? ` (+${m2}m${s2}s)` : ` (+${s2}s)`;
                          }
                          return (
                            <div key={i}>
                              第{i + 1}组: {time}{interval}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* 图片放大弹窗 */}
      {enlargedImage && (
        <div className="image-overlay" onClick={() => setEnlargedImage(null)}>
          <img src={enlargedImage} alt="放大查看" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* 火星粒子 */}
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
