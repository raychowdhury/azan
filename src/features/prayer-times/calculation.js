import {
  CalculationMethod,
  Coordinates,
  HighLatitudeRule,
  Madhab,
  PrayerTimes,
} from 'adhan';

export const PRAYER_KEYS = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

export const METHOD_OPTIONS = [
  { id: 'MuslimWorldLeague', apiId: '3', label: 'Muslim World League', description: 'Common global default' },
  { id: 'NorthAmerica', apiId: '2', label: 'ISNA (North America)', description: 'United States and Canada' },
  { id: 'Karachi', apiId: '1', label: 'University of Islamic Sciences, Karachi', description: 'Pakistan and South Asia' },
  { id: 'UmmAlQura', apiId: '4', label: 'Umm Al-Qura University, Makkah', description: 'Saudi Arabia' },
  { id: 'Egyptian', apiId: '5', label: 'Egyptian General Authority of Survey', description: 'Egypt, Syria, Iraq, Lebanon, Malaysia' },
  { id: 'Tehran', apiId: '7', label: 'Institute of Geophysics, Tehran', description: 'Iran' },
  { id: 'Dubai', apiId: '8', label: 'Dubai', description: 'United Arab Emirates' },
  { id: 'Kuwait', apiId: '9', label: 'Kuwait', description: 'Kuwait' },
  { id: 'Qatar', apiId: '10', label: 'Qatar', description: 'Qatar' },
  { id: 'Singapore', apiId: '11', label: 'Singapore', description: 'Singapore' },
  { id: 'Turkey', apiId: '13', label: 'Diyanet - Turkey', description: 'Turkey' },
  { id: 'MoonsightingCommittee', apiId: '15', label: 'Moonsighting Committee Worldwide', description: 'High-latitude friendly' },
  { id: 'Other', apiId: '3', label: 'Custom angles', description: 'Set Fajr and Isha angles manually' },
];

export const DEFAULT_PRAYER_SETTINGS = {
  methodId: 'MuslimWorldLeague',
  madhab: 'shafi',
  highLatitudeRule: '',
  fajrAngle: 18,
  ishaAngle: 17,
  ishaInterval: '',
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
  Other: () => CalculationMethod.Other(),
};

function withMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000);
}

export function methodToApiId(methodId) {
  return METHOD_OPTIONS.find(method => method.id === methodId)?.apiId ?? '3';
}

export function normalizePrayerSettings(raw = {}) {
  return {
    ...DEFAULT_PRAYER_SETTINGS,
    ...raw,
    manualOffsets: {
      ...DEFAULT_PRAYER_SETTINGS.manualOffsets,
      ...(raw.manualOffsets ?? {}),
    },
  };
}

export function computePrayerTimes(date, coords, rawSettings) {
  const settings = normalizePrayerSettings(rawSettings);
  const factory = METHOD_FACTORY[settings.methodId] ?? METHOD_FACTORY.MuslimWorldLeague;
  const params = factory();

  if (settings.methodId === 'Other') {
    if (settings.fajrAngle !== '') params.fajrAngle = Number(settings.fajrAngle);
    if (settings.ishaAngle !== '') params.ishaAngle = Number(settings.ishaAngle);
    if (settings.ishaInterval !== '') params.ishaInterval = Number(settings.ishaInterval);
  }

  params.madhab = settings.madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;

  if (settings.highLatitudeRule && HighLatitudeRule[settings.highLatitudeRule]) {
    params.highLatitudeRule = HighLatitudeRule[settings.highLatitudeRule];
  }

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

export function buildComputedDay(apiDay, coords, settings) {
  if (!coords?.lat || !coords?.lng) {
    return {
      ...apiDay,
      timings: applyManualOffsetsToTimings(apiDay.timings, settings),
    };
  }

  return {
    ...apiDay,
    timings: {
      ...apiDay.timings,
      ...datesToTimings(computePrayerTimes(new Date(), coords, settings)),
    },
  };
}
