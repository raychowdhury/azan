// Central registry for in-app Adhan playback sources.
//
// Notification sounds (short, bundled .wav files used by iOS) live in
// src/features/notifications/settings.js — those have a 30-second iOS limit
// and must be present in the app bundle. The sources below are full Adhan
// audio streamed from a CDN and only play while the app is open.
//
// LICENSING NOTE: Verify the licensing/attribution requirements for each
// reciter before shipping new sources. The Islamic Network CDN
// (cdn.islamic.network) provides public Adhan audio commonly used in
// open-source Islamic apps. If you add a new reciter, confirm the source
// permits redistribution or hot-linking and add attribution where required.

const ISLAMIC_NETWORK_BASE = 'https://cdn.islamic.network/prayer-times/audio';

// Per-prayer Mishary Al-Afasy recordings (verified working at v1.0.0).
function misharyUrl(prayerKey) {
  return `${ISLAMIC_NETWORK_BASE}/Mishary_Rashid_Alafasy/mp3/${prayerKey}.mp3`;
}

// Single-track sources — same Adhan plays regardless of prayer.
// VERIFY: confirm exact CDN path + licensing before enabling for production.
function staticUrl(filename) {
  return () => `${ISLAMIC_NETWORK_BASE}/${filename}`;
}

export const ADHAN_SOURCES = [
  {
    id: 'mishary',
    label: 'Mishary Al-Afasy',
    description: 'Per-prayer recordings (default).',
    urlFor: misharyUrl,
    attribution: 'Islamic Network CDN',
  },
  {
    id: 'makkah',
    label: 'Makkah',
    description: 'Adhan from Masjid al-Haram.',
    // VERIFY: Confirm canonical path and licensing for the Makkah recording.
    urlFor: staticUrl('Adhan_Makkah/mp3/Adhan.mp3'),
    attribution: 'Islamic Network CDN',
    unverified: true,
  },
  {
    id: 'madinah',
    label: 'Madinah',
    description: 'Adhan from Masjid an-Nabawi.',
    // VERIFY: Confirm canonical path and licensing.
    urlFor: staticUrl('Adhan_Madinah/mp3/Adhan.mp3'),
    attribution: 'Islamic Network CDN',
    unverified: true,
  },
  {
    id: 'egyptian',
    label: 'Egyptian',
    description: 'Classical Egyptian-style Adhan.',
    // VERIFY: Confirm canonical path and licensing.
    urlFor: staticUrl('Adhan_Egyptian/mp3/Adhan.mp3'),
    attribution: 'Islamic Network CDN',
    unverified: true,
  },
  {
    id: 'turkish',
    label: 'Turkish',
    description: 'Turkish-style Adhan.',
    // VERIFY: Confirm canonical path and licensing.
    urlFor: staticUrl('Adhan_Turkish/mp3/Adhan.mp3'),
    attribution: 'Islamic Network CDN',
    unverified: true,
  },
  {
    id: 'beep',
    label: 'Beep',
    description: 'Short tone instead of full Adhan.',
    urlFor: () => null,
    builtin: 'beep',
  },
  {
    id: 'silent',
    label: 'Silent',
    description: 'No audio playback.',
    urlFor: () => null,
    builtin: 'silent',
  },
];

export const DEFAULT_ADHAN_SOURCE = 'mishary';

export function getAdhanSource(id) {
  return ADHAN_SOURCES.find(source => source.id === id) ?? ADHAN_SOURCES[0];
}

export function adhanUrlFor(sourceId, prayerKey) {
  const source = getAdhanSource(sourceId);
  return source.urlFor(prayerKey);
}
