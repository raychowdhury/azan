import React, { useEffect, useMemo, useState } from 'react';

const PRESETS = [
  { value: 33, label: '33' },
  { value: 99, label: '99' },
  { value: 100, label: '100' },
  { value: 0, label: '∞' },
];

function loadNumber(key, fallback) {
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) ? value : fallback;
}

export default function Tasbih({ target, onTargetChange }) {
  const [count, setCount] = useState(() => loadNumber('tasbih.count', 0));
  const [sessions, setSessions] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tasbih.sessions')) ?? []; }
    catch { return []; }
  });

  const progress = useMemo(() => (
    target > 0 ? Math.min(100, (count / target) * 100) : 0
  ), [count, target]);

  useEffect(() => {
    localStorage.setItem('tasbih.count', String(count));
  }, [count]);

  useEffect(() => {
    localStorage.setItem('tasbih.sessions', JSON.stringify(sessions.slice(0, 100)));
  }, [sessions]);

  async function vibrate(isComplete = false) {
    if ('vibrate' in navigator) navigator.vibrate(isComplete ? [35, 25, 35] : 10);
  }

  function increment() {
    const next = count + 1;
    setCount(next);
    vibrate(target > 0 && next === target);
  }

  function reset() {
    if (count > 0) {
      setSessions(current => [
        { count, target, completedAt: new Date().toISOString() },
        ...current,
      ].slice(0, 100));
    }
    setCount(0);
    vibrate();
  }

  return (
    <div className="tasbih-wrap">
      <div className="feature-header-row">
        <div>
          <h2 className="weekly-title">Tasbih Counter</h2>
          <p className="feature-subtitle">Tap counter with haptic vibration where supported.</p>
        </div>
        <div className="preset-row">
          {PRESETS.map(preset => (
            <button
              key={preset.value}
              className={`preset-btn ${target === preset.value ? 'active' : ''}`}
              onClick={() => onTargetChange(preset.value)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <button className="tasbih-button" onClick={increment}>
        <span className="tasbih-count">{count}</span>
        {target > 0 && <span className="tasbih-target">/ {target}</span>}
        <span className="tasbih-label">Tap</span>
        {target > 0 && <span className="tasbih-progress" style={{ width: `${progress}%` }} />}
      </button>

      <button className="tasbih-reset" onClick={reset}>Reset</button>

      {sessions.length > 0 && (
        <div className="sessions-card">
          <h3>Recent sessions</h3>
          {sessions.slice(0, 5).map((session, index) => (
            <div key={`${session.completedAt}-${index}`} className="session-row">
              <span>{session.count}{session.target > 0 ? ` / ${session.target}` : ''}</span>
              <span>{new Date(session.completedAt).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
