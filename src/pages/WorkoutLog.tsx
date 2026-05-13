import { useState, useEffect, useCallback } from 'react';
import type { ExerciseConfig, WorkoutSession, SetLog } from '../types';
import * as api from '../db/api';
import WeekNavigator from '../components/WeekNavigator';
import DayCards from '../components/DayCards';
import CalendarPicker from '../components/CalendarPicker';
import ExerciseTracker from '../components/ExerciseTracker';
import RestTimer from '../components/RestTimer';
import Fireworks from '../components/Fireworks';

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function diffSeconds(start: string, end: string): number {
  return Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000);
}

export default function WorkoutLog() {
  const today = formatDate(new Date());
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [selectedDate, setSelectedDate] = useState(today);
  const [showCalendar, setShowCalendar] = useState(false);

  const [exercises, setExercises] = useState<ExerciseConfig[]>([]);
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [setLogs, setSetLogs] = useState<(SetLog & { exercise_name: string; muscle_group: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFireworks, setShowFireworks] = useState(false);

  const isToday = selectedDate === today;
  const isFutureDate = selectedDate > today;
  const isPastEmpty = selectedDate < today && setLogs.length === 0 && !loading;
  const isFutureEmpty = isFutureDate && !loading;

  const hasTrainingStarted = !!session?.training_started_at;
  const hasTrainingEnded = !!session?.training_ended_at;

  // 只有必练动作完成才算计划完成
  const requiredExercises = exercises.filter((ex) => ex.is_required);
  const allCompleted = isToday && requiredExercises.length > 0 && requiredExercises.every((ex) => {
    const completed = setLogs.filter((sl) => sl.exercise_config_id === ex.id).length;
    return completed >= ex.target_sets;
  });

  // 最后一组打卡的时间（用于计算计划用时和休息计时）
  const lastSetTime = setLogs.length > 0
    ? setLogs.reduce((latest, log) =>
        log.completed_at > latest ? log.completed_at : latest, setLogs[0].completed_at)
    : null;

  // 休息计时逻辑
  const showRestTimer = hasTrainingStarted && !allCompleted && !hasTrainingEnded;
  const lastCheckInTime = showRestTimer ? lastSetTime : null;

  const loadDay = useCallback(async (date: string) => {
    setLoading(true);
    const dayOfWeek = new Date(date).getDay();
    const dow = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const [configs, sess] = await Promise.all([
      api.getConfigsByDay(dow),
      api.getOrCreateSession(date),
    ]);

    setExercises(configs);
    setSession(sess);

    if (sess) {
      const logs = await api.getSetLogs(sess.id);
      setSetLogs(logs);
    } else {
      setSetLogs([]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadDay(selectedDate);
  }, [selectedDate, loadDay]);

  // 必练动作完成时自动标记 session 完成
  useEffect(() => {
    if (!session || exercises.length === 0) return;
    const required = exercises.filter((ex) => ex.is_required);
    if (required.length === 0) return;
    const allDone = required.every((ex) => {
      const completed = setLogs.filter((sl) => sl.exercise_config_id === ex.id).length;
      return completed >= ex.target_sets;
    });
    if (allDone && !session.completed_at) {
      api.completeSession(session.id);
      setSession({ ...session, completed_at: new Date().toISOString() });
      setShowFireworks(true);
    }
  }, [setLogs, exercises, session]);

  async function handleStartTraining() {
    if (!session) return;
    const updated = await api.startTraining(session.id);
    setSession(updated);
  }

  async function handleEndTraining() {
    if (!session) return;
    const updated = await api.endTraining(session.id);
    setSession(updated);
    setShowFireworks(true);
  }

  async function handleReset() {
    if (!session) return;
    if (!confirm('确定要重置今天的训练记录吗？所有打卡数据将被清除。')) return;
    await api.resetSession(session.id);
    setSession(null);
    setSetLogs([]);
    loadDay(selectedDate);
  }

  async function handleCheckIn(configId: number, weight: number, setNumber: number) {
    if (!session) return;
    await api.addSetLog(session.id, configId, setNumber, weight, exercises.find(e => e.id === configId)?.target_reps ?? 0);
    const logs = await api.getSetLogs(session.id);
    setSetLogs(logs);
  }

  async function handleWeightChange(configId: number, newWeight: number) {
    await api.updateWeight(configId, newWeight);
  }

  function handlePrevWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  }

  function handleNextWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  }

  function handleCalendarSelect(date: string) {
    setWeekStart(getMonday(new Date(date)));
    setSelectedDate(date);
  }

  // ========== 时间统计 ==========
  const planDuration = (session?.training_started_at && lastSetTime)
    ? diffSeconds(session.training_started_at, lastSetTime)
    : 0;

  const totalDuration = (session?.training_started_at && session?.training_ended_at)
    ? diffSeconds(session.training_started_at, session.training_ended_at)
    : 0;

  const extraDuration = totalDuration > planDuration ? totalDuration - planDuration : 0;

  return (
    <div className="page">
      <h1 className="page-title">健身记录</h1>

      <WeekNavigator
        weekStart={weekStart}
        onPrev={handlePrevWeek}
        onNext={handleNextWeek}
        onCalendarClick={() => setShowCalendar(true)}
      />

      <DayCards
        weekStart={weekStart}
        selectedDate={selectedDate}
        onSelect={setSelectedDate}
      />

      {/* 过去未训练 — 空状态 */}
      {isPastEmpty && (
        <div className="empty-state">
          <span className="empty-state-text">没有训练</span>
        </div>
      )}

      {/* 未来日期 — 空状态 */}
      {isFutureEmpty && (
        <div className="empty-state">
          <span className="empty-state-text future">等待你变强</span>
        </div>
      )}

      {/* 开始/结束训练 控制栏 */}
      {isToday && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16,
          padding: 16, background: 'var(--white)', borderRadius: 10,
          border: '1px solid var(--border)', flexWrap: 'wrap',
        }}>
          {/* 开始训练 */}
          {!hasTrainingStarted && !hasTrainingEnded && (
            <button className="btn btn-primary" onClick={handleStartTraining}>
              开始训练
            </button>
          )}

          {/* 已开始 */}
          {(hasTrainingStarted || hasTrainingEnded) && session?.training_started_at && (
            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              开始时间: <strong style={{ color: 'var(--text)' }}>{formatTime(session.training_started_at)}</strong>
            </span>
          )}

          {/* 计划完成 — 显示计划用时 */}
          {allCompleted && planDuration > 0 && (
            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              计划用时: <strong style={{ color: 'var(--success)' }}>{formatDuration(planDuration)}</strong>
            </span>
          )}

          {/* 结束训练按钮 — 计划完成后才显示 */}
          {allCompleted && !hasTrainingEnded && (
            <button className="btn btn-primary" onClick={handleEndTraining}>
              结束训练
            </button>
          )}

          {/* 额外用时 */}
          {hasTrainingEnded && extraDuration > 0 && (
            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              额外用时: <strong>{formatDuration(extraDuration)}</strong>
            </span>
          )}

          {/* 总用时 */}
          {hasTrainingEnded && totalDuration > 0 && (
            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              总用时: <strong style={{ color: 'var(--primary-dark)', fontSize: 16 }}>
                {formatDuration(totalDuration)}
              </strong>
            </span>
          )}

          {/* 重置 */}
          <button
            onClick={handleReset}
            style={{
              marginLeft: 'auto', background: 'var(--white)', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', cursor: 'pointer',
              fontSize: 11, padding: '2px 8px', borderRadius: 4, fontFamily: 'inherit',
            }}
          >重置</button>
        </div>
      )}

      {/* 正常训练内容（非空状态时显示） */}
      {!(isPastEmpty || isFutureEmpty) && (
        <>
          <div style={{ marginBottom: 16 }}>
            <RestTimer lastCheckInTime={lastCheckInTime} isComplete={allCompleted || hasTrainingEnded} />
          </div>

          {loading ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 40 }}>加载中...</p>
          ) : (
            <ExerciseTracker
              sessionId={session?.id ?? 0}
              exercises={exercises}
              setLogs={setLogs}
              lastCheckInTime={lastCheckInTime}
              onCheckIn={handleCheckIn}
              onWeightChange={handleWeightChange}
              isToday={isToday && !hasTrainingEnded}
            />
          )}
        </>
      )}

      {showCalendar && (
        <CalendarPicker
          selectedDate={selectedDate}
          onSelect={handleCalendarSelect}
          onClose={() => setShowCalendar(false)}
        />
      )}

      {showFireworks && (
        <Fireworks onDone={() => setShowFireworks(false)} />
      )}
    </div>
  );
}
