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

export const ADHAN_SOURCES = [
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

// Default to the bundled adhan chime.
export const DEFAULT_ADHAN_SOURCE = 'adhan_chime';

// Map legacy ids saved by previous builds onto the new bundled ids.
const LEGACY_ID_MAP = {
  mishary:  'adhan_chime',
  makkah:   'adhan_chime',
  madinah:  'adhan_chime',
  egyptian: 'adhan_chime',
  turkish:  'adhan_chime',
  adhan1:   'adhan_chime',
  adhan2:   'adhan_chime',
  adhan3:   'adhan_chime',
  adhan4:   'adhan_chime',
  adhan5:   'adhan_chime',
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
  if (source.builtin) return null;
  return source.urlFor(prayerKey);
}
