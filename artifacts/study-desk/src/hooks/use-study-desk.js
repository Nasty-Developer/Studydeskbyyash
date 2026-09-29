import { useCallback, useEffect, useRef, useState } from 'react';

const STORE = {
  preferences: 'study-desk.preferences.v1',
  tasks: 'study-desk.tasks.v1',
  progress: 'study-desk.progress.v1',
  timer: 'study-desk.timer.v1',
};

const defaultPreferences = {
  durations: { focus: 25, short: 5, long: 15 },
  sound: false,
  atmosphere: 'coffee',
};
const defaultTimer = { mode: 'focus', status: 'idle', endsAt: null, remainingMs: 25 * 60_000, durationMs: 25 * 60_000 };

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {
    // A damaged or unavailable local value should never prevent a fresh desk from opening.
  }
  return fallback;
}

export function localDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function minutesFor(preferences, mode) {
  return preferences.durations[mode] * 60_000;
}

function readPreferences() {
  const loaded = load(STORE.preferences, {});
  const saved = loaded && typeof loaded === 'object' ? loaded : {};
  const candidate = { ...defaultPreferences, ...saved, durations: { ...defaultPreferences.durations, ...(saved.durations ?? {}) } };
  const validAtmosphere = ['coffee', 'rain', 'library', 'night'];
  return {
    ...candidate,
    sound: Boolean(candidate.sound),
    atmosphere: validAtmosphere.includes(candidate.atmosphere) ? candidate.atmosphere : 'coffee',
    durations: {
      focus: Math.min(120, Math.max(1, Number(candidate.durations.focus) || 25)),
      short: Math.min(120, Math.max(1, Number(candidate.durations.short) || 5)),
      long: Math.min(120, Math.max(1, Number(candidate.durations.long) || 15)),
    },
  };
}

function readTimer() {
  const loaded = load(STORE.timer, {});
  const saved = loaded && typeof loaded === 'object' ? loaded : {};
  const mode = saved.mode === 'short' || saved.mode === 'long' ? saved.mode : 'focus';
  const status = saved.status === 'running' || saved.status === 'paused' ? saved.status : 'idle';
  return {
    mode,
    status,
    endsAt: status === 'running' && Number.isFinite(Number(saved.endsAt)) ? Number(saved.endsAt) : null,
    remainingMs: Number.isFinite(Number(saved.remainingMs)) ? Math.max(0, Number(saved.remainingMs)) : defaultTimer.remainingMs,
    durationMs: Math.min(120 * 60_000, Math.max(60_000, Number(saved.durationMs) || minutesFor(readPreferences(), mode))),
  };
}

function playChime() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(660, context.currentTime);
    oscillator.frequency.setValueAtTime(880, context.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.42);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.44);
    oscillator.onended = () => void context.close();
  } catch {
    // Audio is an optional enhancement; unsupported browser/audio policy is a quiet no-op.
  }
}

