import React, { useState, useEffect, useRef } from 'react';
import { calculateQibla } from '../utils/prayers';
import { reportError, reportEvent } from '../utils/monitoring';

// Circular low-pass smoothing factor (0 = no smoothing, 1 = full).
// 0.15 gives a calm, lag-free needle on iOS at 30-60 Hz.
const HEADING_SMOOTHING = 0.15;

function shortestAngleDelta(from, to) {
  let delta = ((to - from + 540) % 360) - 180;
  return delta;
}

export default function QiblaCompass({ userCoords, onLocate, t }) {
  const [qiblaAngle, setQiblaAngle] = useState(null);
  const [deviceHeading, setDeviceHeading] = useState(null);
  const [orientationSupported, setOrientationSupported] = useState(null);
  const [distance, setDistance] = useState(null);
  const smoothedRef = useRef(null);
  const rafRef = useRef(null);
  const pendingHeadingRef = useRef(null);

  useEffect(() => {
    if (!userCoords) return;
    const angle = calculateQibla(userCoords.lat, userCoords.lng);
    setQiblaAngle(angle);

    // Calculate distance to Makkah in km (Haversine)
    const R = 6371;
    const lat1 = userCoords.lat * (Math.PI / 180);
    const lat2 = 21.4225 * (Math.PI / 180);
    const dLat = lat2 - lat1;
    const dLon = (39.8262 - userCoords.lng) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    setDistance(Math.round(km).toLocaleString());
  }, [userCoords]);

  // Read raw heading from event, store as "pending" to be smoothed on rAF.
  function readHeading(e) {
    if (e.webkitCompassHeading !== undefined && e.webkitCompassHeading !== null) {
      return e.webkitCompassHeading;
    }
    if (e.alpha !== null && e.alpha !== undefined) {
      return (360 - e.alpha + 360) % 360;
    }
    return null;
  }

  function startSmoothingLoop() {
    if (rafRef.current != null) return;
    const tick = () => {
      const target = pendingHeadingRef.current;
      if (target != null) {
        const current = smoothedRef.current;
        if (current == null) {
          smoothedRef.current = target;
        } else {
          const delta = shortestAngleDelta(current, target);
          smoothedRef.current = (current + delta * HEADING_SMOOTHING + 360) % 360;
        }
        setDeviceHeading(smoothedRef.current);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function stopSmoothingLoop() {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  function handleOrientation(e) {
    const heading = readHeading(e);
    if (heading == null) return;
    pendingHeadingRef.current = heading;
    setOrientationSupported(true);
  }

  useEffect(() => {
    if (!window.DeviceOrientationEvent) return undefined;
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      setOrientationSupported(false); // gated — show enable button
      return undefined;
    }
    window.addEventListener('deviceorientation', handleOrientation);
    startSmoothingLoop();
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      stopSmoothingLoop();
    };
  }, []);

  async function requestOrientation() {
    try {
      const perm = await DeviceOrientationEvent.requestPermission();
      reportEvent('qibla_orientation_permission', { status: perm });
      if (perm === 'granted') {
        window.addEventListener('deviceorientation', handleOrientation);
        startSmoothingLoop();
      }
    } catch (error) {
      reportError(error, { feature: 'qibla_orientation_permission' });
    }
  }

  if (!userCoords) {
    return (
      <div className="qibla-empty">
        <div className="qibla-empty-icon">🧭</div>
        <p className="qibla-empty-title">{t('qibla.locationRequired')}</p>
        <p className="qibla-empty-text">{t('qibla.locationText')}</p>
        <button className="btn btn-search" onClick={onLocate}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z"/>
            <circle cx="12" cy="9" r="2.5"/>
          </svg>
          {t('search.useLocation')}
        </button>
      </div>
    );
  }

  // The needle rotation: if device heading known, correct for it
  const needleRotation =
    deviceHeading !== null && qiblaAngle !== null
      ? qiblaAngle - deviceHeading
      : qiblaAngle ?? 0;

  return (
    <div className="qibla-wrap">
      <div className="qibla-header">
        <h2 className="qibla-title">{t('qibla.title')}</h2>
        {distance && (
          <p className="qibla-distance">
            {t('qibla.distance', { distance })}
          </p>
        )}
      </div>

      {orientationSupported === false && (
        <button className="btn btn-locate qibla-perm-btn" onClick={requestOrientation}>
          {t('qibla.enableCompass')}
        </button>
      )}

      <div className="compass-container">
        {/* Compass rose (static) */}
        <div className="compass-rose">
          <span className="compass-dir n">N</span>
          <span className="compass-dir e">E</span>
          <span className="compass-dir s">S</span>
          <span className="compass-dir w">W</span>

          {/* Degree ticks */}
          {Array.from({ length: 36 }).map((_, i) => (
            <div
              key={i}
              className={`compass-tick ${i % 9 === 0 ? 'major' : ''}`}
              style={{ transform: `rotate(${i * 10}deg)` }}
            />
          ))}
        </div>

        {/* Qibla needle */}
        <div
          className="compass-needle-wrap"
          style={{ transform: `rotate(${needleRotation}deg)` }}
        >
          <div className="compass-needle">
            <div className="needle-kaaba">🕋</div>
            <div className="needle-line" />
            <div className="needle-tail" />
          </div>
        </div>

        {/* Center dot */}
        <div className="compass-center" />
      </div>

      <div className="qibla-angle">
        {qiblaAngle !== null && (
          <span>{t('qibla.angleFromNorth', { angle: Math.round(qiblaAngle) })}</span>
        )}
        {deviceHeading !== null && (
          <span className="qibla-heading"> · {t('qibla.heading', { heading: Math.round(deviceHeading) })}</span>
        )}
      </div>

      {!deviceHeading && (
        <p className="qibla-note">
          {t('qibla.note')}
        </p>
      )}
    </div>
  );
}
