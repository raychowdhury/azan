import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PRAYERS, pad, parseTime, formatTime, getNextPrayer, getActivePrayer, getPrayerProgress } from './utils/prayers';
import { fetchByCity, fetchByCoords, fetchWeeklyByCity, fetchWeeklyByCoords } from './utils/api';
import {
  DEFAULT_PRAYER_SETTINGS,
  METHOD_OPTIONS,
  buildComputedDay,
  buildComputedDays,
  computePrayerTimes,
  getCalculationMethodDetails,
  madhabToApiSchool,
  methodForCountry,
  methodToApiId,
  normalizePrayerSettings,
} from './features/prayer-times/calculation';
import {
  NOTIFICATION_SOUNDS,
  defaultNotificationSettings,
  normalizeNotificationSettings,
  soundFileForNotification,
} from './features/notifications/settings';
import {
  ADHAN_SOURCES,
  DEFAULT_ADHAN_SOURCE,
  adhanUrlFor,
  getAdhanSource,
  normalizeAdhanSourceId,
} from './features/audio/sources';
import HijriCalendar from './components/HijriCalendar';
import QiblaCompass from './components/QiblaCompass';
import Tasbih from './components/Tasbih';
import WeeklyView from './components/WeeklyView';
import NearbyMosques from './components/NearbyMosques';
import CitySearchInput from './components/CitySearchInput';
import { toHijri } from './features/hijri/converter';
import { useT } from './i18n';
import { reportError, reportEvent } from './utils/monitoring';
import { getActiveSky } from './utils/sky';
const isNative = Capacitor.isNativePlatform();
const ReverseGeocoder = registerPlugin('ReverseGeocoder');
const NOTIFICATION_ID_BASE = 4200;
const NOTIFICATION_ID_SPAN = 300;

const defaultSettings = {
  use24h: false,
  theme: 'dark',
  azanEnabled: false,
  azanSource: DEFAULT_ADHAN_SOURCE,
  notifEnabled: false,
  notifMinutes: 10,
  notifications: defaultNotificationSettings(10),
  prayer: DEFAULT_PRAYER_SETTINGS,
  hijriOffset: 0,
  tasbihTarget: 33,
};

