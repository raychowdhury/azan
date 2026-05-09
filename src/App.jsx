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
  getCalculationMethodOptionLabel,
  madhabToApiSchool,
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
import PrayerIcon from './components/PrayerIcon';
import { toHijri } from './features/hijri/converter';
import { getActiveSky } from './utils/sky';
import { useT } from './i18n';
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

async function nativeLocationLabel(params) {
  if (!isNative || params.type !== 'coords') return searchLabel(params) || 'Current Location';

  try {
    const place = await ReverseGeocoder.reverseGeocode({
      latitude: params.lat,
      longitude: params.lng,
    });
    return place.displayName || [place.city, place.region, place.country].filter(Boolean).slice(0, 2).join(', ') || 'Current Location';
  } catch {
    return searchLabel(params) || 'Current Location';
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

  // ── Apply sky-of-day (drives background + hero gradient) ────────────────────
  const skyKey = data?.timings ? getActiveSky(data.timings, now) : 'dhuhr';
  useEffect(() => {
    document.documentElement.setAttribute('data-sky', skyKey);
    document.body.setAttribute('data-sky', skyKey);
  }, [skyKey]);

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
        scheduleNativeNotifications(data.timings, settings.notifications, notificationCoords).catch(() => {});
      } else {
        LocalNotifications.getPending()
          .then(pending => pending.notifications
            .filter(isScheduledPrayerNotification)
            .map(n => ({ id: n.id })))
          .then(notifications => {
            if (notifications.length) return LocalNotifications.cancel({ notifications });
          })
          .catch(() => {});
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
            setTimeout(() => fireNotification(prayer.name, cfg.preReminderMinutes), ahead)
          );
        }
      }
    });
    return () => azanTimers.current.forEach(clearTimeout);
  }, [data, settings.azanEnabled, settings.notifEnabled, settings.notifications, userCoords, lastSearch]);

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
      audio.play().catch(() => {});
      audioRef.current = audio;
    } catch {}
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
    playAzanUrl(adhanUrlFor(settings.azanSource, 'Fajr'));
  }

  async function fireTestNotification() {
    if (isNative) {
      try {
        const status = await LocalNotifications.checkPermissions();
        if (status.display !== 'granted') {
          const req = await LocalNotifications.requestPermissions();
          if (req.display !== 'granted') return;
        }
        await LocalNotifications.schedule({
          notifications: [{
            id: NOTIFICATION_ID_BASE + NOTIFICATION_ID_SPAN - 1,
            title: 'Azan Times — test',
            body: 'Notifications are working. ✅',
            schedule: { at: new Date(Date.now() + 1500) },
          }],
        });
      } catch {}
      return;
    }
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return;
    }
    new Notification('🕌 Azan Times — test', {
      body: 'Notifications are working. ✅',
    });
  }

  function fireNotification(prayerName, minutes) {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      new Notification('🕌 Azan Times', {
        body: `${prayerName} prayer starts in ${minutes} minute${minutes !== 1 ? 's' : ''}.`,
      });
    }
  }

  async function requestNotifPermission() {
    if (isNative) {
      const status = await LocalNotifications.requestPermissions();
      if (status.display === 'granted') updateSetting('notifEnabled', true);
      return;
    }
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
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
        resolvedParams = { ...params, label: await nativeLocationLabel(params) };
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
        setError(`Offline — showing cached times from ${new Date(cached.ts).toLocaleString()}`);
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  }, [settings.prayer]);

  async function scheduleNativeNotifications(timings, notificationSettings, coords) {
    if (!isNative) return;

    const pending = await LocalNotifications.getPending();
    const scheduledPrayerNotifications = pending.notifications
      .filter(isScheduledPrayerNotification)
      .map(n => ({ id: n.id }));
    if (scheduledPrayerNotifications.length) {
      await LocalNotifications.cancel({ notifications: scheduledPrayerNotifications });
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
              title: 'Prayer reminder',
              body: `${prayer.name} prayer starts in ${preMinutes} minute${preMinutes !== 1 ? 's' : ''}.`,
              schedule: { at: notifyAt },
              sound: cfg.vibrateOnly ? undefined : 'beep.wav',
            });
          }
        }

        if (prayerTime > now) {
          notifications.push({
            id: NOTIFICATION_ID_BASE + dayOffset * 100 + index,
            title: prayer.name,
            body: `It's time for ${prayer.name} prayer.`,
            schedule: { at: prayerTime },
            sound: soundFileForNotification(cfg.sound, cfg.vibrateOnly),
          });
        }
      });
    }

    if (notifications.length) {
      await LocalNotifications.schedule({ notifications });
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
    if (!navigator.geolocation) { setError('Geolocation not supported.'); return; }
    setLoading(true);
    setError(null);
    setShowSearch(false);
    navigator.geolocation.getCurrentPosition(
      pos => performSearch({ type: 'coords', lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { setLoading(false); setError('Location access denied. Search for a city instead.'); },
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
      ? 'Current Location'
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
  const isNightSky = skyKey === 'isha' || skyKey === 'fajr';
  return (
    <div className="app">
      {/* Sky-of-day full-bleed gradient layer */}
      <div className="sky-layer" aria-hidden="true" />
      <div className="sky-veil" aria-hidden="true" />
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

      {/* ── Settings Panel ── */}
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
                          {source.label}{source.unverified ? ' (preview)' : ''}
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
                    {getAdhanSource(settings.azanSource).description}
                    {getAdhanSource(settings.azanSource).unverified
                      ? ' Source URL needs verification before release.'
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
                      <option key={n} value={n}>{n} min before</option>
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
                            <div className="notif-prayer-name">{prayer.name}</div>
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
                              <span>Sound</span>
                              <select
                                className="method-select small"
                                value={cfg.sound}
                                onChange={e => updatePrayerNotification(prayer.key, { sound: e.target.value })}
                              >
                                {NOTIFICATION_SOUNDS.map(sound => (
                                  <option key={sound.id} value={sound.id}>{sound.label}</option>
                                ))}
                              </select>
                            </label>
                            <label>
                              <span>Reminder</span>
                              <select
                                className="method-select small"
                                value={cfg.preReminderMinutes}
                                onChange={e => updatePrayerNotification(prayer.key, { preReminderMinutes: Number(e.target.value) })}
                              >
                                {[0, 5, 10, 15, 30].map(n => (
                                  <option key={n} value={n}>{n === 0 ? 'Off' : `${n} min`}</option>
                                ))}
                              </select>
                            </label>
                            <label className="vibrate-check">
                              <input
                                type="checkbox"
                                checked={cfg.vibrateOnly}
                                onChange={e => updatePrayerNotification(prayer.key, { vibrateOnly: e.target.checked })}
                              />
                              <span>Vibrate only</span>
                            </label>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="setting-hint">iOS notification sounds use bundled files under 30 seconds. Full Adhan still plays only after the app opens.</p>
              </div>
            )}

            <div className="setting-group">
              <label className="setting-label">{t('settings.calculationMethod')}</label>
              <select
                className="method-select"
                value={settings.prayer.methodId}
                onChange={e => updatePrayerSetting('methodId', e.target.value)}
              >
                {METHOD_OPTIONS.map(m => (
                  <option key={m.id} value={m.id}>{getCalculationMethodOptionLabel(m.id)}</option>
                ))}
              </select>
              <p className="setting-hint">
                {selectedMethodDetails.summary}
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
                <label className="setting-label">High Latitude Rule</label>
                <select
                  className="method-select"
                  value={settings.prayer.highLatitudeRule}
                  onChange={e => updatePrayerSetting('highLatitudeRule', e.target.value)}
                >
                  <option value="">Method default</option>
                  <option value="MiddleOfTheNight">Middle of the night</option>
                  <option value="SeventhOfTheNight">Seventh of the night</option>
                  <option value="TwilightAngle">Twilight angle</option>
                </select>
              </div>
            )}

            <div className="setting-group">
              <label className="setting-label">{t('settings.manualOffsets')}</label>
              <p className="setting-hint">{t('settings.manualOffsets.hint')}</p>
              <div className="offset-list">
                {PRAYERS.map(prayer => (
                  <div key={prayer.key} className="offset-row">
                    <span>{prayer.name}</span>
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
                title="Search city"
                aria-label="Search city"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </button>
              <button
                className="icon-action"
                onClick={handleLocate}
                title="Use my location"
                aria-label="Use my location"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z"/>
                  <circle cx="12" cy="9" r="2.5"/>
                </svg>
              </button>
              <button className="icon-action" onClick={() => setShowSettings(true)} title="Settings" aria-label="Settings">
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
            <div className="search-input-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                className="search-input"
                placeholder={t('search.placeholder')}
                value={cityInput}
                onChange={e => setCityInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
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
            <p>Loading prayer times…</p>
          </div>
        )}

        {!loading && error && (
          <div className="error-box">
            <div className="error-icon">😕</div>
            <div className="error-title">{error}</div>
            <div className="error-hint">💡 Try "Makkah", "Istanbul", "Cairo, Egypt"</div>
          </div>
        )}

        {!loading && !error && !data && (
          <div className="welcome-state">
            <div className="welcome-mosque">🕌</div>
            <p className="welcome-bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
            <h2 className="welcome-title">{t('welcome.title')}</h2>
            <p className="welcome-text">{t('welcome.text')}</p>
            <div className="welcome-divider">── ✦ ──</div>
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* Location banner */}
            <div className="location-banner">
              <div className="city-row">
                <svg className="loc-pin" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
                <div className="city-name">{cityName}</div>
              </div>
              <div className="date-info">{formatGregorianDate(data.date, lang)}</div>
              {displayHijri && <div className="hijri">{formatHijriDate(displayHijri, lang)}</div>}
            </div>

            {/* Sun strip */}
            <div className="sun-strip">
              <div className="sun-item rise">
                <div className="sun-icon"><PrayerIcon name="sunrise" size={18} /></div>
                <div className="sun-detail">
                  <div className="sun-label">{t('sun.sunrise')}</div>
                  <div className="sun-time">{formatTime(data.timings.Sunrise, settings.use24h)}</div>
                </div>
              </div>
              <div className="sun-item set">
                <div className="sun-icon"><PrayerIcon name="maghrib" size={18} /></div>
                <div className="sun-detail">
                  <div className="sun-label">{t('sun.sunset')}</div>
                  <div className="sun-time">{formatTime(data.timings.Sunset, settings.use24h)}</div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="tabs">
              {['today', 'weekly', 'qibla', 'hijri', 'tasbih'].map(tab => (
                <button
                  key={tab}
                  className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => handleTabChange(tab)}
                >
                  {t(`tab.${tab}`)}
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
                    <div className="hero-sun" aria-hidden="true" />

                    {/* Large glowing prayer icon */}
                    <div className="hero-icon-wrap">
                      <div className="hero-icon-ring" />
                      <div className="hero-icon"><PrayerIcon name={nextPrayerData.key} size={48} stroke={1.4} /></div>
                    </div>

                    <div className="countdown-hero-names">
                      <span className="countdown-name-ar">{nextPrayerData.arabic}</span>
                      <span className="countdown-name-en">{nextPrayerData.name}</span>
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
                          <div className="prayer-icon"><PrayerIcon name={p.key} size={22} /></div>
                          <div>
                            <div className="prayer-name">
                              {p.name}
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
              />
            )}

            {/* Qibla tab */}
            {activeTab === 'qibla' && (
              <QiblaCompass userCoords={userCoords} onLocate={handleLocate} />
            )}

            {/* Hijri tab */}
            {activeTab === 'hijri' && (
              <HijriCalendar
                offsetDays={settings.hijriOffset}
                onOffsetChange={value => updateSetting('hijriOffset', value)}
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
          {' '}{t('footer.audioBy')} <a href="https://islamic.network" target="_blank" rel="noreferrer">Islamic Network</a>
        </div>
      </div>
    </div>
  );
}
