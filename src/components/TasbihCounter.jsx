import React, { useState } from 'react';

const DHIKR = [
  { key: 'subhanallah',   en: 'SubhanAllah',   ar: 'سُبْحَانَ اللَّهِ',  target: 33 },
  { key: 'alhamdulillah', en: 'Alhamdulillah', ar: 'الْحَمْدُ لِلَّهِ', target: 33 },
  { key: 'allahuakbar',   en: 'Allahu Akbar',  ar: 'اللَّهُ أَكْبَرُ',  target: 34 },
];

const CIRCUMFERENCE = 2 * Math.PI * 54;

export default function TasbihCounter() {
  const [active, setActive]         = useState(0);
  const [counts, setCounts]         = useState([0, 0, 0]);
  const [total, setTotal]           = useState(0);
  const [cycles, setCycles]         = useState(0);
  const [flashDone, setFlashDone]   = useState(false);

  function tap() {
    try { navigator.vibrate(18); } catch {}

    const newCount = counts[active] + 1;
    const newCounts = [...counts];
    newCounts[active] = newCount;
    let newActive = active;

    if (newCount >= DHIKR[active].target) {
      if (active < DHIKR.length - 1) {
        newActive = active + 1;
      } else {
        // Full cycle of 100 complete
        newCounts.fill(0);
        newActive = 0;
        setCycles(c => c + 1);
        setFlashDone(true);
        setTimeout(() => setFlashDone(false), 1200);
      }
      setActive(newActive);
    }

    setCounts(newCounts);
    setTotal(t => t + 1);
  }

  function reset() {
    setCounts([0, 0, 0]);
    setTotal(0);
    setCycles(0);
    setActive(0);
  }

  const current   = DHIKR[active];
  const progress  = counts[active] / current.target;
  const offset    = CIRCUMFERENCE * (1 - progress);

  return (
    <div className="tasbih-wrap">
      <h2 className="tasbih-title">📿 Tasbih</h2>

      {/* Dhikr selector tabs */}
      <div className="dhikr-selector">
        {DHIKR.map((d, i) => (
          <button
            key={d.key}
            className={`dhikr-tab ${i === active ? 'active' : ''} ${counts[i] >= d.target ? 'done' : ''}`}
            onClick={() => setActive(i)}
          >
            <span className="dhikr-tab-count">{counts[i]}/{d.target}</span>
            <span className="dhikr-tab-name">{d.en}</span>
          </button>
        ))}
      </div>

      {/* Main counter area */}
      <div className={`tasbih-main ${flashDone ? 'flash' : ''}`}>
        <p className="tasbih-ar">{current.ar}</p>
        <p className="tasbih-en-label">{current.en}</p>

        {/* Ring + tap button */}
        <div className="tasbih-ring-wrap">
          <svg className="tasbih-ring" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="54"
              fill="none"
              stroke="var(--border)"
              strokeWidth="5"
            />
            <circle cx="60" cy="60" r="54"
              fill="none"
              stroke="var(--gold)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
              transform="rotate(-90 60 60)"
              style={{ transition: 'stroke-dashoffset 0.15s ease' }}
            />
          </svg>
          <button className="tasbih-tap" onClick={tap}>
            <span className="tasbih-count">{counts[active]}</span>
            <span className="tasbih-target">/ {current.target}</span>
          </button>
        </div>

        <p className="tasbih-hint">Tap to count</p>
      </div>

      {/* Session stats */}
      <div className="tasbih-stats">
        <div className="tstat">
          <span className="tstat-num">{total}</span>
          <span className="tstat-lbl">Total</span>
        </div>
        <div className="tstat-sep">·</div>
        <div className="tstat">
          <span className="tstat-num">{cycles}</span>
          <span className="tstat-lbl">Cycles (×100)</span>
        </div>
        <div className="tstat-sep">·</div>
        <div className="tstat">
          <span className="tstat-num">{cycles * 100 + total}</span>
          <span className="tstat-lbl">Grand Total</span>
        </div>
      </div>

      <button className="tasbih-reset-btn" onClick={reset}>↺ Reset</button>
    </div>
  );
}
