import { useState, useEffect, useCallback, useRef } from 'react';
import type { ExerciseConfig, WorkoutSession, SetLogWithMeta } from '../types';
import * as api from '../db/api';
import WeekNavigator from '../components/WeekNavigator';
import DayCards from '../components/DayCards';
import CalendarPicker from '../components/CalendarPicker';
import ExerciseTracker from '../components/ExerciseTracker';
import RestTimer from '../components/RestTimer';
import Fireworks from '../components/Fireworks';
import {
  diffSeconds,
  formatDate,
  formatDuration,
  formatTime,
  getMonday,
  parseDate,
  parseTimestamp,
} from '../utils/date';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : '操作失败，请稍后重试';
}

export default function WorkoutLog() {
  const today = formatDate(new Date());
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [selectedDate, setSelectedDate] = useState(today);
  const [showCalendar, setShowCalendar] = useState(false);

  const [exercises, setExercises] = useState<ExerciseConfig[]>([]);
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [setLogs, setSetLogs] = useState<SetLogWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFireworks, setShowFireworks] = useState(false);
  const [error, setError] = useState('');
  const loadSeq = useRef(0);

  const isToday = selectedDate === today;
  const isFutureDate = selectedDate > today;
  const activeExercises = exercises.filter((ex) => !ex.is_archived);
  const isPastEmpty = selectedDate < today && setLogs.length === 0 && !loading;
  const isFutureEmpty = isFutureDate && !loading;
  const isTodayEmpty = isToday && activeExercises.length === 0 && setLogs.length === 0 && !loading;

  const hasTrainingStarted = !!session?.training_started_at;
  const hasTrainingEnded = !!session?.training_ended_at;

  // 只有当前计划里的必练动作完成才算计划完成，已归档动作不参与
  const requiredExercises = activeExercises.filter((ex) => ex.is_required);
  const allCompleted = isToday && requiredExercises.length > 0 && requiredExercises.every((ex) => {
    const completed = setLogs.filter((sl) => sl.exercise_config_id === ex.id).length;
    return completed >= ex.target_sets;
  });

  const lastSetTime = setLogs.length > 0
    ? setLogs.reduce((latest, log) =>
        parseTimestamp(log.completed_at) > parseTimestamp(latest) ? log.completed_at : latest,
        setLogs[0].completed_at)
    : null;

  const lastCheckInTime = isToday && hasTrainingStarted && !hasTrainingEnded
    ? (lastSetTime || session?.training_started_at || null)
    : null;

  const loadDay = useCallback(async (date: string) => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setError('');
    const dow = parseDate(date).getDay();
    const dayOfWeek = dow === 0 ? 6 : dow - 1;

    try {
      const [configs, existingSession] = await Promise.all([
        api.getConfigsByDay(dayOfWeek, true),
        api.getSessionByDate(date),
      ]);
      if (seq !== loadSeq.current) return;

      const sess = existingSession || (date === formatDate(new Date()) ? await api.getOrCreateSession(date) : null);
      if (seq !== loadSeq.current) return;

      const logs = sess ? await api.getSetLogs(sess.id) : [];
      if (seq !== loadSeq.current) return;

      // 显示当前动作；已归档动作只在当天有打卡记录时显示，避免丢掉历史
      const visibleExercises = configs.filter(
        (config) => !config.is_archived || logs.some((log) => log.exercise_config_id === config.id)
      );

      setExercises(visibleExercises);
      setSession(sess);
      setSetLogs(logs);
    } catch (err) {
      if (seq === loadSeq.current) setError(errorMessage(err));
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDay(selectedDate);
  }, [selectedDate, loadDay]);

  // 必练动作完成时自动标记 session 完成（只处理今天）
  useEffect(() => {
    if (!isToday || !session || activeExercises.length === 0) return;
    const required = activeExercises.filter((ex) => ex.is_required);
    if (required.length === 0) return;
    const allDone = required.every((ex) => {
      const completed = setLogs.filter((sl) => sl.exercise_config_id === ex.id).length;
      return completed >= ex.target_sets;
    });
    if (allDone && !session.completed_at) {
      api.completeSession(session.id).catch((err) => setError(errorMessage(err)));
      setSession({ ...session, completed_at: new Date().toISOString() });
      setShowFireworks(true);
    }
  }, [setLogs, exercises, session, isToday]);

  async function handleStartTraining() {
    if (!session) return;
    try {
      const updated = await api.startTraining(session.id);
      setSession(updated);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleEndTraining() {
    if (!session) return;
    if (!allCompleted && !confirm('还有未完成的动作，确定结束本次训练吗？')) return;
    try {
      const updated = await api.endTraining(session.id);
      setSession(updated);
      if (allCompleted) setShowFireworks(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleReset() {
    if (!session) return;
    if (!confirm('确定要重置今天的训练记录吗？所有打卡数据将被清除。')) return;
    try {
      await api.resetSession(session.id);
      await loadDay(selectedDate);
      setShowFireworks(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleCheckIn(configId: number, weight: number, setNumber: number) {
    if (!session) return;
    const exercise = exercises.find((ex) => ex.id === configId);
    if (!exercise) return;
    try {
      let activeSession = session;
      // 直接点“完成一组”时自动开始训练，避免出现没有开始时间的记录
      if (!activeSession.training_started_at) {
        const started = await api.startTraining(activeSession.id);
        if (started) {
          activeSession = started;
          setSession(started);
        }
      }
      await api.addSetLog(
        activeSession.id,
        configId,
        setNumber,
        weight,
        exercise.target_reps,
        exercise.exercise_name,
        exercise.muscle_group
      );
      const logs = await api.getSetLogs(activeSession.id);
      setSetLogs(logs);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleWeightChange(configId: number, newWeight: number) {
    try {
      await api.updateWeight(configId, newWeight);
      setExercises((prev) =>
        prev.map((ex) => (ex.id === configId ? { ...ex, default_weight: newWeight } : ex))
      );
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function shiftWeek(days: number) {
    const nextWeek = new Date(weekStart);
    nextWeek.setDate(nextWeek.getDate() + days);
    setWeekStart(nextWeek);
    const selected = parseDate(selectedDate);
    const weekEnd = new Date(nextWeek);
    weekEnd.setDate(weekEnd.getDate() + 6);
    if (selected < nextWeek || selected > weekEnd) {
      setSelectedDate(formatDate(nextWeek));
    }
  }

  function handleCalendarSelect(date: string) {
    setWeekStart(getMonday(parseDate(date)));
    setSelectedDate(date);
  }

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
        onPrev={() => shiftWeek(-7)}
        onNext={() => shiftWeek(7)}
        onCalendarClick={() => setShowCalendar(true)}
      />

      <DayCards
        weekStart={weekStart}
        selectedDate={selectedDate}
        onSelect={setSelectedDate}
      />

      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button type="button" onClick={() => setError('')}>关闭</button>
        </div>
      )}

      {/* 过去未训练 — 空状态 */}
      {isPastEmpty && (
        <div className="empty-state">
          <span className="empty-state-text">没有训练吗？</span>
        </div>
      )}

      {/* 未来日期 / 今天无计划 — 空状态 */}
      {(isFutureEmpty || isTodayEmpty) && (
        <div className="empty-state">
          <span className="empty-state-text future">等待你变强</span>
        </div>
      )}

      {/* 开始/结束训练 控制栏 */}
      {isToday && !isTodayEmpty && (
        <div className="training-bar">
          {!hasTrainingStarted && !hasTrainingEnded && (
            <button className="btn btn-primary" onClick={handleStartTraining}>
              开始训练
            </button>
          )}

          {session?.training_started_at && (
            <span className="training-meta">
              开始时间: <strong>{formatTime(session.training_started_at)}</strong>
            </span>
          )}

          {allCompleted && planDuration > 0 && (
            <span className="training-meta">
              计划用时: <strong className="text-success">{formatDuration(planDuration)}</strong>
            </span>
          )}

          {hasTrainingStarted && !hasTrainingEnded && (
            <button className="btn btn-outline" onClick={handleEndTraining}>
              结束训练
            </button>
          )}

          {hasTrainingEnded && extraDuration > 0 && (
            <span className="training-meta">
              额外用时: <strong>{formatDuration(extraDuration)}</strong>
            </span>
          )}

          {hasTrainingEnded && totalDuration > 0 && (
            <span className="training-meta">
              总用时: <strong className="text-primary-strong">{formatDuration(totalDuration)}</strong>
            </span>
          )}

          <button type="button" className="btn-reset" onClick={handleReset}>
            重置
          </button>
        </div>
      )}

      {/* 历史日期的训练摘要 */}
      {!isToday && session?.training_started_at && !isPastEmpty && (
        <div className="training-bar history-summary">
          <span className="training-meta">开始: <strong>{formatTime(session.training_started_at)}</strong></span>
          {session.training_ended_at && (
            <span className="training-meta">结束: <strong>{formatTime(session.training_ended_at)}</strong></span>
          )}
          {totalDuration > 0 && (
            <span className="training-meta">
              总用时: <strong className="text-primary-strong">{formatDuration(totalDuration)}</strong>
            </span>
          )}
        </div>
      )}

      {/* 正常训练内容（非空状态时显示） */}
      {!(isPastEmpty || isFutureEmpty || isTodayEmpty) && (
        <>
          {isToday && hasTrainingStarted && !hasTrainingEnded && (
            <div className="sticky-timer">
              <RestTimer lastCheckInTime={lastCheckInTime} isComplete={allCompleted} />
            </div>
          )}

          {loading ? (
            <p className="loading-text">加载中...</p>
          ) : (
            <ExerciseTracker
              sessionId={session?.id ?? 0}
              exercises={exercises}
              setLogs={setLogs}
              lastCheckInTime={lastCheckInTime}
              onCheckIn={handleCheckIn}
              onWeightChange={handleWeightChange}
              isToday={isToday}
              readOnly={hasTrainingEnded}
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
