import { describe, expect, it } from 'vitest';
import { computePrayerTimes, DEFAULT_PRAYER_SETTINGS } from '../src/features/prayer-times/calculation.js';

// Reference times captured from the Aladhan public API for 15 May 2026
// (school=0 / shafi), one city per calculation method we ship by country.
// Same source the app falls back to for `fetchByCity` / `fetchByCoords`, so
// our local `computePrayerTimes` should agree with it within rounding noise.
//
// To refresh: hit
//   https://api.aladhan.com/v1/timings/15-05-2026?latitude=<lat>&longitude=<lng>&method=<id>&school=0
// with each row's coords/method id and paste the timings back in.
const REFERENCES = [
  {
    label: 'NYC (NorthAmerica / ISNA)',
    coords: { lat: 40.7128, lng: -74.0060 },
    tz: 'America/New_York',
    methodId: 'NorthAmerica',
    expected: { Fajr: '04:08', Sunrise: '05:39', Dhuhr: '12:52', Asr: '16:48', Maghrib: '20:06', Isha: '21:37' },
  },
  {
    label: 'Makkah (UmmAlQura)',
    coords: { lat: 21.4225, lng: 39.8262 },
    tz: 'Asia/Riyadh',
    methodId: 'UmmAlQura',
    expected: { Fajr: '04:19', Sunrise: '05:42', Dhuhr: '12:17', Asr: '15:34', Maghrib: '18:52', Isha: '20:22' },
  },
  {
    // Cairo instead of London — at 51° lat MWL Fajr/Isha cross 18° below horizon
    // and the two implementations apply different high-latitude rules, which
    // is a separate calibration concern from base method correctness.
    label: 'Cairo (MuslimWorldLeague)',
    coords: { lat: 30.0444, lng: 31.2357 },
    tz: 'Africa/Cairo',
    methodId: 'MuslimWorldLeague',
    expected: { Fajr: '04:31', Sunrise: '06:02', Dhuhr: '12:51', Asr: '16:28', Maghrib: '19:41', Isha: '21:07' },
  },
  {
    label: 'Karachi (Karachi)',
    coords: { lat: 24.8607, lng: 67.0011 },
    tz: 'Asia/Karachi',
    methodId: 'Karachi',
    expected: { Fajr: '04:24', Sunrise: '05:48', Dhuhr: '12:28', Asr: '15:54', Maghrib: '19:09', Isha: '20:33' },
  },
  {
    label: 'Istanbul (Turkey / Diyanet)',
    coords: { lat: 41.0082, lng: 28.9784 },
    tz: 'Europe/Istanbul',
    methodId: 'Turkey',
    expected: { Fajr: '03:53', Sunrise: '05:39', Dhuhr: '13:05', Asr: '17:00', Maghrib: '20:22', Isha: '22:01' },
  },
];

const REFERENCE_DATE = new Date(Date.UTC(2026, 4, 15, 12, 0, 0));
const TOLERANCE_MIN = 3;

function formatLocalHM(date, tz) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t).value;
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${hour}:${get('minute')}`;
}

function minutesOf(hm) {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}

function wrappedDiffMin(a, b) {
  const diff = Math.abs(minutesOf(a) - minutesOf(b));
  return Math.min(diff, 24 * 60 - diff);
}

describe('Prayer times cross-reference vs Aladhan (15 May 2026)', () => {
  for (const ref of REFERENCES) {
    it(`${ref.label} matches Aladhan within ±${TOLERANCE_MIN} min`, () => {
      const settings = { ...DEFAULT_PRAYER_SETTINGS, methodId: ref.methodId };
      const times = computePrayerTimes(REFERENCE_DATE, ref.coords, settings);

      for (const [key, expected] of Object.entries(ref.expected)) {
        const got = formatLocalHM(times[key], ref.tz);
        const diff = wrappedDiffMin(got, expected);
        expect(
          diff,
          `${ref.label} ${key}: got ${got}, expected ${expected} (Δ${diff} min)`,
        ).toBeLessThanOrEqual(TOLERANCE_MIN);
      }
    });
  }

  it('all prayers are in ascending order across the day', () => {
    const settings = { ...DEFAULT_PRAYER_SETTINGS, methodId: 'NorthAmerica' };
    const t = computePrayerTimes(REFERENCE_DATE, { lat: 40.7128, lng: -74.0060 }, settings);
    expect(t.Fajr.getTime()).toBeLessThan(t.Sunrise.getTime());
    expect(t.Sunrise.getTime()).toBeLessThan(t.Dhuhr.getTime());
    expect(t.Dhuhr.getTime()).toBeLessThan(t.Asr.getTime());
    expect(t.Asr.getTime()).toBeLessThan(t.Maghrib.getTime());
    expect(t.Maghrib.getTime()).toBeLessThan(t.Isha.getTime());
  });

  it('NorthAmerica (15° Isha) fires earlier than MuslimWorldLeague (17°) in NYC', () => {
    const coords = { lat: 40.7128, lng: -74.0060 };
    const na = computePrayerTimes(REFERENCE_DATE, coords, { ...DEFAULT_PRAYER_SETTINGS, methodId: 'NorthAmerica' });
    const mwl = computePrayerTimes(REFERENCE_DATE, coords, { ...DEFAULT_PRAYER_SETTINGS, methodId: 'MuslimWorldLeague' });
    expect(na.Isha.getTime()).toBeLessThan(mwl.Isha.getTime());
  });
});
