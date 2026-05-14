import { haversineMiles } from '../../utils/distance';
import {
  MILES_TO_METERS,
  PROVIDER_TIMEOUT_MS,
  PER_ENDPOINT_TIMEOUT_MS,
  MOSQUE_SOURCES,
} from '../../types/mosque';

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

function buildQuery(lat, lng, radiusMeters, serverTimeoutSec) {
  // `nwr` matches node+way+relation in one pass. `out center qt` returns
  // centroid for ways and sorts by quadtile (cheaper than default sort).
  // Server timeout scales with radius so larger searches don't get cut off.
  return `[out:json][timeout:${serverTimeoutSec}];
(
  nwr["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusMeters},${lat},${lng});
  nwr["building"="mosque"](around:${radiusMeters},${lat},${lng});
);
out center qt tags;`;
}

// Race all endpoints in parallel. First success wins; the rest get aborted.
// If every endpoint fails, throw an aggregated error.
async function fetchOverpass(query, outerSignal, perEndpointMs = PER_ENDPOINT_TIMEOUT_MS) {
  const body = new URLSearchParams({ data: query }).toString();
  const cancellers = [];
  const attempts = OVERPASS_ENDPOINTS.map((url) => {
    const ctrl = new AbortController();
    cancellers.push(ctrl);
    const linked = outerSignal ? linkSignal(outerSignal, ctrl.signal) : ctrl.signal;
    const timer = setTimeout(() => ctrl.abort(), perEndpointMs);
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: linked,
    })
      .then(async (res) => {
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status} (${url})`);
        return res.json();
      })
      .catch((e) => {
        clearTimeout(timer);
        throw new Error(`${url}: ${e.message || e.name}`);
      });
  });

  try {
    const winner = await Promise.any(attempts);
    return winner;
  } catch (e) {
    // AggregateError when every endpoint rejected.
    if (outerSignal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const msgs = (e.errors || [e]).map((x) => x?.message || String(x)).join(' | ');
    throw new Error(`All Overpass endpoints failed: ${msgs}`);
  } finally {
    // Cancel any still-running attempts (winner already settled, but slow
    // losers can still hold sockets — cut them loose).
    for (const c of cancellers) {
      if (!c.signal.aborted) c.abort();
    }
  }
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
  // Scale budgets with radius. Big radius = more elements + longer server work.
  const serverTimeoutSec = Math.min(60, Math.max(15, Math.round(radiusMiles * 4)));
  const perEndpointMs = Math.min(45000, Math.max(PER_ENDPOINT_TIMEOUT_MS, (serverTimeoutSec + 3) * 1000));
  const overallMs = Math.min(60000, Math.max(PROVIDER_TIMEOUT_MS, perEndpointMs + 5000));

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), overallMs);
  const linkedSignal = signal ? linkSignal(signal, ctrl.signal) : ctrl.signal;
  try {
    const data = await fetchOverpass(
      buildQuery(origin.lat, origin.lng, radiusMeters, serverTimeoutSec),
      linkedSignal,
      perEndpointMs,
    );
    // Overpass returns 200 OK with a `remark` field when it hits its own
    // runtime/memory limits. Treat that as an error so we can retry instead of
    // silently rendering "no mosques found".
    if (data?.remark && (!data.elements || data.elements.length === 0)) {
      throw new Error(`Overpass: ${data.remark}`);
    }
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

function linkSignal(a, b) {
  if (a.aborted) return a;
  if (b.aborted) return b;
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  a.addEventListener('abort', onAbort, { once: true });
  b.addEventListener('abort', onAbort, { once: true });
  return ctrl.signal;
}
