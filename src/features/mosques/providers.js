import { searchOsmMosques } from './osm';
import { isGooglePlacesEnabled, searchGooglePlacesMosques } from './googlePlaces';
import { searchVerifiedMosques, isVerifiedDbEnabled } from './supabase';
import { haversineMiles } from '../../utils/distance';

/**
 * @typedef {Object} SearchParams
 * @property {{lat:number,lng:number}} origin
 * @property {number} radiusMiles
 * @property {AbortSignal} [signal]
 */

/**
 * Hybrid search: verified-DB results (if configured) merged with OSM/Places.
 * Verified entries take precedence — same coords/name dedupes the OSM entry.
 * @param {SearchParams} params
 */
export async function searchNearbyMosques(params) {
  const tasks = [];
  if (isVerifiedDbEnabled()) tasks.push(safe(() => searchVerifiedMosques(params)));
  if (isGooglePlacesEnabled()) tasks.push(safe(() => searchGooglePlacesMosques(params)));
  tasks.push(safe(() => searchOsmMosques(params)));

  const buckets = await Promise.all(tasks);
  const merged = mergeAndDedupe(buckets.flat(), params.origin);
  return merged.sort(byDistanceThenName);
}

async function safe(fn) {
  try { return await fn(); } catch { return []; }
}

function byDistanceThenName(a, b) {
  if (a.distanceMiles !== b.distanceMiles) return a.distanceMiles - b.distanceMiles;
  return (a.name || '').localeCompare(b.name || '');
}

// Verified entries win; collapse OSM/Places duplicates within ~80m + similar name.
function mergeAndDedupe(items, origin) {
  const sorted = [...items].sort((a, b) => priority(a) - priority(b));
  const accepted = [];
  for (const m of sorted) {
    if (Number.isFinite(m.distanceMiles) === false && origin && m.coordinates) {
      m.distanceMiles = haversineMiles(origin, m.coordinates);
    }
    const dup = accepted.find((x) => isLikelyDuplicate(x, m));
    if (dup) {
      // Keep the higher-priority entry but enrich missing fields from the dup.
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
