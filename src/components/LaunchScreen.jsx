import React, { useEffect, useState } from 'react';
import { SKY } from '../utils/sky';

const SKY_LABEL = {
  fajr: 'Fajr',
  sunrise: 'Sunrise',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};

export default function LaunchScreen({ skyKey = 'dhuhr', dark = true, onDone, holdMs = 1500 }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), holdMs);
    const t2 = setTimeout(() => onDone?.(), holdMs + 400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [holdMs, onDone]);

  const sky = SKY[skyKey] || SKY.dhuhr;
  const skyGrad = dark ? sky.grad : sky.gradLight;
  const isNight = skyKey === 'isha' || skyKey === 'fajr';
  const onLight = !dark && (skyKey === 'sunrise' || skyKey === 'dhuhr' || skyKey === 'asr');
  const fg = onLight ? '#1c1916' : '#fff';
  const dim = onLight ? 'rgba(28,25,22,0.6)' : 'rgba(255,255,255,0.7)';

  return (
    <div
      className={`launch-overlay ${leaving ? 'leaving' : ''}`}
      style={{ background: skyGrad, color: fg }}
      aria-hidden={leaving}
    >
      {isNight &&
        Array.from({ length: 22 }).map((_, i) => (
          <span
            key={i}
            className="launch-star"
            style={{
              top: `${4 + ((i * 37) % 70)}%`,
              left: `${4 + ((i * 71) % 92)}%`,
              width: i % 4 === 0 ? 3 : 2,
              height: i % 4 === 0 ? 3 : 2,
              opacity: 0.3 + ((i * 53) % 60) / 100,
            }}
          />
        ))}

      <div
        className="launch-orb"
        style={{
          background: sky.sun,
          boxShadow: `0 0 80px 20px ${sky.glow}`,
        }}
      />

      <svg
        className="launch-arch"
        viewBox="0 0 390 280"
        preserveAspectRatio="xMidYMax meet"
        aria-hidden="true"
      >
        <path
          d="M0 280 V 200 Q 0 120 80 120 Q 80 60 110 50 Q 110 40 120 40 Q 120 20 140 20 Q 140 0 195 0 Q 250 0 250 20 Q 270 20 270 40 Q 280 40 280 50 Q 310 60 310 120 Q 390 120 390 200 V 280 Z"
          fill={fg}
          opacity="0.16"
        />
      </svg>

      <div className="launch-stack">
        <div className="launch-brand">
          <div
            className="launch-logo"
            style={{
              background: onLight ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.10)',
              border: onLight ? '0.5px solid rgba(28,25,22,0.10)' : '0.5px solid rgba(255,255,255,0.18)',
            }}
          >
            <svg
              width="56"
              height="56"
              viewBox="0 0 56 56"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: '#d4a857' }}
            >
              <path d="M14 48 V 26 C 14 22 17 19 21 19 H 35 C 39 19 42 22 42 26 V 48" />
              <path d="M28 19 V 13" />
              <path d="M24 16 H 32" />
              <circle cx="28" cy="10" r="2" />
              <path d="M21 48 V 38 C 21 35 24 32 28 32 C 32 32 35 35 35 38 V 48" />
              <path d="M10 48 H 46" />
              <path d="M28 6.5 a 3 3 0 1 1 -2 -3.5" strokeWidth="1.6" />
            </svg>
          </div>

          <div className="launch-wordmark">
            <div className="launch-name">Azan</div>
            <div className="launch-name-ar">أَذَان</div>
          </div>

          <div className="launch-tagline" style={{ color: dim }}>
            Prayer times, Qibla, and dhikr
            <br />
            for any city worldwide
          </div>

          <div
            className="launch-chip"
            style={{
              background: onLight ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.14)',
              border: onLight ? '0.5px solid rgba(28,25,22,0.08)' : '0.5px solid rgba(255,255,255,0.20)',
              color: fg,
            }}
          >
            <span
              className="launch-chip-dot"
              style={{ background: sky.sun, boxShadow: `0 0 8px ${sky.glow}` }}
            />
            {SKY_LABEL[skyKey] || sky.name} time
          </div>
        </div>

        <div className="launch-bottom">
          <div className="launch-verse">
            إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَّوْقُوتًا
          </div>
          <div className="launch-verse-en" style={{ color: dim }}>
            "Verily, prayer is enjoined on the believers at fixed hours" — Qur'an 4:103
          </div>
          <div className="launch-loader" style={{ color: dim }}>
            <span className="launch-dot" style={{ background: fg, animationDelay: '0s' }} />
            <span className="launch-dot" style={{ background: fg, animationDelay: '0.15s' }} />
            <span className="launch-dot" style={{ background: fg, animationDelay: '0.3s' }} />
            <span>Locating prayer times…</span>
          </div>
        </div>
      </div>
    </div>
  );
}
