// Sky palette per prayer period — drives the hero gradient + accent color
// so the app visually tracks the sun through the day.

export const SKY = {
  fajr: {
    grad: 'linear-gradient(160deg, #1a1f3d 0%, #2d2547 45%, #6e3a5a 100%)',
    gradLight: 'linear-gradient(160deg, #3d4570 0%, #6e5a82 50%, #d59ba8 100%)',
    sun: '#c97a8a', glow: 'rgba(201,122,138,0.35)', name: 'Fajr',
  },
  sunrise: {
    grad: 'linear-gradient(160deg, #2a1810 0%, #6b3a1f 40%, #d97a3a 100%)',
    gradLight: 'linear-gradient(160deg, #ffd9b8 0%, #ffb87a 50%, #ff8c4a 100%)',
    sun: '#f4a060', glow: 'rgba(244,160,96,0.40)', name: 'Sunrise',
  },
  dhuhr: {
    grad: 'linear-gradient(160deg, #1e3a5f 0%, #2c5a8a 50%, #5b9bd5 100%)',
    gradLight: 'linear-gradient(160deg, #87ceeb 0%, #b8dde9 50%, #e8f4fa 100%)',
    sun: '#ffd84a', glow: 'rgba(255,216,74,0.45)', name: 'Dhuhr',
  },
  asr: {
    grad: 'linear-gradient(160deg, #1a4d3a 0%, #1f5a3d 40%, #4a6f3a 100%)',
    gradLight: 'linear-gradient(160deg, #fce8b8 0%, #f5d088 50%, #d9a85c 100%)',
    sun: '#e8b85a', glow: 'rgba(232,184,90,0.38)', name: 'Asr',
  },
  maghrib: {
    grad: 'linear-gradient(160deg, #2a1530 0%, #6b2848 40%, #c9485e 100%)',
    gradLight: 'linear-gradient(160deg, #f7c5b8 0%, #e89a8a 40%, #c9485e 100%)',
    sun: '#e07560', glow: 'rgba(224,117,96,0.40)', name: 'Maghrib',
  },
  isha: {
    grad: 'linear-gradient(160deg, #060a18 0%, #0e1530 50%, #1f2a4a 100%)',
    gradLight: 'linear-gradient(160deg, #1a2244 0%, #2a3458 50%, #4a5a8a 100%)',
    sun: '#9bb5ff', glow: 'rgba(155,181,255,0.30)', name: 'Isha',
  },
};

export const SKY_ORDER = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];

const toMinutes = (str) => {
  if (!str) return null;
  const clean = String(str).replace(/\s*\(.*\)/, '').trim();
  const m = clean.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
};

// Pick active sky from the day's timings + a Date.
// timings: { Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha } in 24h "HH:MM"
export function getActiveSky(timings, now = new Date()) {
  if (!timings) return 'dhuhr';
  const stops = SKY_ORDER.map((k) => {
    const tKey = k.charAt(0).toUpperCase() + k.slice(1);
    return { k, t: toMinutes(timings[tKey]) };
  }).filter((s) => s.t != null);
  if (!stops.length) return 'dhuhr';
  const cur = now.getHours() * 60 + now.getMinutes();
  for (let i = 0; i < stops.length; i++) {
    const a = stops[i].t;
    const b = stops[i + 1] ? stops[i + 1].t : 24 * 60 + stops[0].t;
    if (cur >= a && cur < b) return stops[i].k;
  }
  return 'isha';
}
