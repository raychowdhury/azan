import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { searchNearbyMosques, clearMosqueCache } from '../features/mosques/providers';
import { DEFAULT_RADIUS_MILES, RADIUS_OPTIONS_MILES } from '../types/mosque';
import { formatMiles, haversineMiles } from '../utils/distance';
import { directionsUrl, openUrl, viewOnMapUrl } from '../features/mosques/maps';
import {
  loadFavorites,
  toggleFavorite,
  isFavorite,
  loadHomeMosqueId,
  setHomeMosqueId,
} from '../features/mosques/favorites';
import { isVerifiedDbEnabled } from '../features/mosques/supabase';
import MosqueSubmitForm from './MosqueSubmitForm';
import { useT } from '../i18n';

const LOCATION_STATUS = {
  IDLE: 'idle',
  REQUESTING: 'requesting',
  GRANTED: 'granted',
  DENIED: 'denied',
  UNSUPPORTED: 'unsupported',
};

export default function NearbyMosques({ userCoords, onLocate }) {
  const { t } = useT();
  const [origin, setOrigin] = useState(userCoords || null);
  const [locationStatus, setLocationStatus] = useState(
    userCoords ? LOCATION_STATUS.GRANTED : LOCATION_STATUS.IDLE,
  );
  const [radius, setRadius] = useState(DEFAULT_RADIUS_MILES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const [favorites, setFavorites] = useState(() => loadFavorites());
  const [homeId, setHomeIdState] = useState(() => loadHomeMosqueId());
  const [submitFor, setSubmitFor] = useState(null);
  const [showSubmit, setShowSubmit] = useState(false);

  useEffect(() => {
    if (userCoords) {
      setOrigin(userCoords);
      setLocationStatus(LOCATION_STATUS.GRANTED);
    }
  }, [userCoords]);

  const reqIdRef = useRef(0);
  const abortRef = useRef(null);

  const performSearch = useCallback(async (point, miles, { bypassCache = false } = {}) => {
    if (!point) return;
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const myId = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    if (bypassCache) clearMosqueCache();
    try {
      const { mosques, errors } = await searchNearbyMosques({
        origin: point,
        radiusMiles: miles,
        signal: ctrl.signal,
      });
      if (myId !== reqIdRef.current) return;
      if (errors?.length) console.warn('mosque providers had partial errors:', errors);
      setResults(mosques);
    } catch (e) {
      if (e?.name === 'AbortError') return;
      if (myId !== reqIdRef.current) return;
      console.warn('mosque search failed:', e?.message);
      // Show short, friendly message. Detailed string is in console for diag.
      const friendly = miles >= 10
        ? t('mosques.errorBusy')
        : t('mosques.errorGeneric');
      setError(friendly);
      setResults([]);
    } finally {
      if (myId === reqIdRef.current) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (origin) performSearch(origin, radius);
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [origin, radius, performSearch]);

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationStatus(LOCATION_STATUS.UNSUPPORTED);
      return;
    }
    setLocationStatus(LOCATION_STATUS.REQUESTING);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setOrigin(next);
        setLocationStatus(LOCATION_STATUS.GRANTED);
        onLocate?.(next);
      },
      (err) => {
        setLocationStatus(err?.code === 1 ? LOCATION_STATUS.DENIED : LOCATION_STATUS.IDLE);
        setError(err?.code === 1 ? t('mosques.locationDenied') : t('mosques.locationFailed'));
      },
      { enableHighAccuracy: true, maximumAge: 5 * 60 * 1000, timeout: 20000 },
    );
  }

  function handleToggleFavorite(mosque) {
    const next = toggleFavorite(mosque);
    setFavorites(next);
    if (homeId === mosque.id && !next.find((m) => m.id === mosque.id)) {
      setHomeMosqueId(null);
      setHomeIdState(null);
    }
  }

  function handleSetHome(mosque) {
    if (!isFavorite(mosque.id)) {
      const next = toggleFavorite(mosque);
      setFavorites(next);
    }
    const nextId = homeId === mosque.id ? null : mosque.id;
    setHomeMosqueId(nextId);
    setHomeIdState(nextId);
  }

  const savedWithDistance = useMemo(() => {
    if (!favorites.length) return [];
    return favorites.map((m) => ({
      ...m,
      distanceMiles: origin && m.coordinates ? haversineMiles(origin, m.coordinates) : Infinity,
    }));
  }, [favorites, origin]);

  const homeMosque = useMemo(() => {
    if (!homeId) return null;
    return savedWithDistance.find((m) => m.id === homeId) || null;
  }, [homeId, savedWithDistance]);

  const showRetry = locationStatus === LOCATION_STATUS.DENIED
    || locationStatus === LOCATION_STATUS.IDLE
    || locationStatus === LOCATION_STATUS.UNSUPPORTED;

  return (
    <div className="mosques-wrap">
      <header className="mosques-header">
        <h2 className="mosques-title">{t('mosques.title')}</h2>
        <p className="mosques-subtitle">{t('mosques.subtitle')}</p>
        <LocationBadge status={locationStatus} t={t} />
      </header>

      {homeMosque && (
        <section className="mosques-home">
          <div className="mosques-home-label">{t('mosques.homeMosque')}</div>
          <MosqueCard
            mosque={homeMosque}
            highlight
            favorite
            isHome
            onToggleFavorite={handleToggleFavorite}
            onSetHome={handleSetHome}
            t={t}
          />
        </section>
      )}

      <div className="mosques-controls">
        <div className="mosques-radius">
          <span className="mosques-radius-label">{t('mosques.radius')}</span>
          <div className="toggle-row mosques-radius-row">
            {RADIUS_OPTIONS_MILES.map((r) => (
              <button
                key={r}
                type="button"
                className={`theme-btn ${r === radius ? 'active' : ''}`}
                onClick={() => setRadius(r)}
              >
                {r} mi
              </button>
            ))}
          </div>
        </div>
        <div className="mosques-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => origin ? performSearch(origin, radius, { bypassCache: true }) : requestLocation()}
            disabled={loading}
          >
            {loading ? t('mosques.loading') : t('mosques.refresh')}
          </button>
          {isVerifiedDbEnabled() && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => { setSubmitFor(null); setShowSubmit(true); }}
            >
              {t('mosques.submit')}
            </button>
          )}
        </div>
      </div>

      {!origin && (
        <EmptyState
          title={t('mosques.locationRequired')}
          text={t('mosques.locationRequiredText')}
          actionLabel={t('mosques.useLocation')}
          onAction={requestLocation}
        />
      )}

      {origin && loading && (
        <div className="status-msg">
          <div className="spinner" />
          <p>{t('mosques.searching')}</p>
        </div>
      )}

      {origin && !loading && error && (
        <EmptyState
          title={t('mosques.errorTitle')}
          text={error}
          actionLabel={radius >= 10 ? t('mosques.tryFiveMi') : (showRetry ? t('mosques.tryAgain') : t('mosques.refresh'))}
          onAction={() => {
            if (radius >= 10) {
              setRadius(5);
            } else if (showRetry) {
              requestLocation();
            } else {
              performSearch(origin, radius, { bypassCache: true });
            }
          }}
        />
      )}

      {origin && !loading && !error && results.length === 0 && (
        <EmptyState
          title={t('mosques.emptyTitle')}
          text={t('mosques.emptyText')}
          actionLabel={t('mosques.refresh')}
          onAction={() => performSearch(origin, radius, { bypassCache: true })}
        />
      )}

      {origin && !loading && results.length > 0 && (
        <ul className="mosques-list" aria-label={t('mosques.title')}>
          {results
            .filter((m) => m.id !== homeId)
            .map((m) => (
              <li key={m.id}>
                <MosqueCard
                  mosque={m}
                  favorite={favorites.some((f) => f.id === m.id)}
                  isHome={false}
                  onToggleFavorite={handleToggleFavorite}
                  onSetHome={handleSetHome}
                  onSubmitDetails={isVerifiedDbEnabled()
                    ? () => { setSubmitFor(m); setShowSubmit(true); }
                    : null}
                  t={t}
                />
              </li>
            ))}
        </ul>
      )}

      {savedWithDistance.length > 0 && (() => {
        const resultIds = new Set(results.map((m) => m.id));
        const savedOnly = savedWithDistance.filter(
          (m) => m.id !== homeId && !resultIds.has(m.id),
        );
        if (savedOnly.length === 0) return null;
        return (
          <section className="mosques-saved">
            <div className="section-eyebrow">{t('mosques.saved')}</div>
            <ul className="mosques-list">
              {savedOnly.map((m) => (
                <li key={`fav-${m.id}`}>
                  <MosqueCard
                    mosque={m}
                    favorite
                    isHome={false}
                    onToggleFavorite={handleToggleFavorite}
                    onSetHome={handleSetHome}
                    t={t}
                    compact
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })()}

      {showSubmit && (
        <MosqueSubmitForm
          origin={origin}
          prefill={submitFor}
          onClose={() => setShowSubmit(false)}
          onSubmitted={() => { /* keep modal open with thank-you state */ }}
        />
      )}
    </div>
  );
}

function LocationBadge({ status, t }) {
  const tone =
    status === 'granted' ? 'ok'
    : status === 'denied' ? 'err'
    : status === 'unsupported' ? 'err'
    : 'warn';
  const label =
    status === 'granted' ? t('mosques.locStatus.on')
    : status === 'denied' ? t('mosques.locStatus.denied')
    : status === 'unsupported' ? t('mosques.locStatus.unsupported')
    : t('mosques.locStatus.off');
  return (
    <div className={`mosques-loc-status ${tone}`}>
      <span className="mosques-loc-dot" aria-hidden="true" />
      {label}
    </div>
  );
}

function EmptyState({ title, text, actionLabel, onAction }) {
  return (
    <div className="mosques-empty">
      <div className="mosques-empty-icon" aria-hidden="true">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 21V11c0-2 2-4 4-4h8c2 0 4 2 4 4v10" />
          <path d="M4 21h16" />
          <path d="M9 21v-4a3 3 0 0 1 6 0v4" />
          <path d="M12 3v4M10.5 4.5h3" />
        </svg>
      </div>
      <p className="mosques-empty-title">{title}</p>
      <p className="mosques-empty-text">{text}</p>
      {actionLabel && (
        <button type="button" className="btn btn-search" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function MosqueCard({
  mosque,
  favorite,
  isHome,
  highlight,
  compact,
  onToggleFavorite,
  onSetHome,
  onSubmitDetails,
  t,
}) {
  const verified = mosque.source === 'verified_db' && mosque.verified;
  const iqamahEntries = mosque.iqamah ? Object.entries(mosque.iqamah).filter(([, v]) => v) : [];
  const jumuah = Array.isArray(mosque.jumuah) ? mosque.jumuah : [];

  return (
    <article className={`mosque-card ${highlight ? 'highlight' : ''} ${compact ? 'compact' : ''}`}>
      <div className="mosque-card-top">
        <div className="mosque-card-titles">
          <div className="mosque-card-name">
            {mosque.name}
            {verified && <span className="mosque-badge verified" title={t('mosques.verifiedHint')}>{t('mosques.verified')}</span>}
            {isHome && <span className="mosque-badge home">{t('mosques.home')}</span>}
          </div>
          <div className="mosque-card-meta">
            <span>{formatMiles(mosque.distanceMiles)}</span>
            {mosque.address && <span className="mosque-card-dot">·</span>}
            {mosque.address && <span className="mosque-card-address">{mosque.address}</span>}
          </div>
        </div>
        <div className="mosque-card-faves">
          <button
            type="button"
            className={`mosque-icon-btn ${favorite ? 'on' : ''}`}
            onClick={() => onToggleFavorite?.(mosque)}
            aria-label={favorite ? t('mosques.removeFavorite') : t('mosques.addFavorite')}
            title={favorite ? t('mosques.removeFavorite') : t('mosques.addFavorite')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill={favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 17.3-6.18 3.7 1.64-7.03L2 9.24l7.19-.61L12 2l2.81 6.63 7.19.61-5.46 4.73L18.18 21z" />
            </svg>
          </button>
          <button
            type="button"
            className={`mosque-icon-btn ${isHome ? 'on' : ''}`}
            onClick={() => onSetHome?.(mosque)}
            aria-label={isHome ? t('mosques.unsetHome') : t('mosques.setHome')}
            title={isHome ? t('mosques.unsetHome') : t('mosques.setHome')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11 12 3l9 8" />
              <path d="M5 10v10h14V10" />
            </svg>
          </button>
        </div>
      </div>

      {(iqamahEntries.length > 0 || jumuah.length > 0) && !compact && (
        <div className="mosque-card-iqamah">
          {iqamahEntries.length > 0 && (
            <div className="mosque-iqamah-row">
              <span className="mosque-iqamah-label">{t('mosques.iqamah')}</span>
              <div className="mosque-iqamah-pills">
                {iqamahEntries.map(([k, v]) => (
                  <span key={k} className="mosque-iqamah-pill">
                    <strong>{k}</strong> {v}
                  </span>
                ))}
              </div>
            </div>
          )}
          {jumuah.length > 0 && (
            <div className="mosque-iqamah-row">
              <span className="mosque-iqamah-label">{t('mosques.jumuah')}</span>
              <div className="mosque-iqamah-pills">
                {jumuah.map((j, i) => (
                  <span key={i} className="mosque-iqamah-pill">{j.time}{j.language ? ` · ${j.language}` : ''}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mosque-card-actions">
        <button
          type="button"
          className="btn btn-search mosque-action-primary"
          onClick={() => openUrl(directionsUrl(mosque))}
        >
          {t('mosques.directions')}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => openUrl(viewOnMapUrl(mosque))}
        >
          {t('mosques.openInMaps')}
        </button>
        {mosque.phone && (
          <a className="btn-secondary" href={`tel:${mosque.phone.replace(/\s+/g, '')}`}>
            {t('mosques.call')}
          </a>
        )}
        {mosque.website && (
          <a
            className="btn-secondary"
            href={mosque.website}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('mosques.website')}
          </a>
        )}
        {onSubmitDetails && !verified && (
          <button type="button" className="btn-secondary subtle" onClick={onSubmitDetails}>
            {t('mosques.submitDetails')}
          </button>
        )}
      </div>
    </article>
  );
}
