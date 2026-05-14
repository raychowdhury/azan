import { Capacitor } from '@capacitor/core';

function isIOS() {
  if (Capacitor.getPlatform?.() === 'ios') return true;
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

export function directionsUrl(mosque) {
  if (!mosque?.coordinates) return null;
  const { lat, lng } = mosque.coordinates;
  const name = encodeURIComponent(mosque.name || 'Mosque');
  if (isIOS()) {
    return `https://maps.apple.com/?daddr=${lat},${lng}&q=${name}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${name}`;
}

export function viewOnMapUrl(mosque) {
  if (!mosque?.coordinates) return null;
  const { lat, lng } = mosque.coordinates;
  const name = encodeURIComponent(mosque.name || 'Mosque');
  if (isIOS()) {
    return `https://maps.apple.com/?ll=${lat},${lng}&q=${name}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${name}`;
}

export function openUrl(url) {
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}
