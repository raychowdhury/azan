export const PRAYERS = [
  { key: 'Fajr',    name: 'Fajr',    arabic: 'الفجر',  icon: '🌙', obligatory: true  },
  { key: 'Sunrise', name: 'Sunrise', arabic: 'الشروق', icon: '🌅', obligatory: false },
  { key: 'Dhuhr',   name: 'Dhuhr',   arabic: 'الظهر',  icon: '☀️', obligatory: true  },
  { key: 'Asr',     name: 'Asr',     arabic: 'العصر',  icon: '🌤️', obligatory: true  },
  { key: 'Maghrib', name: 'Maghrib', arabic: 'المغرب', icon: '🌇', obligatory: true  },
  { key: 'Isha',    name: 'Isha',    arabic: 'العشاء', icon: '🌑', obligatory: true  },
];

export const METHODS = [
  { value: '3',  label: 'Muslim World League' },
  { value: '2',  label: 'ISNA (North America)' },
  { value: '1',  label: 'University of Islamic Sciences, Karachi' },
  { value: '4',  label: 'Umm Al-Qura University, Makkah' },
  { value: '5',  label: 'Egyptian General Authority of Survey' },
  { value: '7',  label: 'Institute of Geophysics, Tehran' },
  { value: '8',  label: 'Gulf Region' },
  { value: '9',  label: 'Kuwait' },
  { value: '10', label: 'Qatar' },
  { value: '11', label: 'Majlis Ugama Islam Singapura' },
  { value: '12', label: 'UOIF — France' },
  { value: '13', label: 'DIANET — Turkey' },
  { value: '14', label: 'Spiritual Administration, Russia' },
  { value: '15', label: 'Moonsighting Committee Worldwide' },
];

export function pad(n) {
  return String(n).padStart(2, '0');
}

export function parseTime(timeStr) {
  const clean = timeStr.replace(/\s*\(.*\)/, '');
  const [h, m] = clean.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

export function formatTime(timeStr, use24h = false) {
  const clean = timeStr.replace(/\s*\(.*\)/, '');
  const [h, m] = clean.split(':').map(Number);
  if (use24h) return `${pad(h)}:${pad(m)}`;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${pad(m)} ${ampm}`;
}

export function getNextPrayer(timings) {
  const now = new Date();
  for (const p of PRAYERS) {
    if (!timings[p.key]) continue;
    const pTime = parseTime(timings[p.key]);
    if (pTime > now) return p.key;
  }
  // After Isha — roll over to tomorrow's Fajr
  return timings.Fajr ? 'Fajr' : null;
}

// Returns a JS Date for the next prayer, accounting for after-Isha rollover.
export function getNextPrayerDate(timings, key = getNextPrayer(timings)) {
  if (!key || !timings[key]) return null;
  const target = parseTime(timings[key]);
  if (target <= new Date()) target.setDate(target.getDate() + 1);
  return target;
}

export function getActivePrayer(timings) {
  const now = new Date();
  let active = null;
  for (const p of PRAYERS) {
    if (!timings[p.key]) continue;
    const pTime = parseTime(timings[p.key]);
    if (pTime <= now) active = p.key;
    else break;
  }
  return active;
}

// Calculate bearing from user coords to Makkah
export function calculateQibla(lat, lon) {
  const makkahLat = 21.4225 * (Math.PI / 180);
  const makkahLon = 39.8262 * (Math.PI / 180);
  const userLat = lat * (Math.PI / 180);
  const userLon = lon * (Math.PI / 180);
  const dLon = makkahLon - userLon;
  const y = Math.sin(dLon) * Math.cos(makkahLat);
  const x =
    Math.cos(userLat) * Math.sin(makkahLat) -
    Math.sin(userLat) * Math.cos(makkahLat) * Math.cos(dLon);
  const bearing = Math.atan2(y, x) * (180 / Math.PI);
  return (bearing + 360) % 360;
}

// Returns progress % and prev/next prayer keys
export function getPrayerProgress(timings) {
  const now = new Date();
  const times = PRAYERS.filter(p => timings[p.key]).map(p => ({
    key: p.key,
    time: parseTime(timings[p.key]),
  }));

  for (let i = 1; i < times.length; i++) {
    if (times[i].time > now) {
      const prev = times[i - 1];
      const next = times[i];
      const total = next.time - prev.time;
      const elapsed = now - prev.time;
      return {
        progress: Math.min(100, Math.max(0, (elapsed / total) * 100)),
        prevKey: prev.key,
        nextKey: next.key,
      };
    }
  }
  return null;
}
