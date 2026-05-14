import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRAYER_SETTINGS,
  normalizePrayerSettings,
} from '../src/features/prayer-times/calculation.js';
import {
  defaultNotificationSettings,
  normalizeNotificationSettings,
  soundFileForNotification,
} from '../src/features/notifications/settings.js';
import {
  DEFAULT_ADHAN_SOURCE,
  normalizeAdhanSourceId,
} from '../src/features/audio/sources.js';
import { toHijri } from '../src/features/hijri/converter.js';

describe('v1.2.0 stabilization utilities', () => {
  it('normalizes unsupported prayer settings back to safe defaults', () => {
    const settings = normalizePrayerSettings({
      methodId: 'UnknownMethod',
      madhab: 'hanafi',
      manualOffsets: { Fajr: 2 },
    });

    expect(settings.methodId).toBe(DEFAULT_PRAYER_SETTINGS.methodId);
    expect(settings.madhab).toBe('hanafi');
    expect(settings.manualOffsets.Fajr).toBe(2);
    expect(settings.manualOffsets.Isha).toBe(0);
  });

  it('normalizes per-prayer notification settings and legacy reminder minutes', () => {
    const settings = normalizeNotificationSettings({
      Fajr: { enabled: false, preReminderMinutes: '15', sound: 'silent', vibrateOnly: true },
    }, 10);

    expect(settings.Fajr.enabled).toBe(false);
    expect(settings.Fajr.preReminderMinutes).toBe(15);
    expect(settings.Fajr.sound).toBe('silent');
    expect(settings.Fajr.vibrateOnly).toBe(true);
    expect(settings.Dhuhr).toEqual(defaultNotificationSettings(10).Dhuhr);
  });

  it('does not attach notification sounds for silent or vibrate-only settings', () => {
    expect(soundFileForNotification('silent')).toBeUndefined();
    expect(soundFileForNotification('adhan_chime', true)).toBeUndefined();
    expect(soundFileForNotification('adhan_chime')).toBe('adhan_chime.wav');
  });

  it('maps legacy and unknown Adhan source ids to honest defaults', () => {
    expect(normalizeAdhanSourceId('mishary')).toBe('adhan1');
    expect(normalizeAdhanSourceId('not-real')).toBe(DEFAULT_ADHAN_SOURCE);
  });

  it('converts a stable Gregorian date to a Hijri date object', () => {
    const hijri = toHijri(new Date(2026, 4, 12), 0);

    expect(hijri).toMatchObject({
      day: expect.any(Number),
      month: expect.any(Number),
      year: expect.any(Number),
      monthNameEn: expect.any(String),
      monthNameAr: expect.any(String),
    });
  });
});
