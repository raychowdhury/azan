const PRAYER_KEYS = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

export const NOTIFICATION_SOUNDS = [
  { id: 'adhan_chime', label: 'Adhan cue', file: 'adhan_chime.wav' },
  { id: 'beep', label: 'Beep', file: 'beep.wav' },
  { id: 'silent', label: 'Silent', file: '' },
];

export function defaultNotificationSettings(legacyMinutes = 10) {
  return Object.fromEntries(
    PRAYER_KEYS.map(key => [
      key,
      {
        enabled: key !== 'Sunrise',
        sound: 'adhan_chime',
        preReminderMinutes: legacyMinutes,
        vibrateOnly: false,
      },
    ]),
  );
}

export function normalizeNotificationSettings(raw, legacyMinutes = 10) {
  const defaults = defaultNotificationSettings(legacyMinutes);
  return Object.fromEntries(
    PRAYER_KEYS.map(key => [
      key,
      {
        ...defaults[key],
        ...(raw?.[key] ?? {}),
        preReminderMinutes: Number(raw?.[key]?.preReminderMinutes ?? defaults[key].preReminderMinutes),
        enabled: Boolean(raw?.[key]?.enabled ?? defaults[key].enabled),
        vibrateOnly: Boolean(raw?.[key]?.vibrateOnly ?? defaults[key].vibrateOnly),
      },
    ]),
  );
}

export function soundFileForNotification(soundId, vibrateOnly = false) {
  if (vibrateOnly || soundId === 'silent') return undefined;
  return NOTIFICATION_SOUNDS.find(sound => sound.id === soundId)?.file;
}
