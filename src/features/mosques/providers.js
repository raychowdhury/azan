import { searchOsmMosques } from './osm';
import { isGooglePlacesEnabled, searchGooglePlacesMosques } from './googlePlaces';
import { searchVerifiedMosques, isVerifiedDbEnabled } from './supabase';
import { haversineMiles } from '../../utils/distance';
import { SEARCH_CACHE_TTL_MS } from '../../types/mosque';

/**
 * @typedef {Object} SearchParams
 * @property {{lat:number,lng:number}} origin
 * @property {number} radiusMiles
 * @property {AbortSignal} [signal]
 *
 * @typedef {Object} SearchResult
 * @property {import('../../types/mosque').NearbyMosque[]} mosques
 * @property {boolean} allFailed   - true if every provider errored
 * @property {string[]} errors
 */

const STORAGE_KEY = 'mosqueSearchCache';
const cache = new Map();
let hydrated = false;

function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const entries = JSON.parse(raw);
    if (!Array.isArray(entries)) return;
    for (const [k, v] of entries) {
      if (v && typeof v.ts === 'number') cache.set(k, v);
    }
  } catch {}
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...cache.entries()]));
  } catch {}
}

function cacheKey(origin, radiusMiles) {
  // Quantize coordinates to ~110m so tiny GPS jitter still hits the same cell.
  const lat = origin.lat.toFixed(3);
  const lng = origin.lng.toFixed(3);
  return `${lat}:${lng}:${radiusMiles}`;
}

function readCache(key) {
  hydrate();
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > SEARCH_CACHE_TTL_MS) {
    cache.delete(key);
    persist();
    return null;
  }
  return entry.value;
}

function writeCache(key, value) {
  cache.set(key, { ts: Date.now(), value });
  if (cache.size > 32) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  persist();
}

export function clearMosqueCache() {
  cache.clear();
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

/**
 * Hybrid search. Returns { mosques, allFailed, errors } so the UI can show a
 * real error if every provider blew up rather than silently rendering empty.
 * @param {SearchParams} params
 * @returns {Promise<SearchResult>}
 */
export async function searchNearbyMosques(params) {
  const key = cacheKey(params.origin, params.radiusMiles);
  const cached = readCache(key);
  if (cached) return cached;

  const tasks = [];
  const providerNames = [];
  if (isVerifiedDbEnabled()) {
    providerNames.push('verified');
    tasks.push(safeProvider(() => searchVerifiedMosques(params)));
  }
  if (isGooglePlacesEnabled()) {
    providerNames.push('places');
    tasks.push(safeProvider(() => searchGooglePlacesMosques(params)));
  }
  providerNames.push('osm');
  tasks.push(safeProvider(() => searchOsmMosques(params)));

  const outcomes = await Promise.all(tasks);
  const errors = [];
  const mosques = [];
  let anySucceeded = false;
  outcomes.forEach((o, i) => {
    if (o.ok) {
      anySucceeded = true;
      mosques.push(...o.value);
    } else {
      errors.push(`${providerNames[i]}: ${o.error}`);
    }
  });

  if (!anySucceeded && tasks.length > 0) {
    // Every provider failed. Bubble up so the UI shows retry, not "empty".
    const err = new Error(errors.join(' | ') || 'All mosque providers failed');
    err.allFailed = true;
    throw err;
  }

  const merged = mergeAndDedupe(mosques, params.origin).sort(byDistanceThenName);
  const result = { mosques: merged, allFailed: false, errors };
  writeCache(key, result);
  return result;
}

async function safeProvider(fn) {
  try {
    const value = await fn();
    return { ok: true, value: Array.isArray(value) ? value : [] };
  } catch (e) {
    if (e?.name === 'AbortError') throw e; // propagate user cancels
    return { ok: false, error: e?.message || 'error' };
  }
}

function byDistanceThenName(a, b) {
  if (a.distanceMiles !== b.distanceMiles) return a.distanceMiles - b.distanceMiles;
  return (a.name || '').localeCompare(b.name || '');
}

function mergeAndDedupe(items, origin) {
  const sorted = [...items].sort((a, b) => priority(a) - priority(b));
  const accepted = [];
  for (const m of sorted) {
    if (Number.isFinite(m.distanceMiles) === false && origin && m.coordinates) {
      m.distanceMiles = haversineMiles(origin, m.coordinates);
    }
    const dup = accepted.find((x) => isLikelyDuplicate(x, m));
    if (dup) {
      dup.address = dup.address || m.address;
      dup.phone = dup.phone || m.phone;
      dup.website = dup.website || m.website;
      continue;
    }
    accepted.push(m);
  }
  return accepted;
}

function priority(m) {
  if (m.source === 'verified_db') return 0;
  if (m.source === 'google_places') return 1;
  return 2;
}

function isLikelyDuplicate(a, b) {
  if (!a.coordinates || !b.coordinates) return false;
  const dMiles = haversineMiles(a.coordinates, b.coordinates);
  if (dMiles > 0.05) return false; // ~80m
  const an = (a.name || '').trim().toLowerCase();
  const bn = (b.name || '').trim().toLowerCase();
  if (!an || !bn) return true;
  if (an === bn) return true;
  return an.includes(bn) || bn.includes(an);
}
