import React, { useState } from 'react';
import { METHOD_OPTIONS } from '../features/prayer-times/calculation';

const PANELS = [
  {
    id: 'hero',
    eyebrow: 'AS-SALAMU ALAYKUM',
    title: 'Welcome to Azan',
    arabic: 'مرحبًا بك',
    body: 'Five prayers. Any city. A calmer way to keep time with your day.',
    cta: 'Begin',
  },
  {
    id: 'location',
    eyebrow: 'STEP 1 OF 4',
    title: 'Find your prayer times',
    arabic: 'حدد موقعك',
    body: 'We use your location only to calculate accurate prayer times. Nothing leaves your device.',
    cta: 'Use my location',
    sub: 'Enter manually',
  },
  {
    id: 'notify',
    eyebrow: 'STEP 2 OF 4',
    title: 'Gentle reminders',
    arabic: 'تذكير خفيف',
    body: 'A soft adhan cue or a silent vibration — whichever fits your moment. You decide per-prayer.',
    cta: 'Allow notifications',
    sub: 'Maybe later',
  },
  {
    id: 'method',
    eyebrow: 'STEP 3 OF 4',
    title: 'Your calculation',
    arabic: 'طريقة الحساب',
    body: 'Pick a method that matches your community. You can change this anytime in Settings.',
    cta: 'Continue',
  },
  {
    id: 'done',
    eyebrow: "YOU'RE ALL SET",
    title: 'May your prayers\nbe accepted',
    arabic: 'تَقَبَّلَ ٱللَّٰهُ',
    body: 'Azan is ready.',
    cta: 'Open Azan',
  },
];

const METHOD_NOTES = {
  MuslimWorldLeague: 'Common global default',
  NorthAmerica: 'North America (ISNA)',
  Karachi: 'South Asia',
  UmmAlQura: 'Arabian Peninsula',
  Egyptian: 'Africa, Levant',
  Tehran: 'Iran',
  Dubai: 'UAE',
  Kuwait: 'Kuwait',
  Qatar: 'Qatar',
  Singapore: 'Singapore / SE Asia',
  Turkey: 'Turkey (Diyanet)',
  MoonsightingCommittee: 'Moonsighting Committee',
};

const METHODS = METHOD_OPTIONS.map((m) => ({
  id: m.id,
  name: m.label.replace(/\s*\(.*\)\s*$/, ''),
  note: METHOD_NOTES[m.id] || m.authority,
}));

const HeroMark = () => (
  <svg width="160" height="160" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="50" cy="50" r="44" opacity="0.25" />
    <circle cx="50" cy="50" r="34" opacity="0.4" />
    <g strokeWidth="2.2">
      <path d="M28 78 V 52 C 28 44 36 38 50 38 C 64 38 72 44 72 52 V 78" />
      <path d="M50 38 V 28" />
      <path d="M46 31 H 54" />
      <path d="M50 24 a 3 3 0 1 1 -2.4 -3.4" strokeWidth="1.7" />
      <path d="M40 78 V 60 C 40 54 44 50 50 50 C 56 50 60 54 60 60 V 78" strokeWidth="1.8" />
      <path d="M20 78 V 56" />
      <path d="M17 56 H 23" />
      <path d="M80 78 V 56" />
      <path d="M77 56 H 83" />
      <path d="M14 78 H 86" />
    </g>
  </svg>
);

const LocationMark = () => (
  <svg width="140" height="140" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="50" cy="50" r="42" opacity="0.18" />
    <circle cx="50" cy="50" r="32" opacity="0.3" />
    <path d="M50 18 C 36 18 26 28 26 42 C 26 58 50 82 50 82 C 50 82 74 58 74 42 C 74 28 64 18 50 18 Z" />
    <circle cx="50" cy="42" r="7" />
  </svg>
);

const NotifyMark = () => (
  <svg width="140" height="140" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="50" cy="50" r="42" opacity="0.18" />
    <path d="M30 64 V 50 C 30 38 39 28 50 28 C 61 28 70 38 70 50 V 64 L 76 70 H 24 Z" />
    <path d="M44 76 a 6 6 0 0 0 12 0" />
    <path d="M50 22 V 18" />
    <path d="M14 38 a 16 16 0 0 1 8 -10" opacity="0.5" />
    <path d="M86 38 a 16 16 0 0 0 -8 -10" opacity="0.5" />
  </svg>
);

const MethodMark = () => (
  <svg width="140" height="140" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="50" cy="50" r="42" opacity="0.18" />
    <circle cx="50" cy="50" r="34" />
    <path d="M50 16 V 84" />
    <path d="M16 50 H 84" />
    <path d="M26 26 L 74 74" opacity="0.5" />
    <path d="M74 26 L 26 74" opacity="0.5" />
    <circle cx="50" cy="50" r="6" fill="currentColor" />
  </svg>
);

const DoneMark = () => (
  <svg width="140" height="140" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="50" cy="50" r="42" opacity="0.2" />
    <circle cx="50" cy="50" r="32" />
    <path d="M34 52 L 46 64 L 68 38" />
  </svg>
);

