import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen, Check, CircleHelp, CloudRain, Coffee,
  Moon, Pause, Play, Plus, RotateCcw, Settings2, Sparkles, Timer,
  Trash2, Volume2, X,
} from 'lucide-react';
import { localDayKey, useStudyDesk } from '@/hooks/use-study-desk';

const MODE_LABELS = { focus: 'Focus', short: 'Short break', long: 'Long break' };
const MODE_HINTS = {
  focus: 'One thing at a time. You’ve got this.',
  short: 'Step away. Let your mind wander.',
  long: 'You’ve earned a slower pause.',
};
const MOTIVATIONS = [
  'Small steps still move you forward.',
  'Make room for one good thought.',
  'Begin where you are. Stay a little.',
  'Your attention is a kind of care.',
  'Quiet progress is still progress.',
  'One page. One breath. One thing.',
];

function formatTime(milliseconds) {
  const wholeSeconds = Math.ceil(milliseconds / 1000);
  const minutes = Math.floor(wholeSeconds / 60);
  const seconds = wholeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function App() {
  const desk = useStudyDesk();
  const [mottoIndex, setMottoIndex] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [taskDraft, setTaskDraft] = useState('');
  const [liveNotice, setLiveNotice] = useState(null);
  const [todayKey, setTodayKey] = useState(localDayKey);
  const addInputRef = useRef(null);
  const settingsTriggerRef = useRef(null);
  const settingsWasOpen = useRef(false);
  const todayLabel = useMemo(() => new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(`${todayKey}T12:00:00`)), [todayKey]);
  const todayProgress = desk.progress[todayKey] ?? { sessions: 0, minutes: 0 };
  const completedTasks = desk.tasks.filter((task) => task.done).length;
  const completedTodayTasks = desk.tasks.filter((task) => task.done && task.completedAt && localDayKey(new Date(task.completedAt)) === todayKey).length;
  const timerDuration = desk.timer.durationMs;
  const timerProgress = Math.min(1, Math.max(0, 1 - desk.remainingMs / timerDuration));
  const circumference = 2 * Math.PI * 100;
  const dashOffset = circumference * (1 - timerProgress);
  const isRunning = desk.timer.status === 'running';
  const dayItems = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const key = localDayKey(date);
    return { key, date, stats: desk.progress[key] ?? { sessions: 0, minutes: 0 }, today: key === todayKey };
  }), [desk.progress, todayKey]);

  useEffect(() => {
    const interval = window.setInterval(() => setMottoIndex((index) => (index + 1) % MOTIVATIONS.length), 8_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setTodayKey(localDayKey()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!desk.notice) return;
    const label = desk.notice.mode === 'focus' ? 'Focus complete. Your short break has started.' : 'Break complete. Focus is ready when you are.';
    setLiveNotice(label);
    const timeout = window.setTimeout(() => setLiveNotice(null), 5_000);
    return () => window.clearTimeout(timeout);
  }, [desk.notice]);

  useEffect(() => {
    if (!settingsOpen) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setSettingsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [settingsOpen]);

  useEffect(() => {
    if (settingsOpen) settingsWasOpen.current = true;
    else if (settingsWasOpen.current) {
      settingsWasOpen.current = false;
      settingsTriggerRef.current?.focus();
    }
  }, [settingsOpen]);

  const submitTask = (event) => {
    event.preventDefault();
    if (desk.addTask(taskDraft)) {
      setTaskDraft('');
    } else {
      addInputRef.current?.focus();
    }
  };

  const startMode = (mode) => desk.chooseMode(mode, true);
  const statusLabel = isRunning ? 'SESSION IN PROGRESS' : desk.timer.status === 'paused' ? 'PAUSED FOR NOW' : 'READY WHEN YOU ARE';
  const sessionCaption = desk.timer.status === 'running' ? 'time to come back to you' : desk.timer.status === 'paused' ? 'pick up whenever you’re ready' : 'a little space to focus';
  const dailyGoalProgress = Math.min(todayProgress.sessions / 4, 1) * 100;

  return (
    <main className="desk" data-atmosphere={desk.preferences.atmosphere}>
      <div className="shell">
        <header className="topbar">
          <div className="brand" aria-label="Study Desk home">
            <div className="brand-mark" aria-hidden="true"><Sparkles size={19} strokeWidth={1.8} /></div>
            <div>
              <div className="brand-title">STUDY DESK</div>
              <div className="brand-tag">FOCUS. STUDY. REPEAT.</div>
            </div>
          </div>
          <div className="header-right">
            <div className="motto" aria-live="polite" data-testid="text-motivation">{MOTIVATIONS[mottoIndex]}</div>
            <button
              ref={settingsTriggerRef}
              type="button"
              className="icon-button"
              aria-label="Open settings"
              data-testid="button-open-settings"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2 size={18} />
            </button>
          </div>
        </header>

        <section className="welcome" aria-label="Today">
          <div>
            <div className="eyebrow">YOUR SPACE TO SETTLE IN</div>
            <h1>A quiet place to begin.</h1>
            <p>Bring your attention to one thing. The rest can wait.</p>
          </div>
          <div className="day-chip" data-testid="text-today-date"><span aria-hidden="true" />{todayLabel}</div>
        </section>

        <div className="main-grid">
          <section className="surface timer-card" aria-labelledby="timer-title">
            <div className="timer-top">
              <div className="section-label" id="timer-title"><Timer size={15} /> YOUR FOCUS SESSION</div>
              <div className="live-pill" data-testid="status-session">
                {isRunning && <span className="dot" aria-hidden="true" />}
                {statusLabel}
              </div>
            </div>

            <div className="mode-tabs" role="group" aria-label="Choose timer mode">
              {['focus', 'short', 'long'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className="mode-tab"
                  aria-pressed={desk.timer.mode === mode}
                  data-testid={`button-mode-${mode}`}
                  onClick={() => desk.chooseMode(mode)}
                >
                  {MODE_LABELS[mode]} <span>{desk.preferences.durations[mode]}m</span>
                </button>
              ))}
            </div>

            <div className="timer-body">
              <div className="clock-wrap">
                <div className="clock-face" role="group" aria-label={`${MODE_LABELS[desk.timer.mode]} timer`}>
                  <svg className="clock-svg" viewBox="0 0 220 220" aria-hidden="true">
                    <circle className="clock-track" cx="110" cy="110" r="100" />
                    <circle
                      className="clock-progress"
                      cx="110"
                      cy="110"
                      r="100"
                      strokeDasharray={circumference}
                      strokeDashoffset={dashOffset}
                    />
                  </svg>
                  <div className="clock-inner">
                    <div className="timer-digits" role="timer" aria-live="off" data-testid="text-timer-countdown">{formatTime(desk.remainingMs)}</div>
                    <div className="timer-caption" data-testid="text-timer-mode">{MODE_LABELS[desk.timer.mode]}</div>
                    <p className="timer-description">{sessionCaption}</p>
                  </div>
                </div>
              </div>

              <div className="timer-actions">
                <p className="timer-description">{MODE_HINTS[desk.timer.mode]}</p>
                <button
                  type="button"
                  className="primary-action"
                  data-testid="button-timer-toggle"
                  aria-label={isRunning ? 'Pause timer' : desk.timer.status === 'paused' ? 'Resume timer' : 'Start timer'}
                  onClick={desk.toggleTimer}
                >
                  {isRunning ? <><Pause size={16} fill="currentColor" /> Pause session</> : <><Play size={16} fill="currentColor" /> {desk.timer.status === 'paused' ? 'Resume session' : 'Begin session'}</>}
                </button>
                <div className="secondary-actions">
                  <button type="button" className="soft-action" data-testid="button-timer-reset" onClick={desk.resetTimer}>
                    <RotateCcw size={14} /> Reset
                  </button>
                </div>
              </div>
            </div>

            <div className="quick-starts" aria-label="Quick starts">
              <div className="quick-label">A little nudge</div>
              <button type="button" className="quick-button" data-testid="button-quick-focus" onClick={() => startMode('focus')}>Start Focus</button>
              <button type="button" className="quick-button" data-testid="button-quick-short-break" onClick={() => startMode('short')}>Take {desk.preferences.durations.short} Min Break</button>
              <button type="button" className="quick-button" data-testid="button-quick-long-break" onClick={() => startMode('long')}>Take {desk.preferences.durations.long} Min Break</button>
            </div>
          </section>

          <div className="side-stack">
            <section className="surface side-card" aria-labelledby="tasks-title">
              <div className="card-heading">
                <h2 id="tasks-title">Today’s tasks</h2>
                <span className="tasks-count" data-testid="text-task-count">{completedTasks} / {desk.tasks.length} done</span>
              </div>
              <form className="task-form" onSubmit={submitTask}>
                <input
                  ref={addInputRef}
                  className="task-input"
                  type="text"
                  value={taskDraft}
                  maxLength={120}
                  aria-label="Add a task for today"
                  placeholder="What’s on your mind?"
                  data-testid="input-new-task"
                  onChange={(event) => setTaskDraft(event.target.value)}
                />
                <button type="submit" className="add-task" aria-label="Add task" data-testid="button-add-task"><Plus size={18} /></button>
              </form>
              {desk.tasks.length === 0 ? (
                <div className="empty-tasks" data-testid="state-tasks-empty">
                  <div className="empty-icon"><CircleHelp size={17} /></div>
                  <strong>A little breathing room.</strong>
                  <p>Add one thing you’d like to finish today.</p>
                </div>
              ) : (
                <ul className="task-list" aria-label="Tasks for today" data-testid="list-tasks">
                  {desk.tasks.map((task) => (
                    <li className="task-row" key={task.id} data-testid={`row-task-${task.id}`}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={task.done}
                        aria-label={`${task.done ? 'Mark incomplete' : 'Complete'}: ${task.text}`}
                        className="task-check"
                        data-testid={`button-toggle-task-${task.id}`}
                        onClick={() => desk.toggleTask(task.id)}
                      >
                        {task.done && <Check size={12} strokeWidth={3} />}
                      </button>
                      <span className={`task-text${task.done ? ' is-done' : ''}`} data-testid={`text-task-${task.id}`}>{task.text}</span>
                      <button
                        type="button"
                        className="delete-task"
                        aria-label={`Delete task: ${task.text}`}
                        data-testid={`button-delete-task-${task.id}`}
                        onClick={() => desk.deleteTask(task.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="surface stats-card" aria-labelledby="summary-title">
              <div className="stats-top">
                <div className="card-heading"><h2 id="summary-title">A small summary</h2></div>
                <span className="muted-note">today</span>
              </div>
              <div className="stats-grid">
                <div className="stat-item">
                  <div className="stat-value" data-testid="text-summary-sessions">{todayProgress.sessions}</div>
                  <div className="stat-label">focus<br />sessions</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value" data-testid="text-summary-minutes">{todayProgress.minutes}<small style={{ fontSize: 11, marginLeft: 3 }}>m</small></div>
                  <div className="stat-label">focus<br />time</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value" data-testid="text-summary-tasks">{completedTodayTasks}</div>
                  <div className="stat-label">tasks<br />finished</div>
                </div>
              </div>
              <div
                className="progress-track"
                role="progressbar"
                aria-label="Focus sessions today"
                aria-valuemin={0}
                aria-valuemax={4}
                aria-valuenow={Math.min(todayProgress.sessions, 4)}
                data-testid="progress-today"
              >
                <div className="progress-fill" style={{ width: `${dailyGoalProgress}%` }} />
              </div>
              <div className="progress-caption"><span>A gentle rhythm, not a goal</span><span data-testid="text-summary-progress">{todayProgress.sessions} / 4</span></div>
            </section>
          </div>
        </div>

        <div className="bottom-grid">
          <section className="surface week-card" aria-labelledby="week-title">
            <div className="card-heading">
              <h2 id="week-title">Your week, at a glance</h2>
              <span className="muted-note">last 7 days</span>
            </div>
            <div className="week-sub">A day lights up when you finish a focus session.</div>
            <div className="week-bars" role="list" aria-label="Focus days this week">
              {dayItems.map(({ key, date, stats, today }) => {
                const name = new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date);
                const active = stats.sessions > 0;
                return (
                  <div className="day-column" role="listitem" key={key} data-testid={`day-progress-${key}`}>
                    <div
                      className={`day-dot${active ? ' active' : ''}${today ? ' today' : ''}`}
                      aria-label={`${name}: ${stats.sessions} completed focus sessions${today ? ', today' : ''}`}
                      data-testid={`status-focus-day-${key}`}
                    >
                      {active && <Check size={15} strokeWidth={2.5} />}
                    </div>
                    <div className={`day-name${today ? ' is-today' : ''}`}>{today ? 'Today' : name}</div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="surface atmosphere-card" aria-labelledby="atmosphere-title">
            <div className="card-heading"><h2 id="atmosphere-title">Set the atmosphere</h2></div>
            <p className="atmosphere-intro">A small shift in the room around you.</p>
            <div className="atmosphere-list" role="group" aria-label="Choose atmosphere">
              {[
                { value: 'coffee', label: 'Coffee', icon: <Coffee size={15} /> },
                { value: 'rain', label: 'Rain', icon: <CloudRain size={15} /> },
                { value: 'library', label: 'Library', icon: <BookOpen size={15} /> },
                { value: 'night', label: 'Night', icon: <Moon size={15} /> },
              ].map((item) => (
                <button
                  type="button"
                  key={item.value}
                  className="atmosphere-button"
                  data-mode={item.value}
                  aria-pressed={desk.preferences.atmosphere === item.value}
                  data-testid={`button-atmosphere-${item.value}`}
                  onClick={() => desk.updatePreferences({ ...desk.preferences, atmosphere: item.value })}
                >
                  <span className="atmosphere-icon">{item.icon}</span>{item.label}
                </button>
              ))}
            </div>
          </section>
        </div>

        <footer className="footer">Made for the moments you show up <span className="footer-mark">·</span> Come back to yourself, one session at a time.</footer>
      </div>

      {(desk.notice || liveNotice) && (
        <div className="toast-note" role="status" aria-live="polite" data-testid="status-notice">
          {liveNotice ?? (desk.notice?.mode === 'focus' ? <>Focus complete. <strong>Your short break is ready.</strong></> : <>Break complete. <strong>Focus is ready when you are.</strong></>)}
        </div>
      )}

      {settingsOpen && (
        <SettingsDialog
          preferences={desk.preferences}
          onSave={(next) => { desk.updatePreferences(next); setSettingsOpen(false); }}
          onReset={desk.resetAll}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </main>
  );
}

function SettingsDialog({ preferences, onSave, onReset, onClose }) {
  const [draft, setDraft] = useState(preferences);
  const [durationText, setDurationText] = useState({
    focus: String(preferences.durations.focus),
    short: String(preferences.durations.short),
    long: String(preferences.durations.long),
  });
  const [confirmReset, setConfirmReset] = useState(false);
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const setDuration = (mode, text) => {
    setDurationText((current) => ({ ...current, [mode]: text }));
    const parsed = Number(text);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 120) {
      setDraft((current) => ({ ...current, durations: { ...current.durations, [mode]: parsed } }));
    }
  };

  const save = () => {
    const durations = { ...draft.durations };
    ['focus', 'short', 'long'].forEach((mode) => {
      const parsed = Number(durationText[mode]);
      durations[mode] = Math.min(120, Math.max(1, Math.round(Number.isFinite(parsed) && parsed > 0 ? parsed : preferences.durations[mode])));
    });
    onSave({ ...draft, durations });
  };

  const onDialogKeyDown = (event) => {
    if (event.key === 'Tab') {
      const dialog = event.currentTarget;
      const focusable = Array.from(dialog.querySelectorAll('button:not([disabled]), input:not([disabled])'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  };

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        data-testid="dialog-settings"
        onKeyDown={onDialogKeyDown}
      >
        <div className="dialog-head">
          <div>
            <h2 id="settings-title">Make it yours</h2>
            <p>A few quiet preferences for your desk.</p>
          </div>
          <button ref={closeRef} type="button" className="dialog-close" aria-label="Close settings" data-testid="button-close-settings" onClick={onClose}><X size={17} /></button>
        </div>
        <section className="settings-section" aria-labelledby="durations-title">
          <h3 id="durations-title">Session lengths</h3>
          <div className="duration-list">
            {[
              { mode: 'focus', label: 'Focus' },
              { mode: 'short', label: 'Short break' },
              { mode: 'long', label: 'Long break' },
            ].map(({ mode, label }) => (
              <label className="duration-row" key={mode} htmlFor={`duration-${mode}`}>
                <span>{label}</span>
                <span className="duration-control">
                  <input
                    id={`duration-${mode}`}
                    className="duration-input"
                    type="number"
                    min={1}
                    max={120}
                    step={1}
                    value={durationText[mode]}
                    aria-label={`${label} duration in minutes`}
                    data-testid={`input-duration-${mode}`}
                    onChange={(event) => setDuration(mode, event.target.value)}
                  />
                  <span className="unit">min</span>
                </span>
              </label>
            ))}
          </div>
        </section>
        <section className="settings-section" aria-labelledby="sound-title">
          <h3 id="sound-title">A soft reminder</h3>
          <div className="sound-row">
            <span><Volume2 size={14} style={{ verticalAlign: 'middle', marginRight: 7 }} /> Gentle sound at session end</span>
            <button
              type="button"
              role="switch"
              aria-checked={draft.sound}
              aria-label="Gentle sound at session end"
              className="toggle"
              data-testid="switch-sound"
              onClick={() => setDraft((current) => ({ ...current, sound: !current.sound }))}
            >
              <span className="toggle-knob" />
            </button>
          </div>
          <p className="muted-note" style={{ margin: '9px 0 0', lineHeight: 1.5 }}>Uses a short tone from your browser. No audio plays unless you turn this on.</p>
        </section>
        <div className="settings-foot">
          <button type="button" className="text-button danger" data-testid="button-reset-all" onClick={() => setConfirmReset(true)}>Reset all desk data</button>
          <button type="button" className="done-button" data-testid="button-save-settings" onClick={save}>Save preferences</button>
        </div>
        {confirmReset && (
          <div className="confirm-panel" data-testid="dialog-reset-confirmation">
            <p><strong>Start fresh?</strong> This clears your tasks, timer, preferences, and focus history from this browser.</p>
            <div className="confirm-actions">
              <button type="button" data-testid="button-cancel-reset" onClick={() => setConfirmReset(false)}>Keep my desk</button>
              <button type="button" className="confirm-reset" data-testid="button-confirm-reset" onClick={() => { onReset(); onClose(); }}>Clear everything</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;