export function useStudyDesk() {
  const [preferences, setPreferences] = useState(readPreferences);
  const [tasks, setTasks] = useState(() => {
    const saved = load(STORE.tasks, []);
    return Array.isArray(saved) ? saved
      .filter((task) => Boolean(task && typeof task.id === 'string' && typeof task.text === 'string'))
      .map((task) => ({
        ...task,
        done: Boolean(task.done),
        createdAt: Number(task.createdAt) || Date.now(),
        completedAt: Number(task.completedAt) || null,
      })) : [];
  });
  const [progress, setProgress] = useState(() => {
    const loaded = load(STORE.progress, {});
    const saved = loaded && typeof loaded === 'object' ? loaded : {};
    return Object.fromEntries(Object.entries(saved).map(([day, value]) => [day, {
      sessions: Math.max(0, Number(value?.sessions) || 0),
      minutes: Math.max(0, Number(value?.minutes) || 0),
    }]));
  });
  const [timer, setTimer] = useState(() => {
    const saved = readTimer();
    const prefs = readPreferences();
    return {
      ...saved,
      durationMs: saved.status === 'idle' ? minutesFor(prefs, saved.mode) : saved.durationMs,
      remainingMs: saved.status === 'idle' ? minutesFor(prefs, saved.mode) : saved.remainingMs,
    };
  });
  const [now, setNow] = useState(() => Date.now());
  const [notice, setNotice] = useState(null);
  const completionLock = useRef(null);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const soundRef = useRef(preferences.sound);
  soundRef.current = preferences.sound;

  useEffect(() => {
    try { localStorage.setItem(STORE.preferences, JSON.stringify(preferences)); } catch { /* storage may be disabled */ }
  }, [preferences]);
  useEffect(() => {
    try { localStorage.setItem(STORE.tasks, JSON.stringify(tasks)); } catch { /* storage may be disabled */ }
  }, [tasks]);
  useEffect(() => {
    try { localStorage.setItem(STORE.progress, JSON.stringify(progress)); } catch { /* storage may be disabled */ }
  }, [progress]);
  useEffect(() => {
    try { localStorage.setItem(STORE.timer, JSON.stringify(timer)); } catch { /* storage may be disabled */ }
  }, [timer]);

  const finish = useCallback((finishedTimer) => {
    const deadline = finishedTimer.endsAt;
    if (!deadline || completionLock.current === deadline) return;
    completionLock.current = deadline;
    const completedMode = finishedTimer.mode;
    const nextMode = completedMode === 'focus' ? 'short' : 'focus';
    const currentPrefs = readPreferences();
    const nextDuration = minutesFor(currentPrefs, nextMode);
    const nextTimer = { mode: nextMode, status: 'idle', endsAt: null, remainingMs: nextDuration, durationMs: nextDuration };
    setTimer(nextTimer);
    try { localStorage.setItem(STORE.timer, JSON.stringify(nextTimer)); } catch { /* storage may be disabled */ }
    if (completedMode === 'focus') {
      const today = localDayKey();
      const nextProgress = {
        ...progressRef.current,
        [today]: {
          sessions: (progressRef.current[today]?.sessions ?? 0) + 1,
          minutes: (progressRef.current[today]?.minutes ?? 0) + Math.round(finishedTimer.durationMs / 60_000),
        },
      };
      progressRef.current = nextProgress;
      setProgress(nextProgress);
      try { localStorage.setItem(STORE.progress, JSON.stringify(nextProgress)); } catch { /* storage may be disabled */ }
    }
    const noticeId = Date.now();
    setNotice({ mode: completedMode, id: noticeId });
    if (soundRef.current) playChime();
    window.setTimeout(() => setNotice((value) => value?.id === noticeId ? null : value), 5100);
  }, []);

  useEffect(() => {
    if (timer.status !== 'running' || timer.endsAt === null) return;
    const tick = () => {
      const stamp = Date.now();
      setNow(stamp);
      if (stamp >= (timer.endsAt ?? Infinity)) finish(timer);
    };
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [timer.status, timer.endsAt, finish]);

  const addTask = useCallback((text) => {
    const clean = text.trim();
    if (!clean) return false;
    setTasks((items) => [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text: clean, done: false, createdAt: Date.now() }, ...items]);
    return true;
  }, []);

  const toggleTask = useCallback((id) => {
    setTasks((items) => items.map((item) => item.id === id
      ? { ...item, done: !item.done, completedAt: item.done ? null : Date.now() }
      : item));
  }, []);

  const deleteTask = useCallback((id) => setTasks((items) => items.filter((item) => item.id !== id)), []);

  const chooseMode = useCallback((mode, start = false) => {
    const duration = minutesFor(readPreferences(), mode);
    setTimer({ mode, status: start ? 'running' : 'idle', endsAt: start ? Date.now() + duration : null, remainingMs: duration, durationMs: duration });
    completionLock.current = null;
  }, []);

  const toggleTimer = useCallback(() => {
    setTimer((current) => {
      if (current.status === 'running') {
        const remainingMs = Math.max(0, (current.endsAt ?? Date.now()) - Date.now());
        return { ...current, status: 'paused', endsAt: null, remainingMs };
      }
      const remainingMs = current.status === 'paused' ? current.remainingMs : minutesFor(readPreferences(), current.mode);
      const safeRemaining = Math.max(1_000, remainingMs);
      return { ...current, status: 'running', endsAt: Date.now() + safeRemaining, remainingMs: safeRemaining };
    });
    completionLock.current = null;
  }, []);

  const resetTimer = useCallback(() => {
    const duration = minutesFor(readPreferences(), timer.mode);
    setTimer({ mode: timer.mode, status: 'idle', endsAt: null, remainingMs: duration, durationMs: duration });
    completionLock.current = null;
  }, [timer.mode]);

  const updatePreferences = useCallback((next) => {
    setPreferences({
      ...next,
      durations: {
        focus: Math.min(120, Math.max(1, Math.round(next.durations.focus))),
        short: Math.min(120, Math.max(1, Math.round(next.durations.short))),
        long: Math.min(120, Math.max(1, Math.round(next.durations.long))),
      },
    });
    if (timer.status === 'idle') {
      const duration = minutesFor(next, timer.mode);
      setTimer({ mode: timer.mode, status: 'idle', endsAt: null, remainingMs: duration, durationMs: duration });
    }
  }, [timer.mode, timer.status]);

  const resetAll = useCallback(() => {
    setPreferences(defaultPreferences);
    setTasks([]);
    setProgress({});
    progressRef.current = {};
    setTimer(defaultTimer);
    setNotice(null);
    completionLock.current = null;
    setNow(Date.now());
    try {
      localStorage.setItem(STORE.preferences, JSON.stringify(defaultPreferences));
      localStorage.setItem(STORE.tasks, '[]');
      localStorage.setItem(STORE.progress, '{}');
      localStorage.setItem(STORE.timer, JSON.stringify(defaultTimer));
    } catch { /* storage may be disabled */ }
  }, []);

  const remainingMs = timer.status === 'running'
    ? Math.max(0, (timer.endsAt ?? now) - now)
    : timer.remainingMs;

  return {
    preferences, tasks, progress, timer, now, remainingMs, notice,
    addTask, toggleTask, deleteTask, chooseMode, toggleTimer, resetTimer,
    updatePreferences, resetAll,
  };
}