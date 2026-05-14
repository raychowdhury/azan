// Google Places adapter — disabled by default. Wire up by setting
// VITE_GOOGLE_PLACES_KEY at build time. Costs ~$32/1k Nearby Search calls,
// so keep behind explicit env opt-in.

import { haversineMiles } from '../../utils/distance';
import { MILES_TO_METERS, PROVIDER_TIMEOUT_MS, MOSQUE_SOURCES } from '../../types/mosque';

const API_KEY = import.meta.env?.VITE_GOOGLE_PLACES_KEY || '';

export function isGooglePlacesEnabled() {
  return Boolean(API_KEY);
}

export async function searchGooglePlacesMosques({ origin, radiusMiles, signal }) {
  if (!isGooglePlacesEnabled() || !origin) return [];

  const radius = Math.min(50000, Math.round(radiusMiles * MILES_TO_METERS));
  // Places API (New) — Nearby Search v1. Requires server-side proxy in production
  // to avoid leaking the key. Left here as the adapter shape; production deploys
  // should swap the fetch URL to a backend proxy.
  const url = 'https://places.googleapis.com/v1/places:searchNearby';
  const body = {
    includedTypes: ['mosque'],
    maxResultCount: 20,
    locationRestriction: {
      circle: {
        center: { latitude: origin.lat, longitude: origin.lng },
        radius,
      },
    },
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROVIDER_TIMEOUT_MS);
  const linked = signal
    ? mergeSignals(signal, ctrl.signal)
    : ctrl.signal;
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: linked,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.location,places.websiteUri,places.internationalPhoneNumber',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Places HTTP ${res.status}`);
    const json = await res.json();
    return (json.places || []).map((p) => {
      const coordinates = {
        lat: p.location?.latitude,
        lng: p.location?.longitude,
      };
      return {
        id: `gplace:${p.id}`,
        source: MOSQUE_SOURCES.GOOGLE_PLACES,
        name: p.displayName?.text || 'Mosque',
        coordinates,
        distanceMiles: haversineMiles(origin, coordinates),
        address: p.formattedAddress,
        phone: p.internationalPhoneNumber,
        website: p.websiteUri,
      };
    });
  } finally {
    clearTimeout(timer);
  }
}

function mergeSignals(a, b) {
  if (a.aborted) return a;
  if (b.aborted) return b;
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  a.addEventListener('abort', onAbort, { once: true });
  b.addEventListener('abort', onAbort, { once: true });
  return ctrl.signal;
}