const MARKS = {
  hero: HeroMark,
  location: LocationMark,
  notify: NotifyMark,
  method: MethodMark,
  done: DoneMark,
};

export default function Onboarding({
  onLocate,
  onManualLocation,
  onAllowNotifications,
  onMethodChange,
  initialMethodId = 'MuslimWorldLeague',
  onComplete,
}) {
  const [step, setStep] = useState(0);
  const [method, setMethod] = useState(initialMethodId);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null); // {kind:'error'|'success', text, hint?}
  const panel = PANELS[step];
  const Mark = MARKS[panel.id];
  const isDone = step === PANELS.length - 1;

  const next = () => {
    setStatus(null);
    setStep((s) => Math.min(s + 1, PANELS.length - 1));
  };
  const skip = () => {
    setStatus(null);
    setStep(PANELS.length - 1);
  };

  const handlePrimary = async () => {
    if (busy) return;
    setStatus(null);
    if (panel.id === 'location') {
      setBusy(true);
      try {
        const result = await onLocate?.();
        if (result?.ok) {
          next();
        } else if (result?.reason === 'denied') {
          setStatus({
            kind: 'error',
            text: 'Location access was denied.',
            hint: 'Open iOS Settings → Privacy → Location → Azan Times to allow it, or tap "Enter manually" below.',
          });
        } else if (result?.reason === 'unsupported') {
          setStatus({ kind: 'error', text: 'Location is not available on this device.', hint: 'Tap "Enter manually" to search by city.' });
        } else {
          setStatus({ kind: 'error', text: 'Could not get your location.', hint: 'Try again or tap "Enter manually" below.' });
        }
      } finally {
        setBusy(false);
      }
      return;
    }
    if (panel.id === 'notify') {
      setBusy(true);
      try {
        const result = await onAllowNotifications?.();
        if (result?.ok) {
          next();
        } else if (result?.reason === 'denied' || result?.reason === 'denied-previously') {
          setStatus({
            kind: 'error',
            text: 'Notifications are disabled.',
            hint: 'Open iOS Settings → Notifications → Azan Times to enable, or continue without reminders.',
          });
        } else {
          setStatus({ kind: 'error', text: 'Could not enable notifications.', hint: 'You can turn them on later in Settings.' });
        }
      } finally {
        setBusy(false);
      }
      return;
    }
    if (panel.id === 'method') {
      onMethodChange?.(method);
      next();
      return;
    }
    if (panel.id === 'done') {
      onComplete?.();
      return;
    }
    next();
  };

  const handleSecondary = () => {
    if (panel.id === 'location') onManualLocation?.();
    next();
  };

  return (
    <div className="onboarding" role="dialog" aria-modal="true">
      <div className="onb-progress-row">
        <div className="onb-dots">
          {PANELS.map((_, i) => (
            <div
              key={i}
              className={`onb-dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}
            />
          ))}
        </div>
        {!isDone && step > 0 && (
          <button type="button" className="onb-skip" onClick={skip}>
            Skip
          </button>
        )}
      </div>

      <div className="onb-art">
        <div className="onb-halo" aria-hidden="true" />
        <div className="onb-mark">
          <Mark />
        </div>
      </div>

      <div className="onb-copy">
        <div className="onb-eyebrow">{panel.eyebrow}</div>
        <h2 className="onb-title">{panel.title}</h2>
        <div className="onb-arabic">{panel.arabic}</div>
        <p className="onb-body">{panel.body}</p>
      </div>

      {panel.id === 'method' && (
        <div className="onb-methods">
          {METHODS.map((m) => {
            const on = method === m.id;
            return (
              <button
                key={m.id}
                type="button"
                className={`onb-method ${on ? 'on' : ''}`}
                onClick={() => setMethod(m.id)}
              >
                <span className={`onb-radio ${on ? 'on' : ''}`}>
                  {on && (
                    <svg width="10" height="10" viewBox="0 0 10 10">
                      <path d="M2 5 L4 7 L8 3" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="onb-method-text">
                  <span className="onb-method-name">{m.name}</span>
                  <span className="onb-method-note">{m.note}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {panel.id === 'notify' && (
        <div className="onb-private-card">
          <div className="onb-private-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11 V 7 a 5 5 0 0 1 10 0 V 11" />
            </svg>
          </div>
          <div>
            <div className="onb-private-title">Private by default</div>
            <div className="onb-private-body">Reminders fire locally. No tracking, no account, no servers.</div>
          </div>
        </div>
      )}

      {status && (
        <div className={`onb-status ${status.kind}`} role="alert">
          <div className="onb-status-text">{status.text}</div>
          {status.hint && <div className="onb-status-hint">{status.hint}</div>}
        </div>
      )}

      <div className="onb-spacer" />

      <div className="onb-actions">
        <button type="button" className="onb-cta" onClick={handlePrimary} disabled={busy}>
          {busy ? 'Working…' : panel.cta}
        </button>
        {panel.sub && (
          <button type="button" className="onb-sub" onClick={handleSecondary} disabled={busy}>
            {panel.sub}
          </button>
        )}
      </div>
    </div>
  );
}
