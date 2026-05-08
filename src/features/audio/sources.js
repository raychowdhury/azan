// Central registry for in-app Adhan playback sources.
//
// Notification sounds (short, bundled .wav files used by iOS) live in
// src/features/notifications/settings.js — those have a 30-second iOS limit
// and must be present in the iOS app bundle. The sources below are full
// Adhan audio that only play while the app is open.
//
// URL VERIFICATION HISTORY (v1.1.0):
//   The original v1.0 path
//     https://cdn.islamic.network/prayer-times/audio/Mishary_Rashid_Alafasy/...
//   returns HTTP 403 (bucket access denied). islamic.network only serves
//   Quran audio publicly (cdn.islamic.network/quran/audio/...), not Adhan.
//   v1.1.0 falls back to islamcan.com which returns 200 / audio/mpeg for
//   azan1.mp3 ... azan9.mp3. URLs are reachable but the *voice mapping*
//   (which file is Mishary vs Makkah vs Madinah, etc.) is not authoritative.
//
// LICENSING NOTE: Verify licensing/attribution for each track before
// shipping a marketing claim of a specific reciter. Until verified, leave
// `unverified: true` so the UI shows "(preview)" and the privacy/marketing
// copy avoids naming the reciter.
//
// LOCAL FALLBACKS: `Beep` plays public/beep.wav (also bundled in iOS as a
// notification sound). `Silent` performs no playback.

const ISLAMCAN = 'https://www.islamcan.com/audio/adhan';

// All reciter-named tracks reuse the same online catalog until each voice
// is verified and remapped. Keep the function form so we can swap to a
// per-prayer template later (as v1.0 attempted) without changing callers.
function islamcanTrack(filename) {
  return () => `${ISLAMCAN}/${filename}`;
}

export const ADHAN_SOURCES = [
  {
    id: 'mishary',
    label: 'Mishary Al-Afasy',
    description: 'Default Adhan recording.',
    urlFor: islamcanTrack('azan1.mp3'),
    attribution: 'islamcan.com',
    unverified: true, // verify voice mapping + licensing before release
  },
  {
    id: 'makkah',
    label: 'Makkah',
    description: 'Adhan from Masjid al-Haram (placeholder track).',
    urlFor: islamcanTrack('azan2.mp3'),
    attribution: 'islamcan.com',
    unverified: true,
  },
  {
    id: 'madinah',
    label: 'Madinah',
    description: 'Adhan from Masjid an-Nabawi (placeholder track).',
    urlFor: islamcanTrack('azan3.mp3'),
    attribution: 'islamcan.com',
    unverified: true,
  },
  {
    id: 'egyptian',
    label: 'Egyptian',
    description: 'Classical Egyptian-style Adhan (placeholder track).',
    urlFor: islamcanTrack('azan4.mp3'),
    attribution: 'islamcan.com',
    unverified: true,
  },
  {
    id: 'turkish',
    label: 'Turkish',
    description: 'Turkish-style Adhan (placeholder track).',
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

// Default to the bundled Beep so first-run plays a verified, offline sound.
// Users can switch to a named (unverified) reciter from settings.
export const DEFAULT_ADHAN_SOURCE = 'beep';

export function getAdhanSource(id) {
  return ADHAN_SOURCES.find(source => source.id === id) ?? ADHAN_SOURCES[0];
}

export function adhanUrlFor(sourceId, prayerKey) {
  const source = getAdhanSource(sourceId);
  if (source.builtin) return null;
  return source.urlFor(prayerKey);
}
