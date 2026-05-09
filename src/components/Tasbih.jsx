import React, { useEffect, useMemo, useState } from 'react';
import { useT } from '../i18n';

const PRESETS = [
  { value: 33, label: '33' },
  { value: 99, label: '99' },
  { value: 100, label: '100' },
  { value: 0, label: '∞' },
];

export const DHIKR_PRESETS = [
  { id: 'subhanallah',     label: 'SubhanAllah',      arabic: 'سُبْحَانَ ٱللَّٰه',           target: 33 },
  { id: 'alhamdulillah',   label: 'Alhamdulillah',    arabic: 'ٱلْحَمْدُ لِلَّٰه',          target: 33 },
  { id: 'allahuakbar',     label: 'Allahu Akbar',     arabic: 'ٱللَّٰهُ أَكْبَر',           target: 34 },
  { id: 'astaghfirullah',  label: 'Astaghfirullah',   arabic: 'أَسْتَغْفِرُ ٱللَّٰه',        target: 100 },
  { id: 'lailahaillallah', label: 'La ilaha illallah',arabic: 'لَا إِلَٰهَ إِلَّا ٱللَّٰه', target: 100 },
  { id: 'salawat',         label: 'Salawat',          arabic: 'ٱللَّهُمَّ صَلِّ عَلَىٰ مُحَمَّد', target: 100 },
  { id: 'custom',          label: 'Custom',           arabic: '',                             target: null },
];

function loadNumber(key, fallback) {
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) ? value : fallback;
}

function loadString(key, fallback) {
  const value = localStorage.getItem(key);
  return value ?? fallback;
}

function getDhikr(id) {
  return DHIKR_PRESETS.find(d => d.id === id) ?? DHIKR_PRESETS[DHIKR_PRESETS.length - 1];
}

export default function Tasbih({ target, onTargetChange }) {
  const { t } = useT();
  const [count, setCount] = useState(() => loadNumber('tasbih.count', 0));
  const [dhikrId, setDhikrId] = useState(() => loadString('tasbih.dhikr', 'subhanallah'));
  const [sessions, setSessions] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tasbih.sessions')) ?? []; }
    catch { return []; }
  });

  const dhikr = useMemo(() => getDhikr(dhikrId), [dhikrId]);
  const progress = useMemo(() => (
    target > 0 ? Math.min(100, (count / target) * 100) : 0
  ), [count, target]);

  useEffect(() => { localStorage.setItem('tasbih.count', String(count)); }, [count]);
  useEffect(() => { localStorage.setItem('tasbih.dhikr', dhikrId); }, [dhikrId]);
  useEffect(() => {
    localStorage.setItem('tasbih.sessions', JSON.stringify(sessions.slice(0, 100)));
  }, [sessions]);

  function vibrate(isComplete = false) {
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
        {
          count,
          target,
          dhikrId,
          dhikrLabel: dhikr.label,
          completedAt: new Date().toISOString(),
        },
        ...current,
      ].slice(0, 100));
    }
    setCount(0);
    vibrate();
  }

  function selectDhikr(id) {
    setDhikrId(id);
    const next = getDhikr(id);
    if (next.target != null) onTargetChange(next.target);
    setCount(0);
  }

  return (
    <div className="tasbih-wrap">
      <div className="feature-header-row">
        <div>
          <h2 className="weekly-title">{t('tasbih.title')}</h2>
          <p className="feature-subtitle">{t('tasbih.subtitle')}</p>
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

      <div className="dhikr-row">
        <label className="dhikr-select-label">
          <span>{t('tasbih.dhikr')}</span>
          <select
            className="method-select"
            value={dhikrId}
            onChange={e => selectDhikr(e.target.value)}
          >
            {DHIKR_PRESETS.map(d => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </label>
        {dhikr.arabic && <div className="dhikr-arabic">{dhikr.arabic}</div>}
      </div>

      <button
        className="tasbih-button"
        onClick={increment}
        style={{ '--tasbih-progress': progress }}
      >
        <span className="tasbih-count">{count}</span>
        {target > 0 && <span className="tasbih-target">{t('tasbih.of')} {target}</span>}
        <span className="tasbih-label">{t('tasbih.tapToCount')}</span>
      </button>

      <button className="tasbih-reset" onClick={reset}>{t('tasbih.reset')}</button>

      {sessions.length > 0 && (
        <div className="sessions-card">
          <h3>{t('tasbih.recent')}</h3>
          {sessions.slice(0, 5).map((session, index) => (
            <div key={`${session.completedAt}-${index}`} className="session-row">
              <span>
                {session.dhikrLabel ? `${session.dhikrLabel} · ` : ''}
                {session.count}{session.target > 0 ? ` / ${session.target}` : ''}
              </span>
              <span>{new Date(session.completedAt).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
