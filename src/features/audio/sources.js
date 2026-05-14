// Central registry for in-app Adhan playback sources.
//
// All sources here are bundled with the app — no third-party network
// dependencies. Playback only happens while the app is in the foreground;
// scheduled iOS Local Notifications use the short .wav files in
// ios/App/App/NotificationSounds/ for actual at-prayer-time alerts.
//
// SOURCES:
//   Adhan Chime — short adhan-style chime, bundled (adhan_chime.wav).
//   Beep        — single short tone, bundled (beep.wav).
//   Silent      — no audio. Notifications still fire if enabled.

const DOHA_FILES = {
  Fajr:    '/adhan/01_Fajr.mp3',
  Dhuhr:   '/adhan/02_Dhuhr.mp3',
  Asr:     '/adhan/03_Asr.mp3',
  Maghrib: '/adhan/04_Maghrib.mp3',
  Isha:    '/adhan/05_Isha.mp3',
};

export const ADHAN_SOURCES = [
  {
    id: 'doha',
    label: 'Doha Adhan',
    description: 'Full Adhan recorded in Doha, Qatar. Public Domain (archive.org).',
    urlFor: (prayer) => DOHA_FILES[prayer] || DOHA_FILES.Dhuhr,
    verified: true,
  },
  {
    id: 'adhan_chime',
    label: 'Adhan Chime',
    description: 'Bundled short adhan chime — plays when app is open.',
    urlFor: () => '/adhan_chime.wav',
    builtin: 'adhan_chime',
    verified: true,
  },
  {
    id: 'beep',
    label: 'Beep',
    description: 'Short bundled tone.',
    urlFor: () => '/beep.wav',
    builtin: 'beep',
    verified: true,
  },
  {
    id: 'silent',
    label: 'Silent',
    description: 'No audio playback.',
    urlFor: () => null,
    builtin: 'silent',
    verified: true,
  },
];

// Default to the full Doha Adhan (public domain).
export const DEFAULT_ADHAN_SOURCE = 'doha';

// Map legacy ids saved by previous builds onto current sources.
const LEGACY_ID_MAP = {
  mishary:  'doha',
  makkah:   'doha',
  madinah:  'doha',
  egyptian: 'doha',
  turkish:  'doha',
  adhan1:   'doha',
  adhan2:   'doha',
  adhan3:   'doha',
  adhan4:   'doha',
  adhan5:   'doha',
};

export function normalizeAdhanSourceId(id) {
  if (!id) return DEFAULT_ADHAN_SOURCE;
  if (LEGACY_ID_MAP[id]) return LEGACY_ID_MAP[id];
  return ADHAN_SOURCES.some(s => s.id === id) ? id : DEFAULT_ADHAN_SOURCE;
}

export function getAdhanSource(id) {
  return ADHAN_SOURCES.find(source => source.id === id) ?? ADHAN_SOURCES[0];
}

export function adhanUrlFor(sourceId, prayerKey) {
  const source = getAdhanSource(sourceId);
  return source.urlFor(prayerKey);
}
