// Central registry for in-app Adhan playback sources.
//
// Notification sounds (short, bundled .wav files used by iOS) live in
// src/features/notifications/settings.js — those have a 30-second iOS limit
// and must be present in the iOS app bundle. The sources below are full
// Adhan audio that only play while the app is open.
//
// URL VERIFICATION HISTORY:
//   v1.0 used cdn.islamic.network/prayer-times/audio/... which returns
//   HTTP 403 (bucket access denied — that path does not exist on
//   islamic.network's public CDN). v1.1.0 falls back to islamcan.com which
//   returns 200 / audio/mpeg for azan1.mp3 ... azan9.mp3.
//
// LABELING:
//   Specific reciter or location names (Mishary, Makkah, Madinah, etc.)
//   are NOT used because the voice mapping for each azan{N}.mp3 file is
//   not authoritative. Until each track is verified, options are exposed
//   as generic "Adhan 1 ... Adhan 5" with `unverified: true`.
//
// LOCAL FALLBACKS:
//   Beep   — plays public/beep.wav (also bundled in iOS as a notification
//            sound). Default first-run option.
//   Silent — performs no playback at all. Never fetches network audio.

const ISLAMCAN = 'https://www.islamcan.com/audio/adhan';

function islamcanTrack(filename) {
  return () => `${ISLAMCAN}/${filename}`;
}

export const ADHAN_SOURCES = [
  {
    id: 'adhan1',
    label: 'Adhan 1',
    description: 'Streaming Adhan recording.',
    urlFor: islamcanTrack('azan1.mp3'),
    attribution: 'islamcan.com',
    unverified: true,
  },
  {
    id: 'adhan2',
    label: 'Adhan 2',
    description: 'Streaming Adhan recording.',
    urlFor: islamcanTrack('azan2.mp3'),
    attribution: 'islamcan.com',
    unverified: true,
  },
  {
    id: 'adhan3',
    label: 'Adhan 3',
    description: 'Streaming Adhan recording.',
    urlFor: islamcanTrack('azan3.mp3'),
    attribution: 'islamcan.com',
    unverified: true,
  },
  {
    id: 'adhan4',
    label: 'Adhan 4',
    description: 'Streaming Adhan recording.',
    urlFor: islamcanTrack('azan4.mp3'),
    attribution: 'islamcan.com',
    unverified: true,
  },
  {
    id: 'adhan5',
    label: 'Adhan 5',
    description: 'Streaming Adhan recording.',
    urlFor: islamcanTrack('azan5.mp3'),
    attribution: 'islamcan.com',
    unverified: true,
  },
  {
    id: 'beep',
    label: 'Beep',
    description: 'Short bundled tone.',
    urlFor: () => null,
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

// Default to the bundled Beep — verified, offline, and labeled honestly.
export const DEFAULT_ADHAN_SOURCE = 'beep';

// Map legacy ids saved by previous v1.1.0 builds onto the new generic ids.
const LEGACY_ID_MAP = {
  mishary:  'adhan1',
  makkah:   'adhan2',
  madinah:  'adhan3',
  egyptian: 'adhan4',
  turkish:  'adhan5',
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
