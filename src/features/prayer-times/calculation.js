import {
  CalculationMethod,
  Coordinates,
  HighLatitudeRule,
  Madhab,
  PrayerTimes,
} from 'adhan';

export const PRAYER_KEYS = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

export const METHOD_OPTIONS = [
  { id: 'MuslimWorldLeague', apiId: '3', label: 'Muslim World League', authority: 'Muslim World League' },
  { id: 'NorthAmerica', apiId: '2', label: 'ISNA (North America)', authority: 'Islamic Society of North America' },
  { id: 'Karachi', apiId: '1', label: 'University of Islamic Sciences, Karachi', authority: 'University of Islamic Sciences, Karachi' },
  { id: 'UmmAlQura', apiId: '4', label: 'Umm Al-Qura University, Makkah', authority: 'Umm Al-Qura University, Makkah' },
  { id: 'Egyptian', apiId: '5', label: 'Egyptian General Authority of Survey', authority: 'Egyptian General Authority of Survey' },
  { id: 'Tehran', apiId: '7', label: 'Institute of Geophysics, Tehran', authority: 'Institute of Geophysics, University of Tehran' },
  { id: 'Dubai', apiId: '8', label: 'Dubai', authority: 'Dubai' },
  { id: 'Kuwait', apiId: '9', label: 'Kuwait', authority: 'Kuwait' },
  { id: 'Qatar', apiId: '10', label: 'Qatar', authority: 'Qatar' },
  { id: 'Singapore', apiId: '11', label: 'Singapore', authority: 'Majlis Ugama Islam Singapura' },
  { id: 'Turkey', apiId: '13', label: 'Diyanet - Turkey', authority: 'Diyanet, Turkey' },
  { id: 'MoonsightingCommittee', apiId: '15', label: 'Moonsighting Committee Worldwide', authority: 'Moonsighting Committee Worldwide' },
];

// Country (ISO 3166-1 alpha-2) → calculation method id mapping.
// Mirrors what mainstream prayer apps (Athan Pro, Muslim Pro, Pillars) pick
// based on the user's country. Falls back to MuslimWorldLeague when unknown.
const COUNTRY_TO_METHOD = {
  // GCC + Saudi-influenced
  SA: 'UmmAlQura', KW: 'Kuwait', QA: 'Qatar', AE: 'Dubai',
  OM: 'UmmAlQura', BH: 'Kuwait', YE: 'UmmAlQura',
  // North Africa + Levant + Egyptian umbrella
  EG: 'Egyptian', SD: 'Egyptian', LY: 'Egyptian', TN: 'Egyptian',
  DZ: 'Egyptian', MA: 'Egyptian', SY: 'Egyptian', JO: 'Egyptian',
  PS: 'Egyptian', LB: 'Egyptian', IQ: 'Egyptian',
  // South Asia
  PK: 'Karachi', BD: 'Karachi', IN: 'Karachi', LK: 'Karachi',
  NP: 'Karachi', AF: 'Karachi',
  // North America
  US: 'NorthAmerica', CA: 'NorthAmerica', MX: 'NorthAmerica',
  // Turkey
  TR: 'Turkey',
  // SE Asia
  ID: 'Singapore', MY: 'Singapore', SG: 'Singapore', BN: 'Singapore',
  // Iran
  IR: 'Tehran',
};

export function methodForCountry(countryCode) {
  if (!countryCode) return null;
  return COUNTRY_TO_METHOD[String(countryCode).toUpperCase()] || null;
}

export const DEFAULT_PRAYER_SETTINGS = {
  methodId: 'MuslimWorldLeague',
  madhab: 'shafi',
  highLatitudeRule: '',
  fajrAngle: 18,
  ishaAngle: 17,
  ishaInterval: '',
  // True once user has explicitly confirmed the calculation method
  // (via onboarding or Settings). While false, an auto-detected country
  // map can override the default — but never overwrites a manual choice.
  methodAutoConfirmed: false,
  manualOffsets: {
    Fajr: 0,
    Sunrise: 0,
    Dhuhr: 0,
    Asr: 0,
    Maghrib: 0,
    Isha: 0,
  },
};

const METHOD_FACTORY = {
  MuslimWorldLeague: () => CalculationMethod.MuslimWorldLeague(),
  Egyptian: () => CalculationMethod.Egyptian(),
  Karachi: () => CalculationMethod.Karachi(),
  UmmAlQura: () => CalculationMethod.UmmAlQura(),
  Dubai: () => CalculationMethod.Dubai(),
  MoonsightingCommittee: () => CalculationMethod.MoonsightingCommittee(),
  NorthAmerica: () => CalculationMethod.NorthAmerica(),
  Kuwait: () => CalculationMethod.Kuwait(),
  Qatar: () => CalculationMethod.Qatar(),
  Singapore: () => CalculationMethod.Singapore(),
  Turkey: () => CalculationMethod.Turkey(),
  Tehran: () => CalculationMethod.Tehran(),
};

function withMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000);
}

function calculationParamsFor(rawSettings) {
  const settings = normalizePrayerSettings(rawSettings);
  const factory = METHOD_FACTORY[settings.methodId] ?? METHOD_FACTORY.MuslimWorldLeague;
  const params = factory();

  params.madhab = settings.madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;

  if (settings.highLatitudeRule && HighLatitudeRule[settings.highLatitudeRule]) {
    params.highLatitudeRule = HighLatitudeRule[settings.highLatitudeRule];
  }

  return params;
}

function angleLabel(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? `${numeric}°` : null;
}

export function getCalculationMethodDetails(methodId) {
  const option = METHOD_OPTIONS.find(method => method.id === methodId) ?? METHOD_OPTIONS[0];
  const params = (METHOD_FACTORY[option.id] ?? METHOD_FACTORY.MuslimWorldLeague)();
  const fajr = angleLabel(params.fajrAngle) ?? 'Method default';
  const isha = Number(params.ishaInterval) > 0
    ? `${params.ishaInterval} min after Maghrib`
    : angleLabel(params.ishaAngle) ?? 'Method default';

  return {
    ...option,
    fajr,
    isha,
    summary: `${option.authority} · Fajr ${fajr} · Isha ${isha}`,
  };
}

export function getCalculationMethodOptionLabel(methodId) {
  const details = getCalculationMethodDetails(methodId);
  return `${details.label} — Fajr ${details.fajr}; Isha ${details.isha}; ${details.authority}`;
}

export function methodToApiId(methodId) {
  return METHOD_OPTIONS.find(method => method.id === methodId)?.apiId ?? '3';
}

export function madhabToApiSchool(madhab) {
  return madhab === 'hanafi' ? '1' : '0';
}

export function normalizePrayerSettings(raw = {}) {
  const methodId = METHOD_OPTIONS.some(method => method.id === raw.methodId)
    ? raw.methodId
    : DEFAULT_PRAYER_SETTINGS.methodId;

  return {
    ...DEFAULT_PRAYER_SETTINGS,
    ...raw,
    methodId,
    manualOffsets: {
      ...DEFAULT_PRAYER_SETTINGS.manualOffsets,
      ...(raw.manualOffsets ?? {}),
    },
  };
}

export function computePrayerTimes(date, coords, rawSettings) {
  const settings = normalizePrayerSettings(rawSettings);
  const params = calculationParamsFor(settings);

  const coordinates = new Coordinates(Number(coords.lat), Number(coords.lng));
  const times = new PrayerTimes(coordinates, date, params);

  return {
    Fajr: withMinutes(times.fajr, settings.manualOffsets.Fajr),
    Sunrise: withMinutes(times.sunrise, settings.manualOffsets.Sunrise),
    Dhuhr: withMinutes(times.dhuhr, settings.manualOffsets.Dhuhr),
    Asr: withMinutes(times.asr, settings.manualOffsets.Asr),
    Maghrib: withMinutes(times.maghrib, settings.manualOffsets.Maghrib),
    Isha: withMinutes(times.isha, settings.manualOffsets.Isha),
  };
}

export function datesToTimings(times) {
  return Object.fromEntries(
    Object.entries(times).map(([key, date]) => [
      key,
      `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
    ]),
  );
}

export function applyManualOffsetsToTimings(timings, rawSettings) {
  const settings = normalizePrayerSettings(rawSettings);
  return Object.fromEntries(
    Object.entries(timings).map(([key, value]) => {
      if (!PRAYER_KEYS.includes(key)) return [key, value];
      const clean = String(value).replace(/\s*\(.*\)/, '');
      const [hours, minutes] = clean.split(':').map(Number);
      const adjusted = new Date();
      adjusted.setHours(hours, minutes + settings.manualOffsets[key], 0, 0);
      return [
        key,
        `${String(adjusted.getHours()).padStart(2, '0')}:${String(adjusted.getMinutes()).padStart(2, '0')}`,
      ];
    }),
  );
}

export function buildComputedDay(apiDay, _coords, settings) {
  return {
    ...apiDay,
    timings: applyManualOffsetsToTimings(apiDay.timings, settings),
  };
}

export function buildComputedDays(apiDays, coords, settings) {
  return Array.isArray(apiDays)
    ? apiDays.map(day => buildComputedDay(day, coords, settings))
    : [];
}
