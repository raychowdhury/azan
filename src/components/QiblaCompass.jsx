import React, { useState, useEffect } from 'react';
import { calculateQibla } from '../utils/prayers';

export default function QiblaCompass({ userCoords, onLocate }) {
  const [qiblaAngle, setQiblaAngle] = useState(null);
  const [deviceHeading, setDeviceHeading] = useState(null);
  const [orientationSupported, setOrientationSupported] = useState(null);
  const [distance, setDistance] = useState(null);

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

  useEffect(() => {
    const handler = (e) => {
      if (e.webkitCompassHeading !== undefined) {
        setDeviceHeading(e.webkitCompassHeading);
        setOrientationSupported(true);
      } else if (e.alpha !== null) {
        setDeviceHeading(360 - e.alpha);
        setOrientationSupported(true);
      }
    };

    if (window.DeviceOrientationEvent) {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        // iOS 13+ requires permission
        setOrientationSupported(false); // will show button
      } else {
        window.addEventListener('deviceorientation', handler);
        return () => window.removeEventListener('deviceorientation', handler);
      }
    }
  }, []);

  async function requestOrientation() {
    try {
      const perm = await DeviceOrientationEvent.requestPermission();
      if (perm === 'granted') {
        const handler = (e) => {
          if (e.webkitCompassHeading !== undefined) {
            setDeviceHeading(e.webkitCompassHeading);
            setOrientationSupported(true);
          }
        };
        window.addEventListener('deviceorientation', handler);
      }
    } catch {}
  }

  if (!userCoords) {
    return (
      <div className="qibla-empty">
        <div className="qibla-empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9"/>
            <path d="m15 9-2 6-4 1 1-4Z"/>
          </svg>
        </div>
        <p className="qibla-empty-title">Location Required</p>
        <p className="qibla-empty-text">Qibla direction needs your coordinates.</p>
        <button className="btn btn-search" onClick={onLocate}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z"/>
            <circle cx="12" cy="9" r="2.5"/>
          </svg>
          Use My Location
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
        <h2 className="qibla-title">Qibla Direction</h2>
        {distance && (
          <p className="qibla-distance">
            {distance} km from Makkah
          </p>
        )}
      </div>

      {orientationSupported === false && (
        <button className="btn btn-locate qibla-perm-btn" onClick={requestOrientation}>
          Enable Compass
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
            <div className="needle-kaaba" aria-label="Kaaba">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="7" width="14" height="13" rx="0.5"/>
                <path d="M5 11h14" strokeWidth="2.5"/>
                <path d="M9 7V5h6v2"/>
              </svg>
            </div>
            <div className="needle-line" />
            <div className="needle-tail" />
          </div>
        </div>

        {/* Center dot */}
        <div className="compass-center" />
      </div>

      <div className="qibla-angle">
        {qiblaAngle !== null && (
          <span>{Math.round(qiblaAngle)}° from North</span>
        )}
        {deviceHeading !== null && (
          <span className="qibla-heading"> · Heading: {Math.round(deviceHeading)}°</span>
        )}
      </div>

      {!deviceHeading && (
        <p className="qibla-note">
          Point your phone North and align the arrow toward the Kaaba icon.
        </p>
      )}
    </div>
  );
}
