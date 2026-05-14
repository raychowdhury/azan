import { haversineMiles } from '../../utils/distance';
import { MILES_TO_METERS, PROVIDER_TIMEOUT_MS, MOSQUE_SOURCES } from '../../types/mosque';

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

function buildQuery(lat, lng, radiusMeters) {
  // node/way/relation around point: amenity=place_of_worship + religion=muslim,
  // plus building=mosque variants. `out center` gives geometry for ways/relations.
  return `[out:json][timeout:25];
(
  node["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusMeters},${lat},${lng});
  way["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusMeters},${lat},${lng});
  relation["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusMeters},${lat},${lng});
  node["building"="mosque"](around:${radiusMeters},${lat},${lng});
  way["building"="mosque"](around:${radiusMeters},${lat},${lng});
);
out center tags;`;
}

function fetchOverpass(query, signal) {
  const body = new URLSearchParams({ data: query }).toString();
  return (async () => {
    let lastErr;
    for (const url of OVERPASS_ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
          signal,
        });
        if (!res.ok) {
          lastErr = new Error(`Overpass HTTP ${res.status}`);
          continue;
        }
        return await res.json();
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        lastErr = e;
      }
    }
    throw lastErr || new Error('All Overpass endpoints failed');
  })();
}

function composeAddress(tags) {
  if (!tags) return undefined;
  const parts = [
    [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' '),
    tags['addr:city'],
    tags['addr:state'],
    tags['addr:postcode'],
    tags['addr:country'],
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
}

function normalizeElement(el, origin) {
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const tags = el.tags || {};
  const name = tags['name:en'] || tags.name || tags['short_name'] || 'Unnamed Mosque';
  const coordinates = { lat, lng };
  return {
    id: `osm:${el.type}/${el.id}`,
    source: MOSQUE_SOURCES.OSM,
    name,
    coordinates,
    distanceMiles: haversineMiles(origin, coordinates),
    address: composeAddress(tags),
    phone: tags.phone || tags['contact:phone'] || undefined,
    website: tags.website || tags['contact:website'] || undefined,
    sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
  };
}

export async function searchOsmMosques({ origin, radiusMiles, signal }) {
  if (!origin) return [];
  const radiusMeters = Math.round(radiusMiles * MILES_TO_METERS);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROVIDER_TIMEOUT_MS);
  const linkedSignal = signal
    ? mergeSignals(signal, ctrl.signal)
    : ctrl.signal;
  try {
    const data = await fetchOverpass(buildQuery(origin.lat, origin.lng, radiusMeters), linkedSignal);
    const seen = new Set();
    const results = [];
    for (const el of data.elements || []) {
      const m = normalizeElement(el, origin);
      if (!m) continue;
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      results.push(m);
    }
    return results;
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
