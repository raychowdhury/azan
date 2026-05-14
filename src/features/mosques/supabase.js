// Thin Supabase REST adapter — uses PostgREST endpoints directly via fetch so
// the build stays dependency-free. Feature-gated on VITE_SUPABASE_URL +
// VITE_SUPABASE_ANON_KEY. When unset, every export is a graceful no-op so the
// rest of the Nearby Mosques experience still works on OSM alone.

import { haversineMiles } from '../../utils/distance';
import { MILES_TO_METERS, PROVIDER_TIMEOUT_MS, MOSQUE_SOURCES } from '../../types/mosque';

const URL = (import.meta.env?.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const ANON = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

export function isVerifiedDbEnabled() {
  return Boolean(URL && ANON);
}

function authHeaders(extra = {}) {
  return {
    apikey: ANON,
    Authorization: `Bearer ${ANON}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

function withTimeout(signal) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROVIDER_TIMEOUT_MS);
  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener('abort', () => ctrl.abort(), { once: true });
  }
  return { signal: ctrl.signal, cancel: () => clearTimeout(timer) };
}

function normalizeVerifiedRow(row, origin) {
  if (!row || typeof row.latitude !== 'number' || typeof row.longitude !== 'number') {
    return null;
  }
  const coordinates = { lat: row.latitude, lng: row.longitude };
  return {
    id: `verified:${row.id}`,
    source: MOSQUE_SOURCES.VERIFIED_DB,
    name: row.name,
    coordinates,
    distanceMiles: origin ? haversineMiles(origin, coordinates) : Infinity,
    address: row.address || undefined,
    phone: row.phone || undefined,
    website: row.website || undefined,
    verified: row.verified === true,
    iqamah: row.iqamah || undefined,
    jumuah: Array.isArray(row.jumuah) ? row.jumuah : undefined,
    languages: Array.isArray(row.languages) ? row.languages : undefined,
    facilities: Array.isArray(row.facilities) ? row.facilities : undefined,
    notes: row.notes || undefined,
  };
}

/**
 * Pull verified mosques near a coordinate. Uses a bounding-box pre-filter on
 * PostgREST; haversine refines client-side. Returns [] silently on any error
 * so the OSM provider can still satisfy the request.
 */
export async function searchVerifiedMosques({ origin, radiusMiles, signal }) {
  if (!isVerifiedDbEnabled() || !origin) return [];

  // Rough degree padding: 1 deg lat ≈ 69 miles. Lng shrinks with latitude.
  const latPad = radiusMiles / 69;
  const lngPad = radiusMiles / Math.max(1, 69 * Math.cos((origin.lat * Math.PI) / 180));
  const minLat = origin.lat - latPad;
  const maxLat = origin.lat + latPad;
  const minLng = origin.lng - lngPad;
  const maxLng = origin.lng + lngPad;

  const params = new URLSearchParams();
  params.append('select', '*');
  params.append('verified', 'eq.true');
  params.append('latitude', `gte.${minLat}`);
  params.append('latitude', `lte.${maxLat}`);
  params.append('longitude', `gte.${minLng}`);
  params.append('longitude', `lte.${maxLng}`);
  params.append('limit', '50');

  const { signal: s, cancel } = withTimeout(signal);
  try {
    const res = await fetch(`${URL}/rest/v1/mosques?${params.toString()}`, {
      headers: authHeaders(),
      signal: s,
    });
    if (!res.ok) return [];
    const rows = await res.json();
    const radiusMeters = radiusMiles * MILES_TO_METERS;
    return rows
      .map((r) => normalizeVerifiedRow(r, origin))
      .filter((m) => m && m.distanceMiles * MILES_TO_METERS <= radiusMeters);
  } catch {
    return [];
  } finally {
    cancel();
  }
}

/**
 * Public submission. Lands in `mosque_submissions` for moderator review —
 * not into the verified table. Returns { ok, error }.
 */
export async function submitMosque(payload) {
  if (!isVerifiedDbEnabled()) {
    return { ok: false, error: 'submissions_unavailable' };
  }
  const body = {
    name: payload.name,
    address: payload.address || null,
    latitude: payload.coordinates?.lat ?? null,
    longitude: payload.coordinates?.lng ?? null,
    phone: payload.phone || null,
    website: payload.website || null,
    iqamah: payload.iqamah || null,
    jumuah: payload.jumuah || null,
    languages: payload.languages || null,
    facilities: payload.facilities || null,
    notes: payload.notes || null,
    submitter_contact: payload.submitterContact || null,
  };
  try {
    const res = await fetch(`${URL}/rest/v1/mosque_submissions`, {
      method: 'POST',
      headers: authHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: text || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || 'network_error' };
  }
}

/** Look up one verified mosque by its row id (without the "verified:" prefix). */
export async function fetchVerifiedMosqueById(id) {
  if (!isVerifiedDbEnabled() || !id) return null;
  const cleanId = String(id).replace(/^verified:/, '');
  const params = new URLSearchParams({ select: '*', id: `eq.${cleanId}`, limit: '1' });
  try {
    const res = await fetch(`${URL}/rest/v1/mosques?${params.toString()}`, {
      headers: authHeaders(),
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return normalizeVerifiedRow(rows[0], null);
  } catch {
    return null;
  }
}
