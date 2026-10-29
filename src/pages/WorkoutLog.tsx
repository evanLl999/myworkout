import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { ExerciseConfig, WorkoutSession, SetLogWithMeta } from '../types';
import * as api from '../db/api';
import WeekNavigator from '../components/WeekNavigator';
import DayCards from '../components/DayCards';
import CalendarPicker from '../components/CalendarPicker';
import ExerciseTracker from '../components/ExerciseTracker';
import RestTimer from '../components/RestTimer';
import Fireworks from '../components/Fireworks';
import SessionHero from '../components/SessionHero';
import PlanPicker from '../components/PlanPicker';
import { CalendarIcon, DumbbellIcon, SparkleIcon, SwapIcon } from '../components/Icons';
import {
  diffSeconds,
  formatDate,
  formatDuration,
  formatTime,
  getMonday,
  monthDayCN,
  parseDate,
  parseTimestamp,
  weekdayCN,
} from '../utils/date';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : '操作失败，请稍后重试';
}

const PLAN_DAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export default function WorkoutLog() {
  const today = formatDate(new Date());
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [selectedDate, setSelectedDate] = useState(today);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showPlanPicker, setShowPlanPicker] = useState(false);
  const [allConfigs, setAllConfigs] = useState<ExerciseConfig[]>([]);

  const [exercises, setExercises] = useState<ExerciseConfig[]>([]);
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [setLogs, setSetLogs] = useState<SetLogWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFireworks, setShowFireworks] = useState(false);
  const [error, setError] = useState('');
  const loadSeq = useRef(0);

  const isToday = selectedDate === today;
  const isFutureDate = selectedDate > today;
  const calendarDay = (parseDate(selectedDate).getDay() + 6) % 7;
  const effectivePlanDay = session?.plan_day_of_week ?? calendarDay;
  const isMakeup = effectivePlanDay !== calendarDay;
  const activeExercises = exercises.filter((ex) => !ex.is_archived);
  const isPastEmpty = selectedDate < today && setLogs.length === 0 && !loading;
  const isFutureEmpty = isFutureDate && !loading;
  const isTodayEmpty = isToday && activeExercises.length === 0 && setLogs.length === 0 && !loading;

  const hasTrainingStarted = !!session?.training_started_at;
  const hasTrainingEnded = !!session?.training_ended_at;
  const live = isToday && hasTrainingStarted && !hasTrainingEnded;

  const requiredExercises = activeExercises.filter((ex) => ex.is_required);
  const completedSets = setLogs.length;
  const plannedSets = activeExercises.reduce((sum, ex) => sum + ex.target_sets, 0);
  const allCompleted = isToday && requiredExercises.length > 0 && requiredExercises.every((ex) => {
    const completed = setLogs.filter((sl) => sl.exercise_config_id === ex.id).length;
    return completed >= ex.target_sets;
  });

  const lastSetTime = setLogs.length > 0
    ? setLogs.reduce((latest, log) =>
        parseTimestamp(log.completed_at) > parseTimestamp(latest) ? log.completed_at : latest,
        setLogs[0].completed_at)
    : null;

  const lastCheckInTime = live ? lastSetTime : null;

  const loadDay = useCallback(async (date: string) => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setError('');
    const calendarDayForDate = (parseDate(date).getDay() + 6) % 7;

    try {
      const existingSession = await api.getSessionByDate(date);
      if (seq !== loadSeq.current) return;

      const sess = existingSession || (date === formatDate(new Date()) ? await api.getOrCreateSession(date) : null);
      if (seq !== loadSeq.current) return;

      const planDay = sess?.plan_day_of_week ?? calendarDayForDate;
      const configs = await api.getConfigsByDay(planDay, true);
      if (seq !== loadSeq.current) return;

      const logs = sess ? await api.getSetLogs(sess.id) : [];
      if (seq !== loadSeq.current) return;

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

  async function openPlanPicker() {
    if (!session) {
      setError('当天训练还没有准备好，请刷新后再试');
      return;
    }
    if (hasTrainingStarted || setLogs.length > 0) {
      alert('已经开始训练或已有打卡，请先重置当天记录再换计划。');
      return;
    }
    try {
      setAllConfigs(await api.getAllConfigs());
      setShowPlanPicker(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleSelectPlanDay(planDay: number | null) {
    if (!session) return;
    if (hasTrainingStarted || setLogs.length > 0) {
      setShowPlanPicker(false);
      alert('已经开始训练或已有打卡，请先重置当天记录再换计划。');
      return;
    }
    try {
      const updated = await api.setSessionPlanDay(session.id, planDay);
      setSession(updated);
      setShowPlanPicker(false);
      await loadDay(selectedDate);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const planDuration = (session?.training_started_at && lastSetTime)
    ? diffSeconds(session.training_started_at, lastSetTime)
    : 0;
  const totalDuration = (session?.training_started_at && session?.training_ended_at)
    ? diffSeconds(session.training_started_at, session.training_ended_at)
    : 0;
  const extraDuration = totalDuration > planDuration ? totalDuration - planDuration : 0;
  const showContent = !(isPastEmpty || isFutureEmpty || isTodayEmpty);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="eyebrow">TRAINING LOG</span>
          <h1 className="page-title">健身记录</h1>
        </div>
        <div className="page-head-side">
          <span className="page-date">{monthDayCN(selectedDate)} · {weekdayCN(selectedDate)}</span>
          <div className="page-head-actions">
            {isMakeup && (
              <span className="makeup-chip">补练 {PLAN_DAY_NAMES[effectivePlanDay]}</span>
            )}
            {isToday && !hasTrainingStarted && (
              <button
                type="button"
                className="plan-switch-btn"
                onClick={openPlanPicker}
                disabled={!session}
              >
                <SwapIcon />
                {isMakeup ? '换计划' : '补练'}
              </button>
            )}
          </div>
        </div>
      </header>

      <section className="week-card">
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
      </section>

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')}>关闭</button>
        </div>
      )}

      {isPastEmpty && (
        <div className="empty-state-card">
          <span className="empty-icon"><CalendarIcon /></span>
          <span className="eyebrow">NO SESSION</span>
          <h2 className="empty-title">这天没有留下记录</h2>
          <p className="empty-copy">下次练完记得点“完成一组”。</p>
        </div>
      )}

      {isFutureEmpty && (
        <div className="empty-state-card">
          <span className="empty-icon"><SparkleIcon /></span>
          <span className="eyebrow">COMING UP</span>
          <h2 className="empty-title">未来还没有发生</h2>
          <p className="empty-copy">先把今天的训练完成吧。</p>
        </div>
      )}

      {isTodayEmpty && (
        <div className="empty-state-card">
          <span className="empty-icon"><DumbbellIcon /></span>
          <span className="eyebrow">REST DAY</span>
          <h2 className="empty-title">今天还没有安排</h2>
          <p className="empty-copy">可以补练本周其他训练日，或者去计划页添加动作。</p>
          <div className="empty-actions">
            <button type="button" className="btn btn-primary" onClick={openPlanPicker}>
              补练其他日
            </button>
            <Link className="btn btn-outline" to="/profile">去安排计划</Link>
          </div>
        </div>
      )}

      {isToday && !isTodayEmpty && activeExercises.length > 0 && (
        <SessionHero
          session={session}
          allCompleted={allCompleted}
          exerciseCount={activeExercises.length}
          plannedSets={plannedSets}
          completedSets={completedSets}
          planDuration={planDuration}
          totalDuration={totalDuration}
          extraDuration={extraDuration}
          onStart={handleStartTraining}
          onEnd={handleEndTraining}
          onReset={handleReset}
        />
      )}

      {!isToday && session?.training_started_at && !isPastEmpty && (
        <section className="history-card">
          <div className="history-card-head">
            <span className="eyebrow">HISTORY</span>
            <span className="history-date">{monthDayCN(selectedDate)}</span>
          </div>
          <div className="session-stats">
            <div>
              <span className="stat-value">{formatTime(session.training_started_at)}</span>
              <span className="stat-label">开始</span>
            </div>
            {session.training_ended_at && (
              <div>
                <span className="stat-value">{formatTime(session.training_ended_at)}</span>
                <span className="stat-label">结束</span>
              </div>
            )}
            {totalDuration > 0 && (
              <div>
                <span className="stat-value">{formatDuration(totalDuration)}</span>
                <span className="stat-label">总用时</span>
              </div>
            )}
          </div>
        </section>
      )}

      {live && lastCheckInTime && (
        <div className="rest-strip">
          <RestTimer lastCheckInTime={lastCheckInTime} isComplete={allCompleted} />
        </div>
      )}

      {showContent && (
        loading ? (
          <div className="skeleton-list" aria-label="加载中">
            <div className="skeleton-card" />
            <div className="skeleton-card" />
          </div>
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
        )
      )}

      {showCalendar && (
        <CalendarPicker
          selectedDate={selectedDate}
          onSelect={handleCalendarSelect}
          onClose={() => setShowCalendar(false)}
        />
      )}

      {showPlanPicker && session && (
        <PlanPicker
          calendarDay={calendarDay}
          selectedDay={effectivePlanDay}
          configs={allConfigs}
          onSelect={handleSelectPlanDay}
          onClose={() => setShowPlanPicker(false)}
        />
      )}

      {showFireworks && (
        <Fireworks onDone={() => setShowFireworks(false)} />
      )}
    </div>
  );
}
