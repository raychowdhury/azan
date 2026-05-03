import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PRAYERS, METHODS, pad, parseTime, formatTime, getNextPrayer, getActivePrayer, getPrayerProgress } from './utils/prayers';
import { fetchByCity, fetchByCoords, fetchWeeklyByCity, fetchWeeklyByCoords } from './utils/api';
import QiblaCompass from './components/QiblaCompass';
import WeeklyView from './components/WeeklyView';

const AZAN_CDN = 'https://cdn.islamic.network/prayer-times/audio/Mishary_Rashid_Alafasy/mp3/';
const isNative = Capacitor.isNativePlatform();
const ReverseGeocoder = registerPlugin('ReverseGeocoder');
const NOTIFICATION_ID_BASE = 4200;

const defaultSettings = {
  use24h: false,
  theme: 'dark',
  azanEnabled: false,
  notifEnabled: false,
  notifMinutes: 10,
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
  const [data, setData]               = useState(null);
  const [weeklyData, setWeeklyData]   = useState(null);
  const [weeklyLoading, setWL]        = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [cityInput, setCityInput]     = useState('');
  const [method, setMethod]           = useState(() => loadStorage('method', '3'));
  const [lastSearch, setLastSearch]   = useState(() => loadStorage('lastSearch', null));
  const [activeTab, setActiveTab]     = useState('today');
  const [showSearch, setShowSearch]   = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [countdown, setCountdown]     = useState({ h: 0, m: 0, s: 0 });
  const [nextPrayer, setNextPrayer]   = useState(null);
  const [userCoords, setUserCoords]   = useState(null);
  const [settings, setSettings]       = useState(() => loadStorage('settings', defaultSettings));

  const countdownRef   = useRef(null);
  const azanTimers     = useRef([]);
  const audioRef       = useRef(null);
  const searchInputRef = useRef(null);

  // ── Apply theme ──────────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  // ── Persist settings / method ────────────────────────────────────────────────
  useEffect(() => { localStorage.setItem('settings', JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem('method', method); }, [method]);

  // ── Auto-load on mount ───────────────────────────────────────────────────────
  useEffect(() => {
    if (lastSearch) {
      performSearch(lastSearch, false);
    }
  }, []);

  useEffect(() => {
    if (showSearch) searchInputRef.current?.focus();
  }, [showSearch]);

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
        scheduleNativeNotifications(data.timings, settings.notifMinutes).catch(() => {});
      } else {
        LocalNotifications.getPending()
          .then(pending => pending.notifications
            .filter(n => n.id >= NOTIFICATION_ID_BASE && n.id < NOTIFICATION_ID_BASE + 100)
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
      const pTime = parseTime(data.timings[prayer.key]);
      const msUntil = pTime - now;
      if (msUntil <= 0 || msUntil > 24 * 3600 * 1000) return;

      if (settings.azanEnabled && prayer.obligatory) {
        azanTimers.current.push(setTimeout(() => playAzan(prayer.key), msUntil));
      }
      if (!isNative && settings.notifEnabled) {
        const ahead = msUntil - settings.notifMinutes * 60 * 1000;
        if (ahead > 0) {
          azanTimers.current.push(
            setTimeout(() => fireNotification(prayer.name, settings.notifMinutes), ahead)
          );
        }
      }
    });
    return () => azanTimers.current.forEach(clearTimeout);
  }, [data, settings.azanEnabled, settings.notifEnabled, settings.notifMinutes]);

  function playAzan(prayerKey) {
    try {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      const audio = new Audio(`${AZAN_CDN}${prayerKey}.mp3`);
      audio.volume = 1;
      audio.play().catch(() => {});
      audioRef.current = audio;
    } catch {}
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

  // ── Core search ──────────────────────────────────────────────────────────────
  const performSearch = useCallback(async (params, showLoader = true) => {
    if (showLoader) setLoading(true);
    setError(null);
    try {
      let result;
      let resolvedParams;
      if (params.type === 'city') {
        result = await fetchByCity(params.city, params.country, method);
        resolvedParams = { ...params, label: searchLabel(params) };
      } else {
        result = await fetchByCoords(params.lat, params.lng, method);
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
  }, [method]);

  async function scheduleNativeNotifications(timings, minutes) {
    if (!isNative) return;

    const pending = await LocalNotifications.getPending();
    const scheduledPrayerNotifications = pending.notifications
      .filter(n => n.id >= NOTIFICATION_ID_BASE && n.id < NOTIFICATION_ID_BASE + 100)
      .map(n => ({ id: n.id }));
    if (scheduledPrayerNotifications.length) {
      await LocalNotifications.cancel({ notifications: scheduledPrayerNotifications });
    }

    const now = new Date();
    const notifications = PRAYERS
      .filter(prayer => prayer.obligatory && timings[prayer.key])
      .map((prayer, index) => {
        const prayerTime = parseTime(timings[prayer.key]);
        const notifyAt = new Date(prayerTime.getTime() - minutes * 60 * 1000);
        if (notifyAt <= now) return null;

        return {
          id: NOTIFICATION_ID_BASE + index,
          title: 'Azan Times',
          body: `${prayer.name} prayer starts in ${minutes} minute${minutes !== 1 ? 's' : ''}.`,
          schedule: { at: notifyAt },
          sound: 'default',
        };
      })
      .filter(Boolean);

    if (notifications.length) {
      await LocalNotifications.schedule({ notifications });
    }
  }

  async function loadWeekly(params) {
    setWL(true);
    try {
      let result;
      if (!params) throw new Error('No location');
      if (params.type === 'city') {
        result = await fetchWeeklyByCity(params.city, params.country, method);
      } else {
        result = await fetchWeeklyByCoords(params.lat, params.lng, method);
      }
      setWeeklyData(result);
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

  function handleMethodChange(val) {
    setMethod(val);
    if (lastSearch) performSearch(lastSearch);
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

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      {/* ── Settings Panel ── */}
      {showSettings && (
        <div className="settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-panel" onClick={e => e.stopPropagation()}>
            <div className="settings-header">
              <h3>Settings</h3>
              <button className="settings-close" onClick={() => setShowSettings(false)}>✕</button>
            </div>

            <div className="setting-group">
              <label className="setting-label">Theme</label>
              <div className="toggle-row">
                <button
                  className={`theme-btn ${settings.theme === 'dark' ? 'active' : ''}`}
                  onClick={() => updateSetting('theme', 'dark')}
                >🌙 Dark</button>
                <button
                  className={`theme-btn ${settings.theme === 'light' ? 'active' : ''}`}
                  onClick={() => updateSetting('theme', 'light')}
                >☀️ Light</button>
              </div>
            </div>

            <div className="setting-group">
              <label className="setting-label">Time Format</label>
              <div className="toggle-row">
                <button
                  className={`theme-btn ${!settings.use24h ? 'active' : ''}`}
                  onClick={() => updateSetting('use24h', false)}
                >12-hour</button>
                <button
                  className={`theme-btn ${settings.use24h ? 'active' : ''}`}
                  onClick={() => updateSetting('use24h', true)}
                >24-hour</button>
              </div>
            </div>

            <div className="setting-group">
              <div className="setting-row">
                <div>
                  <label className="setting-label">Azan Audio</label>
                  <p className="setting-hint">Play azan when prayer time arrives</p>
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
            </div>

            <div className="setting-group">
              <div className="setting-row">
                <div>
                  <label className="setting-label">Prayer Notifications</label>
                  <p className="setting-hint">Browser alert before prayer time</p>
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
                  <span className="setting-hint">Alert</span>
                  <select
                    className="method-select small"
                    value={settings.notifMinutes}
                    onChange={e => updateSetting('notifMinutes', Number(e.target.value))}
                  >
                    {[5, 10, 15, 20, 30].map(n => (
                      <option key={n} value={n}>{n} min before</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="setting-group">
              <label className="setting-label">Calculation Method</label>
              <select
                className="method-select"
                value={method}
                onChange={e => handleMethodChange(e.target.value)}
              >
                {METHODS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
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
          <h1>Azan Times</h1>
          <p className="header-arabic">أوقات الصلاة</p>
          <p className="header-sub">Accurate prayer schedules for any city worldwide</p>
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
                placeholder="Search city — e.g. Istanbul, Makkah, London…"
                value={cityInput}
                onChange={e => setCityInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <button className="btn btn-search" onClick={handleSearch}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              Search
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
            <h2 className="welcome-title">Prayer Times</h2>
            <p className="welcome-text">Search for any city or tap <strong>My Location</strong> to view today's prayer schedule</p>
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
              <div className="date-info">{data.date.readable}</div>
              <div className="hijri">
                {data.date.hijri.day} {data.date.hijri.month.ar} {data.date.hijri.year}
                <span className="hijri-sep">·</span>
                {data.date.hijri.day} {data.date.hijri.month.en} {data.date.hijri.year} AH
              </div>
            </div>

            {/* Sun strip */}
            <div className="sun-strip">
              <div className="sun-item rise">
                <div className="sun-icon">🌅</div>
                <div className="sun-detail">
                  <div className="sun-label">Sunrise</div>
                  <div className="sun-time">{formatTime(data.timings.Sunrise, settings.use24h)}</div>
                </div>
              </div>
              <div className="sun-item set">
                <div className="sun-icon">🌇</div>
                <div className="sun-detail">
                  <div className="sun-label">Sunset</div>
                  <div className="sun-time">{formatTime(data.timings.Sunset, settings.use24h)}</div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="tabs">
              {['today', 'weekly', 'qibla'].map(tab => (
                <button
                  key={tab}
                  className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => handleTabChange(tab)}
                >
                  {tab === 'today' ? '🕐 Today' : tab === 'weekly' ? '📅 Weekly' : '🧭 Qibla'}
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
                      <span className="countdown-name-en">{nextPrayerData.name}</span>
                    </div>
                    <div className="countdown-hero-label">Time Remaining</div>
                    <div className="countdown-digits">
                      <div className="digit-block">
                        <span className="digit-num">{pad(countdown.h)}</span>
                        <span className="digit-label">HRS</span>
                      </div>
                      <span className="digit-sep">:</span>
                      <div className="digit-block">
                        <span className="digit-num">{pad(countdown.m)}</span>
                        <span className="digit-label">MIN</span>
                      </div>
                      <span className="digit-sep">:</span>
                      <div className="digit-block">
                        <span className="digit-num">{pad(countdown.s)}</span>
                        <span className="digit-label">SEC</span>
                      </div>
                    </div>
                    {/* Prayer time */}
                    <div className="countdown-prayer-time">
                      ◈ Begins at {formatTime(data.timings[nextPrayerData.key], settings.use24h)}
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
                              {p.name}
                              {isNext && <span className="next-badge">Next</span>}
                              {isActive && !isNext && <span className="active-badge">Current</span>}
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
                    Azan audio {settings.azanEnabled ? 'enabled' : 'disabled'}
                    {settings.notifEnabled ? ` · Notifications ${settings.notifMinutes}min before` : ''}
                  </span>
                  <button className="azan-settings-link" onClick={() => setShowSettings(true)}>
                    Configure →
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
          </>
        )}

        <div className="footer">
          Powered by <a href="https://aladhan.com/prayer-times-api" target="_blank" rel="noreferrer">Aladhan API</a> ·
          Audio by <a href="https://islamic.network" target="_blank" rel="noreferrer">Islamic Network</a>
        </div>
      </div>
    </div>
  );
}