function loadStorage(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function searchLabel(params) {
  if (!params) return '';
  if (params.label) return params.label;
  if (params.type === 'city') return [params.city, params.country].filter(Boolean).join(', ');
  return 'Current Location';
}

function prayerLabel(t, prayerKey) {
  return t(`prayer.${prayerKey}`);
}

function localizedMethodValue(t, value) {
  if (value === 'Method default') return t('settings.calculationMethod.methodDefault');
  const interval = String(value).match(/^(\d+) min after Maghrib$/);
  if (interval) return t('settings.calculationMethod.minutesAfterMaghrib', { minutes: interval[1] });
  return value;
}

function calculationMethodOptionLabel(t, methodId) {
  const details = getCalculationMethodDetails(methodId);
  return t('settings.calculationMethod.option', {
    label: t(`method.${details.id}.label`),
    authority: t(`method.${details.id}.authority`),
    fajr: localizedMethodValue(t, details.fajr),
    isha: localizedMethodValue(t, details.isha),
  });
}

function calculationMethodSummary(t, details) {
  return t('settings.calculationMethod.summary', {
    authority: t(`method.${details.id}.authority`),
    fajr: localizedMethodValue(t, details.fajr),
    isha: localizedMethodValue(t, details.isha),
  });
}

function extractCoords(result, fallback) {
  const latitude = result?.meta?.latitude;
  const longitude = result?.meta?.longitude;
  const lat = Number(latitude ?? fallback?.lat);
  const lng = Number(longitude ?? fallback?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function mergeSettings(raw) {
  const legacyMinutes = raw?.notifMinutes ?? defaultSettings.notifMinutes;
  return {
    ...defaultSettings,
    ...raw,
    azanSource: normalizeAdhanSourceId(raw?.azanSource),
    prayer: normalizePrayerSettings(raw?.prayer),
    notifications: normalizeNotificationSettings(raw?.notifications, legacyMinutes),
  };
}

function timingDateFor(baseDate, timeStr) {
  const clean = String(timeStr).replace(/\s*\(.*\)/, '');
  const [hours, minutes] = clean.split(':').map(Number);
  const date = new Date(baseDate);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function dateFromApiGregorian(apiDate) {
  const raw = apiDate?.gregorian?.date;
  if (!raw) return new Date();
  const [day, month, year] = raw.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatGregorianDate(apiDate, lang) {
  const apiWeekday = lang === 'ar'
    ? apiDate?.gregorian?.weekday?.ar
    : apiDate?.gregorian?.weekday?.en;
  const weekday = apiWeekday || new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en', {
    weekday: 'long',
  }).format(dateFromApiGregorian(apiDate));
  return [weekday, apiDate?.readable].filter(Boolean).join(' · ');
}

function hijriDateForDisplay(apiDate, timings, offsetDays, now) {
  const gregorianDate = dateFromApiGregorian(apiDate);
  const maghrib = timings?.Maghrib ? timingDateFor(gregorianDate, timings.Maghrib) : null;
  const hijriBase = new Date(gregorianDate);

  if (maghrib && now >= maghrib) {
    hijriBase.setDate(hijriBase.getDate() + 1);
  }

  return toHijri(hijriBase, offsetDays);
}

function formatHijriDate(hijri, lang) {
  return lang === 'ar'
    ? `${hijri.day} ${hijri.monthNameAr} ${hijri.year}`
    : `${hijri.day} ${hijri.monthNameEn} ${hijri.year} AH`;
}

function isScheduledPrayerNotification(notification) {
  return notification.id >= NOTIFICATION_ID_BASE
    && notification.id < NOTIFICATION_ID_BASE + NOTIFICATION_ID_SPAN;
}

// Cache reverse-geocode results to stay under Apple's 50 req / 60 s throttle.
// Round coords to ~100 m precision; same key + < 1 h old returns cached.
const REVERSE_GEOCODE_TTL_MS = 60 * 60 * 1000;
const reverseGeocodeCache = new Map();

function reverseGeocodeKey(lat, lng) {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

async function nativeReverseGeocode(params) {
  if (!isNative || params.type !== 'coords') return null;
  const key = reverseGeocodeKey(params.lat, params.lng);
  const cached = reverseGeocodeCache.get(key);
  if (cached && Date.now() - cached.ts < REVERSE_GEOCODE_TTL_MS) {
    return cached.place;
  }
  try {
    const place = await ReverseGeocoder.reverseGeocode({
      latitude: params.lat,
      longitude: params.lng,
    });
    reverseGeocodeCache.set(key, { place, ts: Date.now() });
    return place;
  } catch {
    return null;
  }
}

async function nativeLocationLabel(params, place) {
  if (!isNative || params.type !== 'coords') return searchLabel(params) || 'Current Location';
  if (!place) return searchLabel(params) || 'Current Location';
  return place.displayName || [place.city, place.region, place.country].filter(Boolean).slice(0, 2).join(', ') || 'Current Location';
}

function TabIcon({ name }) {
  const props = {
    width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round',
    strokeLinejoin: 'round', style: { display: 'block' },
  };
  switch (name) {
    case 'today':
      return (
        <svg {...props}>
          <path d="M4 11 12 4l8 7" />
          <path d="M6 10v9a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1v-9" />
        </svg>
      );
    case 'weekly':
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      );
    case 'qibla':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="m15 9-2 6-4 1 1-4Z" />
        </svg>
      );
    case 'mosques':
      return (
        <svg {...props}>
          <path d="M4 21V11c0-2 2-4 4-4h8c2 0 4 2 4 4v10" />
          <path d="M4 21h16" />
          <path d="M9 21v-4a3 3 0 0 1 6 0v4" />
          <path d="M12 3v4M10.5 4.5h3" />
        </svg>
      );
    case 'tasbih':
      return (
        <svg {...props}>
          <circle cx="12" cy="5" r="2" />
          <path d="M12 7c-3 1-6 3-6 7a6 6 0 0 0 12 0c0-4-3-6-6-7Z" />
          <circle cx="9" cy="14" r="0.8" fill="currentColor" />
          <circle cx="15" cy="14" r="0.8" fill="currentColor" />
          <circle cx="12" cy="17" r="0.8" fill="currentColor" />
        </svg>
      );
    default:
      return null;
  }
}

export default function App() {
  const { t, lang, setLang, languages } = useT();
  const [data, setData]               = useState(null);
  const [weeklyData, setWeeklyData]   = useState(null);
  const [weeklyLoading, setWL]        = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [cityInput, setCityInput]     = useState('');
  const [lastSearch, setLastSearch]   = useState(() => loadStorage('lastSearch', null));
  const [activeTab, setActiveTab]     = useState('today');
  const [showSearch, setShowSearch]   = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHijri, setShowHijri]     = useState(false);
  const [countdown, setCountdown]     = useState({ h: 0, m: 0, s: 0 });
  const [now, setNow]                 = useState(() => new Date());
  const [nextPrayer, setNextPrayer]   = useState(null);
  const [userCoords, setUserCoords]   = useState(null);
  const [settings, setSettings]       = useState(() => mergeSettings(loadStorage('settings', defaultSettings)));

  const countdownRef   = useRef(null);
  const azanTimers     = useRef([]);
  const audioRef       = useRef(null);
  const searchInputRef = useRef(null);

  // ── Apply theme ──────────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  // ── Apply sky (drives background gradient/orb from location's prayer times + now) ──
  const activeSky = data ? getActiveSky(data.timings, now) : 'dhuhr';
  useEffect(() => {
    document.documentElement.setAttribute('data-sky', activeSky);
    document.body.setAttribute('data-sky', activeSky);
  }, [activeSky]);

  // ── Persist settings / method ────────────────────────────────────────────────
  useEffect(() => { localStorage.setItem('settings', JSON.stringify(settings)); }, [settings]);

  // ── Auto-load on mount ───────────────────────────────────────────────────────
  useEffect(() => {
    if (lastSearch) {
      performSearch(lastSearch, false);
    }
  }, []);

  useEffect(() => {
    if (showSearch) searchInputRef.current?.focus();
  }, [showSearch]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Countdown interval ───────────────────────────────────────────────────────
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (!data) return;

    const np = getNextPrayer(data.timings);
    setNextPrayer(np);

    if (!np) return;

    const tick = () => {
      const target = parseTime(data.timings[np]);
      const diff = Math.floor((target - new Date()) / 1000);
      if (diff <= 0) {
        if (lastSearch) performSearch(lastSearch, false);
        return;
      }
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setCountdown({ h, m, s });
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => clearInterval(countdownRef.current);
  }, [data]);

  // ── Schedule azan & notifications ────────────────────────────────────────────
  useEffect(() => {
    azanTimers.current.forEach(clearTimeout);
    azanTimers.current = [];
    if (!data) return;

    if (isNative) {
      if (settings.notifEnabled) {
        const notificationCoords = lastSearch?.type === 'coords' ? userCoords : null;
        scheduleNativeNotifications(data.timings, settings.notifications, notificationCoords)
          .catch(error => reportError(error, { feature: 'notification_schedule_effect' }));
      } else {
        LocalNotifications.getPending()
          .then(pending => pending.notifications
            .filter(isScheduledPrayerNotification)
            .map(n => ({ id: n.id })))
          .then(notifications => {
            if (notifications.length) return LocalNotifications.cancel({ notifications });
          })
          .catch(error => reportError(error, { feature: 'notification_cancel_disabled' }));
      }
    }

    const now = new Date();
    PRAYERS.forEach(prayer => {
      if (!data.timings[prayer.key]) return;
      const cfg = settings.notifications[prayer.key];
      const pTime = parseTime(data.timings[prayer.key]);
      const msUntil = pTime - now;
      if (msUntil <= 0 || msUntil > 24 * 3600 * 1000) return;

      if (settings.azanEnabled && prayer.obligatory && cfg?.enabled && cfg.sound !== 'silent') {
        azanTimers.current.push(setTimeout(() => playAzan(prayer.key), msUntil));
      }
      if (!isNative && settings.notifEnabled && cfg?.enabled) {
        const ahead = msUntil - cfg.preReminderMinutes * 60 * 1000;
        if (ahead > 0) {
          azanTimers.current.push(
            setTimeout(() => fireNotification(prayerLabel(t, prayer.key), cfg.preReminderMinutes), ahead)
          );
        }
      }
    });
    return () => azanTimers.current.forEach(clearTimeout);
  }, [data, settings.azanEnabled, settings.notifEnabled, settings.notifications, userCoords, lastSearch, t]);

  function stopAudio() {
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch {}
      audioRef.current = null;
    }
  }

  function playAzanUrl(url) {
    if (!url) return;
    try {
      stopAudio();
      const audio = new Audio(url);
      audio.volume = 1;
      audio.play()
        .then(() => reportEvent('audio_playback_started', { source: url.startsWith('/') ? 'bundled' : 'streaming' }))
        .catch(error => reportError(error, { feature: 'audio_playback', source: url.startsWith('/') ? 'bundled' : 'streaming' }));
      audioRef.current = audio;
    } catch (error) {
      reportError(error, { feature: 'audio_playback_create' });
    }
  }

  function playAzan(prayerKey) {
    const source = getAdhanSource(settings.azanSource);
    if (source.builtin === 'silent') return;
    if (source.builtin === 'beep') {
      playAzanUrl('/beep.wav');
      return;
    }
    playAzanUrl(adhanUrlFor(settings.azanSource, prayerKey));
  }

  function previewAzan() {
    const source = getAdhanSource(settings.azanSource);
    if (source.builtin === 'silent') return;
    if (source.builtin === 'beep') { playAzanUrl('/beep.wav'); return; }
    playAzanUrl(adhanUrlFor(settings.azanSource, 'Dhuhr'));
    // Auto-stop preview after 12s so full Adhan doesn't play out.
    const previewAudio = audioRef.current;
    setTimeout(() => {
      if (audioRef.current === previewAudio) stopAudio();
    }, 12000);
  }

  async function fireTestNotification() {
    if (isNative) {
      try {
        const status = await LocalNotifications.checkPermissions();
        reportEvent('notification_permission_checked', { platform: 'native', status: status.display });
        if (status.display !== 'granted') {
          const req = await LocalNotifications.requestPermissions();
          reportEvent('notification_permission_requested', { platform: 'native', status: req.display });
          if (req.display !== 'granted') return;
        }
        await LocalNotifications.schedule({
          notifications: [{
            id: NOTIFICATION_ID_BASE + NOTIFICATION_ID_SPAN - 1,
            title: t('notification.test.title'),
            body: t('notification.test.body'),
            schedule: { at: new Date(Date.now() + 1500) },
          }],
        });
        reportEvent('notification_test_scheduled', { platform: 'native' });
      } catch (error) {
        reportError(error, { feature: 'notification_test', platform: 'native' });
      }
      return;
    }
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission();
      reportEvent('notification_permission_requested', { platform: 'web', status: perm });
      if (perm !== 'granted') return;
    }
    new Notification(t('notification.test.title'), {
      body: t('notification.test.body'),
    });
    reportEvent('notification_test_scheduled', { platform: 'web' });
  }

  function fireNotification(prayerName, minutes) {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      new Notification('🕌 Azan Times', {
        body: t('notification.reminder.body', { prayer: prayerName, minutes }),
      });
      reportEvent('notification_web_fired', { prayerName, minutes });
    }
  }

  async function requestNotifPermission() {
    if (isNative) {
      try {
        const status = await LocalNotifications.requestPermissions();
        reportEvent('notification_permission_requested', { platform: 'native', status: status.display });
        if (status.display === 'granted') updateSetting('notifEnabled', true);
      } catch (error) {
        reportError(error, { feature: 'notification_permission', platform: 'native' });
      }
      return;
    }
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      reportEvent('notification_permission_requested', { platform: 'web', status: perm });
      if (perm === 'granted') updateSetting('notifEnabled', true);
    }
  }

  function updateSetting(key, val) {
    setSettings(s => ({ ...s, [key]: val }));
  }

  function updatePrayerSetting(key, val) {
    setSettings(s => ({
      ...s,
      prayer: normalizePrayerSettings({ ...s.prayer, [key]: val }),
    }));
  }

  function updateManualOffset(key, val) {
    setSettings(s => ({
      ...s,
      prayer: normalizePrayerSettings({
        ...s.prayer,
        manualOffsets: {
          ...s.prayer.manualOffsets,
          [key]: Math.max(-30, Math.min(30, Number(val))),
        },
      }),
    }));
  }

  function updatePrayerNotification(prayerKey, patch) {
    setSettings(s => ({
      ...s,
      notifications: normalizeNotificationSettings({
        ...s.notifications,
        [prayerKey]: {
          ...s.notifications[prayerKey],
          ...patch,
        },
      }, s.notifMinutes),
    }));
  }

  // ── Core search ──────────────────────────────────────────────────────────────
  const performSearch = useCallback(async (params, showLoader = true) => {
    if (showLoader) setLoading(true);
    setError(null);
    try {
      let result;
      let resolvedParams;
      const method = methodToApiId(settings.prayer.methodId);
      const school = madhabToApiSchool(settings.prayer.madhab);
      if (params.type === 'city') {
        result = await fetchByCity(params.city, params.country, method, school);
        const coords = extractCoords(result, null);
        result = buildComputedDay(result, coords, settings.prayer);
        if (coords) setUserCoords(coords);
        resolvedParams = { ...params, label: searchLabel(params) };
      } else {
        result = await fetchByCoords(params.lat, params.lng, method, school);
        result = buildComputedDay(result, { lat: params.lat, lng: params.lng }, settings.prayer);
        setUserCoords({ lat: params.lat, lng: params.lng });
        const place = await nativeReverseGeocode(params);
        resolvedParams = {
          ...params,
          label: await nativeLocationLabel(params, place),
          countryCode: place?.countryCode || params.countryCode,
        };
        // Auto-pick calculation method from country, but never overwrite a
        // method the user already explicitly confirmed.
        const cc = resolvedParams.countryCode;
        if (cc) {
          const suggested = methodForCountry(cc);
          if (suggested) {
            setSettings((s) => {
              if (s.prayer.methodAutoConfirmed) return s;
              if (s.prayer.methodId === suggested) return s;
              return {
                ...s,
                prayer: normalizePrayerSettings({ ...s.prayer, methodId: suggested }),
              };
            });
          }
        }
      }
      setData(result);
      setLastSearch(resolvedParams);
      localStorage.setItem('lastSearch', JSON.stringify(resolvedParams));
      localStorage.setItem('lastData', JSON.stringify({ result, params: resolvedParams, ts: Date.now() }));
    } catch (e) {
      const cached = loadStorage('lastData', null);
      if (cached?.result) {
        setData(cached.result);
        if (cached.params) setLastSearch(cached.params);
        setError(t('error.offlineCached', { date: new Date(cached.ts).toLocaleString() }));
      } else {
        setError(e.message);
      }
      reportError(e, { feature: 'prayer_search', type: params?.type });
    } finally {
      setLoading(false);
    }
  }, [settings.prayer, t]);

  async function scheduleNativeNotifications(timings, notificationSettings, coords) {
    if (!isNative) return;

    try {
      const pending = await LocalNotifications.getPending();
      const scheduledPrayerNotifications = pending.notifications
        .filter(isScheduledPrayerNotification)
        .map(n => ({ id: n.id }));
      if (scheduledPrayerNotifications.length) {
        await LocalNotifications.cancel({ notifications: scheduledPrayerNotifications });
      }
    } catch (error) {
      reportError(error, { feature: 'notification_cancel' });
      throw error;
    }

    const now = new Date();
    const notifications = [];
    const days = coords ? 3 : 1;

    for (let dayOffset = 0; dayOffset < days; dayOffset += 1) {
      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() + dayOffset);
      baseDate.setHours(0, 0, 0, 0);

      const dayTimes = coords
        ? computePrayerTimes(baseDate, coords, settings.prayer)
        : Object.fromEntries(
          Object.entries(timings).map(([key, value]) => [key, timingDateFor(baseDate, value)]),
        );

      PRAYERS.forEach((prayer, index) => {
        const cfg = notificationSettings[prayer.key];
        const prayerTime = dayTimes[prayer.key];
        if (!cfg?.enabled || !prayerTime) return;

        const preMinutes = Number(cfg.preReminderMinutes);

        if (preMinutes > 0) {
          const notifyAt = new Date(prayerTime.getTime() - preMinutes * 60 * 1000);
          if (notifyAt > now) {
            notifications.push({
              id: NOTIFICATION_ID_BASE + dayOffset * 100 + 50 + index,
              title: t('notification.reminder.title'),
              body: t('notification.reminder.body', { prayer: prayerLabel(t, prayer.key), minutes: preMinutes }),
              schedule: { at: notifyAt },
              sound: cfg.vibrateOnly ? undefined : 'beep.wav',
            });
          }
        }

        if (prayerTime > now) {
          notifications.push({
            id: NOTIFICATION_ID_BASE + dayOffset * 100 + index,
            title: prayerLabel(t, prayer.key),
            body: t('notification.time.body', { prayer: prayerLabel(t, prayer.key) }),
            schedule: { at: prayerTime },
            sound: soundFileForNotification(cfg.sound, cfg.vibrateOnly),
          });
        }
      });
    }

    if (notifications.length) {
      try {
        await LocalNotifications.schedule({ notifications });
        reportEvent('notification_schedule_success', { count: notifications.length, days });
      } catch (error) {
        reportError(error, { feature: 'notification_schedule', count: notifications.length, days });
        throw error;
      }
    }
  }

  async function loadWeekly(params) {
    setWL(true);
    try {
      let result;
      let coords = userCoords;
      const method = methodToApiId(settings.prayer.methodId);
      const school = madhabToApiSchool(settings.prayer.madhab);
      if (!params) throw new Error('No location');
      if (params.type === 'city') {
        result = await fetchWeeklyByCity(params.city, params.country, method, school);
      } else {
        result = await fetchWeeklyByCoords(params.lat, params.lng, method, school);
        coords = { lat: params.lat, lng: params.lng };
      }
      setWeeklyData(buildComputedDays(result, coords, settings.prayer));
    } catch {} finally {
      setWL(false);
    }
  }

  function handleSearch() {
    const input = cityInput.trim();
    if (!input) { setShowSearch(true); return; }
    const parts = input.split(',').map(s => s.trim());
    performSearch({ type: 'city', city: parts[0], country: parts[1] || '' });
    setShowSearch(false);
  }

  function handleLocate() {
    if (!navigator.geolocation) { setError(t('error.geolocationUnsupported')); return; }
    setLoading(true);
    setError(null);
    setShowSearch(false);
    navigator.geolocation.getCurrentPosition(
      pos => {
        reportEvent('location_permission_success');
        performSearch({ type: 'coords', lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      error => {
        setLoading(false);
        setError(t('error.locationDenied'));
        reportError(error, { feature: 'location_permission' });
      },
      { enableHighAccuracy: true, maximumAge: 5 * 60 * 1000, timeout: 10000 }
    );
  }

  function handleTabChange(tab) {
    setActiveTab(tab);
    if (tab === 'weekly' && !weeklyData && lastSearch) loadWeekly(lastSearch);
  }

  // ── Derived values ───────────────────────────────────────────────────────────
  const activePrayer   = data ? getActivePrayer(data.timings) : null;
  const progress       = data ? getPrayerProgress(data.timings) : null;
  const nextPrayerData = nextPrayer ? PRAYERS.find(p => p.key === nextPrayer) : null;
  const cityName       = data && lastSearch
    ? searchLabel(lastSearch)
    : data
      ? t('search.useLocation')
      : '';
  const selectedMethodDetails = getCalculationMethodDetails(settings.prayer.methodId);
  const displayHijri = data
    ? hijriDateForDisplay(data.date, data.timings, settings.hijriOffset, now)
    : null;

  useEffect(() => {
    if (lastSearch) performSearch(lastSearch, false);
    if (activeTab === 'weekly' && lastSearch) loadWeekly(lastSearch);
  }, [
    settings.prayer.methodId,
    settings.prayer.madhab,
    settings.prayer.highLatitudeRule,
    settings.prayer.fajrAngle,
    settings.prayer.ishaAngle,
    settings.prayer.ishaInterval,
    settings.prayer.manualOffsets.Fajr,
    settings.prayer.manualOffsets.Sunrise,
    settings.prayer.manualOffsets.Dhuhr,
    settings.prayer.manualOffsets.Asr,
    settings.prayer.manualOffsets.Maghrib,
    settings.prayer.manualOffsets.Isha,
  ]);

  // ── Render ───────────────────────────────────────────────────────────────────
  const isNightSky = activeSky === 'fajr' || activeSky === 'isha';
  return (
    <div className="app">
      {/* ── Sky background (location + time driven) ── */}
      <div className="sky-layer" aria-hidden="true" />
      <div className="sky-orb" aria-hidden="true" />
      {isNightSky && Array.from({ length: 18 }).map((_, i) => (
        <div
          key={i}
          className="sky-star"
          aria-hidden="true"
          style={{
            top: `${4 + ((i * 37) % 60)}%`,
            left: `${4 + ((i * 71) % 92)}%`,
            width: i % 4 === 0 ? 3 : 2,
            height: i % 4 === 0 ? 3 : 2,
            opacity: 0.3 + ((i * 53) % 50) / 100,
          }}
        />
      ))}
      <div className="sky-veil" aria-hidden="true" />

      {/* ── Settings Panel ── */}
      {showHijri && (
        <div className="settings-overlay" onClick={() => setShowHijri(false)}>
          <div className="settings-panel hijri-panel" onClick={e => e.stopPropagation()}>
            <div className="settings-header">
              <h3>{t('tab.hijri')}</h3>
              <button className="settings-close" onClick={() => setShowHijri(false)} aria-label="Close">✕</button>
            </div>
            <HijriCalendar
              offsetDays={settings.hijriOffset}
              onOffsetChange={value => updateSetting('hijriOffset', value)}
              t={t}
            />
          </div>
        </div>
      )}

      {showSettings && (
        <div className="settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-panel" onClick={e => e.stopPropagation()}>
            <div className="settings-header">
              <h3>{t('settings.title')}</h3>
              <button className="settings-close" onClick={() => setShowSettings(false)}>✕</button>
            </div>

            <div className="setting-group">
              <label className="setting-label">{t('settings.language')}</label>
              <select
                className="method-select"
                value={lang}
                onChange={e => setLang(e.target.value)}
              >
                {languages.map(l => (
                  <option key={l.id} value={l.id}>{l.nativeLabel}</option>
                ))}
              </select>
            </div>

            <div className="setting-group">
              <label className="setting-label">{t('settings.theme')}</label>
              <div className="toggle-row">
                <button
                  className={`theme-btn ${settings.theme === 'dark' ? 'active' : ''}`}
                  onClick={() => updateSetting('theme', 'dark')}
                >{t('settings.theme.dark')}</button>
                <button
                  className={`theme-btn ${settings.theme === 'light' ? 'active' : ''}`}
                  onClick={() => updateSetting('theme', 'light')}
                >{t('settings.theme.light')}</button>
              </div>
            </div>

            <div className="setting-group">
              <label className="setting-label">{t('settings.timeFormat')}</label>
              <div className="toggle-row">
                <button
                  className={`theme-btn ${!settings.use24h ? 'active' : ''}`}
                  onClick={() => updateSetting('use24h', false)}
                >{t('settings.timeFormat.12')}</button>
                <button
                  className={`theme-btn ${settings.use24h ? 'active' : ''}`}
                  onClick={() => updateSetting('use24h', true)}
                >{t('settings.timeFormat.24')}</button>
              </div>
            </div>

            <div className="setting-group">
              <div className="setting-row">
                <div>
                  <label className="setting-label">{t('settings.azanAudio')}</label>
                  <p className="setting-hint">{t('settings.azanAudio.hint')}</p>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={settings.azanEnabled}
                    onChange={e => updateSetting('azanEnabled', e.target.checked)}
                  />
                  <span className="slider" />
                </label>
              </div>
              {settings.azanEnabled && (
                <div className="adhan-source-row">
                  <label className="adhan-source-label">
                    <span>{t('settings.reciter')}</span>
                    <select
                      className="method-select"
                      value={settings.azanSource}
                      onChange={e => { stopAudio(); updateSetting('azanSource', e.target.value); }}
                    >
                      {ADHAN_SOURCES.map(source => (
                        <option key={source.id} value={source.id}>
                          {t(`adhanSource.${source.id}.label`)}{source.unverified ? ` (${t('label.preview')})` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="adhan-source-actions">
                    <button type="button" className="btn-secondary" onClick={previewAzan}>
                      {t('settings.preview')}
                    </button>
                    <button type="button" className="btn-secondary" onClick={stopAudio}>
                      {t('settings.stop')}
                    </button>
                  </div>
                  <p className="setting-hint">
                    {t(`adhanSource.${settings.azanSource}.description`)}
                    {getAdhanSource(settings.azanSource).unverified
                      ? ` ${t('settings.azanAudio.unverified')}`
                      : ''}
                  </p>
                </div>
              )}
            </div>

            <div className="setting-group">
              <div className="setting-row">
                <div>
                  <label className="setting-label">{t('settings.notifications')}</label>
                  <p className="setting-hint">{t('settings.notifications.hint')}</p>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={settings.notifEnabled}
                    onChange={e => {
                      if (e.target.checked) requestNotifPermission();
                      else updateSetting('notifEnabled', false);
                    }}
                  />
                  <span className="slider" />
                </label>
              </div>
              {settings.notifEnabled && (
                <div className="notif-minutes">
                  <span className="setting-hint">{t('settings.notifications.defaultReminder')}</span>
                  <select
                    className="method-select small"
                    value={settings.notifMinutes}
                    onChange={e => {
                      const minutes = Number(e.target.value);
                      setSettings(s => ({
                        ...s,
                        notifMinutes: minutes,
                        notifications: normalizeNotificationSettings(
                          Object.fromEntries(
                            Object.entries(s.notifications).map(([key, cfg]) => [
                              key,
                              { ...cfg, preReminderMinutes: minutes },
                            ]),
                          ),
                          minutes,
                        ),
                      }));
                    }}
                  >
                    {[0, 5, 10, 15, 30].map(n => (
                      <option key={n} value={n}>{t('settings.notifications.minutesBefore', { minutes: n })}</option>
                    ))}
                  </select>
                </div>
              )}
              {settings.notifEnabled && (
                <button type="button" className="btn-secondary notif-test" onClick={fireTestNotification}>
                  {t('settings.notifications.test')}
                </button>
              )}
            </div>

            {settings.notifEnabled && (
              <div className="setting-group">
                <label className="setting-label">{t('settings.perPrayer')}</label>
                <div className="notif-prayer-list">
                  {PRAYERS.map(prayer => {
                    const cfg = settings.notifications[prayer.key];
                    return (
                      <div key={prayer.key} className="notif-prayer-card">
                        <div className="notif-prayer-top">
                          <div>
                            <div className="notif-prayer-name">{prayerLabel(t, prayer.key)}</div>
                            <div className="setting-hint">{prayer.arabic}</div>
                          </div>
                          <label className="switch">
                            <input
                              type="checkbox"
                              checked={cfg.enabled}
                              onChange={e => updatePrayerNotification(prayer.key, { enabled: e.target.checked })}
                            />
                            <span className="slider" />
                          </label>
                        </div>

                        {cfg.enabled && (
                          <div className="notif-prayer-controls">
                            <label>
                              <span>{t('settings.notifications.sound')}</span>
                              <select
                                className="method-select small"
                                value={cfg.sound}
                                onChange={e => updatePrayerNotification(prayer.key, { sound: e.target.value })}
                              >
                                {NOTIFICATION_SOUNDS.map(sound => (
                                  <option key={sound.id} value={sound.id}>{t(`notificationSound.${sound.id}`)}</option>
                                ))}
                              </select>
                            </label>
                            <label>
                              <span>{t('settings.notifications.reminder')}</span>
                              <select
                                className="method-select small"
                                value={cfg.preReminderMinutes}
                                onChange={e => updatePrayerNotification(prayer.key, { preReminderMinutes: Number(e.target.value) })}
                              >
                                {[0, 5, 10, 15, 30].map(n => (
                                  <option key={n} value={n}>{n === 0 ? t('label.off') : t('settings.notifications.minutes', { minutes: n })}</option>
                                ))}
                              </select>
                            </label>
                            <label className="vibrate-check">
                              <input
                                type="checkbox"
                                checked={cfg.vibrateOnly}
                                onChange={e => updatePrayerNotification(prayer.key, { vibrateOnly: e.target.checked })}
                              />
                              <span>{t('settings.notifications.vibrateOnly')}</span>
                            </label>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="setting-hint">{t('settings.notifications.iosSoundLimit')}</p>
              </div>
            )}

            <div className="setting-group">
              <label className="setting-label">{t('settings.calculationMethod')}</label>
              <select
                className="method-select"
                value={settings.prayer.methodId}
                onChange={e => setSettings(s => ({
                  ...s,
                  prayer: normalizePrayerSettings({ ...s.prayer, methodId: e.target.value, methodAutoConfirmed: true }),
                }))}
              >
                {METHOD_OPTIONS.map(m => (
                  <option key={m.id} value={m.id}>{calculationMethodOptionLabel(t, m.id)}</option>
                ))}
              </select>
              <p className="setting-hint">
                {calculationMethodSummary(t, selectedMethodDetails)}
              </p>
            </div>

            <div className="setting-group">
              <label className="setting-label">{t('settings.madhab')}</label>
              <div className="toggle-row">
                <button
                  className={`theme-btn ${settings.prayer.madhab === 'shafi' ? 'active' : ''}`}
                  onClick={() => updatePrayerSetting('madhab', 'shafi')}
                >{t('settings.madhab.shafi')}</button>
                <button
                  className={`theme-btn ${settings.prayer.madhab === 'hanafi' ? 'active' : ''}`}
                  onClick={() => updatePrayerSetting('madhab', 'hanafi')}
                >{t('settings.madhab.hanafi')}</button>
              </div>
              <p className="setting-hint">{t('settings.madhab.hint')}</p>
            </div>

            {Math.abs(userCoords?.lat ?? 0) > 48 && (
              <div className="setting-group">
                <label className="setting-label">{t('settings.highLatitudeRule')}</label>
                <select
                  className="method-select"
                  value={settings.prayer.highLatitudeRule}
                  onChange={e => updatePrayerSetting('highLatitudeRule', e.target.value)}
                >
                  <option value="">{t('settings.highLatitudeRule.default')}</option>
                  <option value="MiddleOfTheNight">{t('settings.highLatitudeRule.middle')}</option>
                  <option value="SeventhOfTheNight">{t('settings.highLatitudeRule.seventh')}</option>
                  <option value="TwilightAngle">{t('settings.highLatitudeRule.angle')}</option>
                </select>
              </div>
            )}

            <div className="setting-group">
              <label className="setting-label">{t('settings.manualOffsets')}</label>
              <p className="setting-hint">{t('settings.manualOffsets.hint')}</p>
              <div className="offset-list">
                {PRAYERS.map(prayer => (
                  <div key={prayer.key} className="offset-row">
                    <span>{prayerLabel(t, prayer.key)}</span>
                    <div className="stepper">
                      <button onClick={() => updateManualOffset(prayer.key, settings.prayer.manualOffsets[prayer.key] - 1)}>−</button>
                      <input
                        type="number"
                        min="-30"
                        max="30"
                        value={settings.prayer.manualOffsets[prayer.key]}
                        onChange={e => updateManualOffset(prayer.key, e.target.value)}
                      />
                      <button onClick={() => updateManualOffset(prayer.key, settings.prayer.manualOffsets[prayer.key] + 1)}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="container">
        {/* ── Header ── */}
        <div className="header">
          <div className="header-top">
            <div className="icon">🕌</div>
            <div className="header-actions">
              <button
                className={`icon-action ${showSearch ? 'active' : ''}`}
                onClick={() => setShowSearch(s => !s)}
                title={t('search.title')}
                aria-label={t('search.title')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </button>
              <button
                className="icon-action"
                onClick={handleLocate}
                title={t('search.useLocation')}
                aria-label={t('search.useLocation')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z"/>
                  <circle cx="12" cy="9" r="2.5"/>
                </svg>
              </button>
              <button className="icon-action" onClick={() => setShowSettings(true)} title={t('settings.title')} aria-label={t('settings.title')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              </button>
            </div>
          </div>
          <h1>{t('app.title')}</h1>
          {lang !== 'ar' && <p className="header-arabic">أوقات الصلاة</p>}
          <p className="header-sub">{t('app.subtitle')}</p>
          <div className="header-ornament">──◈──</div>
        </div>

        {/* ── Search ── */}
        {showSearch && (
        <div className="search-section">
          <div className="search-row">
            <CitySearchInput
              value={cityInput}
              onChange={setCityInput}
              onSubmit={handleSearch}
              onPickSuggestion={(s) => {
                setCityInput(`${s.city}, ${s.country}`);
                setShowSearch(false);
                performSearch({
                  type: 'coords',
                  lat: s.lat,
                  lng: s.lng,
                  label: `${s.city}${s.region ? ', ' + s.region : ''}, ${s.country}`,
                });
              }}
              placeholder={t('search.placeholder')}
              inputRef={searchInputRef}
            />
            <button className="btn btn-search" onClick={handleSearch}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              {t('search.button')}
            </button>
          </div>
        </div>
        )}

        {/* ── Content ── */}
        {loading && (
          <div className="status-msg">
            <div className="spinner" />
            <p>{t('loading.prayerTimes')}</p>
          </div>
        )}

        {!loading && error && (
          <div className="error-box">
            <div className="error-icon">😕</div>
            <div className="error-title">{error}</div>
            <div className="error-hint">{t('error.searchHint')}</div>
          </div>
        )}

        {!loading && !error && !data && (
          <div className="welcome-state">
            <div className="welcome-mosque">🕌</div>
            <p className="welcome-bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
            <h2 className="welcome-title">{t('welcome.title')}</h2>
            <p className="welcome-text">{t('welcome.text')}</p>
            <div className="welcome-divider">── ✦ ──</div>
            <div className="welcome-actions">
              <button className="btn btn-search" onClick={() => setShowSearch(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                {t('search.button')}
              </button>
              <button className="btn-secondary" onClick={handleLocate}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                  <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z"/>
                  <circle cx="12" cy="9" r="2.5"/>
                </svg>
                {t('search.useLocation')}
              </button>
            </div>
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* Location banner + inline actions */}
            <div className="location-banner-row">
              <div className="location-banner">
                <div className="city-row">
                  <svg className="loc-pin" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                  <div className="city-name">{cityName}</div>
                </div>
                <div className="date-info">{formatGregorianDate(data.date, lang)}</div>
                {displayHijri && (
                  <button
                    type="button"
                    className="hijri hijri-chip"
                    onClick={() => setShowHijri(true)}
                    aria-label={t('hijri.open')}
                  >
                    {formatHijriDate(displayHijri, lang)}
                    <span className="hijri-chip-caret" aria-hidden="true">›</span>
                  </button>
                )}
              </div>
              <div className="header-inline-actions">
                <button
                  className={`icon-action ${showSearch ? 'active' : ''}`}
                  onClick={() => setShowSearch(s => !s)}
                  aria-label={t('search.title')}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </button>
                <button
                  className="icon-action"
                  onClick={handleLocate}
                  aria-label={t('search.useLocation')}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z"/>
                    <circle cx="12" cy="9" r="2.5"/>
                  </svg>
                </button>
                <button
                  className="icon-action"
                  onClick={() => setShowSettings(true)}
                  aria-label={t('settings.title')}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Sun strip */}
            <div className="sun-strip">
              <div className="sun-item rise">
                <div className="sun-icon">🌅</div>
                <div className="sun-detail">
                  <div className="sun-label">{t('sun.sunrise')}</div>
                  <div className="sun-time">{formatTime(data.timings.Sunrise, settings.use24h)}</div>
                </div>
              </div>
              <div className="sun-item set">
                <div className="sun-icon">🌇</div>
                <div className="sun-detail">
                  <div className="sun-label">{t('sun.sunset')}</div>
                  <div className="sun-time">{formatTime(data.timings.Sunset, settings.use24h)}</div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="tabs">
              {['today', 'weekly', 'qibla', 'mosques', 'tasbih'].map(tab => (
                <button
                  key={tab}
                  className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => handleTabChange(tab)}
                >
                  <TabIcon name={tab} />
                  <span className="tab-label">{t(`tab.${tab}`)}</span>
                </button>
              ))}
            </div>

            {/* Today tab */}
            {activeTab === 'today' && (
              <>
                {/* ── Countdown Hero (top) ── */}
                {nextPrayerData && (
                  <div className="countdown-hero">
                    <div className="countdown-hero-top-bar" />

                    {/* Large glowing prayer icon */}
                    <div className="hero-icon-wrap">
                      <div className="hero-icon-ring" />
                      <div className="hero-icon">{nextPrayerData.icon}</div>
                    </div>

                    <div className="countdown-hero-names">
                      <span className="countdown-name-ar">{nextPrayerData.arabic}</span>
                      <span className="countdown-name-en">{prayerLabel(t, nextPrayerData.key)}</span>
                    </div>
                    <div className="countdown-hero-label">{t('countdown.timeRemaining')}</div>
                    <div className="countdown-digits">
                      <div className="digit-block">
                        <span className="digit-num">{pad(countdown.h)}</span>
                        <span className="digit-label">{t('countdown.hours')}</span>
                      </div>
                      <span className="digit-sep">:</span>
                      <div className="digit-block">
                        <span className="digit-num">{pad(countdown.m)}</span>
                        <span className="digit-label">{t('countdown.minutes')}</span>
                      </div>
                      <span className="digit-sep">:</span>
                      <div className="digit-block">
                        <span className="digit-num">{pad(countdown.s)}</span>
                        <span className="digit-label">{t('countdown.seconds')}</span>
                      </div>
                    </div>
                    {/* Prayer time */}
                    <div className="countdown-prayer-time">
                      ◈ {t('countdown.beginsAt')} {formatTime(data.timings[nextPrayerData.key], settings.use24h)}
                    </div>
                    {/* Progress inside hero */}
                    {progress && (
                      <div className="countdown-progress">
                        <div className="countdown-progress-fill" style={{ width: `${progress.progress}%` }} />
                      </div>
                    )}
                    {progress && (
                      <div className="countdown-progress-labels">
                        <span>{progress.prevKey}</span>
                        <span>{Math.round(progress.progress)}%</span>
                        <span>{progress.nextKey}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Section divider */}
                <div className="section-divider">
                  <span className="div-line" />
                  <span className="div-icon">☽</span>
                  <span className="div-line" />
                </div>

                {/* Prayer cards */}
                <div className="prayers-grid">
                  {PRAYERS.map(p => {
                    const isNext   = p.key === nextPrayer;
                    const isActive = p.key === activePrayer;
                    return (
                      <div
                        key={p.key}
                        className={`prayer-card ${isNext ? 'next' : ''} ${isActive ? 'active' : ''}`}
                      >
                        <div className="prayer-left">
                          <div className="prayer-icon">{p.icon}</div>
                          <div>
                            <div className="prayer-name">
                              {prayerLabel(t, p.key)}
                              {isNext && <span className="next-badge">{t('label.next')}</span>}
                              {isActive && !isNext && <span className="active-badge">{t('label.current')}</span>}
                            </div>
                            <div className="prayer-arabic">{p.arabic}</div>
                          </div>
                        </div>
                        <div className="prayer-time">
                          {formatTime(data.timings[p.key], settings.use24h)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Azan status bar */}
                <div className="azan-status">
                  <span className={`azan-dot ${settings.azanEnabled ? 'on' : 'off'}`} />
                  <span>
                    {settings.azanEnabled ? t('azan.statusOn') : t('azan.statusOff')}
                    {settings.notifEnabled ? ' ' + t('azan.notifSuffix', { minutes: settings.notifMinutes }) : ''}
                  </span>
                  <button className="azan-settings-link" onClick={() => setShowSettings(true)}>
                    {t('azan.configure')}
                  </button>
                </div>
              </>
            )}

            {/* Weekly tab */}
            {activeTab === 'weekly' && (
              <WeeklyView
                weeklyData={weeklyData}
                loading={weeklyLoading}
                use24h={settings.use24h}
                t={t}
              />
            )}

            {/* Qibla tab */}
            {activeTab === 'qibla' && (
              <QiblaCompass userCoords={userCoords} onLocate={handleLocate} t={t} />
            )}

            {/* Mosques tab */}
            {activeTab === 'mosques' && (
              <NearbyMosques
                userCoords={userCoords}
                onLocate={(coords) => {
                  if (coords) setUserCoords(coords);
                }}
              />
            )}

            {/* Tasbih tab */}
            {activeTab === 'tasbih' && (
              <Tasbih
                target={settings.tasbihTarget}
                onTargetChange={value => updateSetting('tasbihTarget', value)}
              />
            )}
          </>
        )}

        <div className="footer">
          {t('footer.poweredBy')} <a href="https://aladhan.com/prayer-times-api" target="_blank" rel="noreferrer">Aladhan API</a> ·
          {' '}{t('footer.audioBy')} <a href="https://archive.org/details/adhan.recordings.from.doha.qatar" target="_blank" rel="noreferrer">archive.org (Public Domain)</a>
        </div>
      </div>
    </div>
  );
}
